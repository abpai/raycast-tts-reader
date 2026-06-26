import { getPreferenceValues } from "@raycast/api";
import { buildPcmFfplayArgs, parsePcmStreamHeaders } from "./pcm-stream";
import { DEFAULT_STDIN_FFPLAY_ARGS, isFfplayAvailable, startStdinPlayback } from "./playback-controller";
import { parseSpeed, resolvePlaybackMode } from "./playback-mode";
import { play } from "./play";
import { createSpeech, detectGateway, gatewayErrorMessage, getConfigError } from "./tts-utils";
import { DEFAULT_SERVER_URL, parseServerUrl } from "./server-url";
import {
  clearStreamSession,
  readStreamSession,
  registerStreamSession,
  requestStreamStop,
  startStreamStopPolling,
} from "./stream-stop";
import { Preferences } from "./types";

export type SpeakResult = {
  warnings: string[];
  completion: "finished" | "stopped";
  engine?: string;
};

const GATEWAY_PCM_STREAM_PATH = "/tts/stream/pcm";
const GATEWAY_MP3_STREAM_PATH = "/tts/stream";
const STREAM_UNAVAILABLE_WARNING = "Gateway streaming unavailable - buffered playback used";

type ActiveStreamingSession = {
  generation: number;
  sessionId: string;
  abortController: AbortController;
  stopPolling: () => void;
};

let activeStreamingSession: ActiveStreamingSession | null = null;
let nextStreamingGeneration = 0;

export async function speakText(text: string): Promise<SpeakResult> {
  const preferences = getPreferenceValues<Preferences>();
  const configError = getConfigError(preferences);
  if (configError) {
    throw new Error(configError);
  }

  const { baseUrl, hasCustomPath } = parseServerUrl(preferences.serverUrl ?? DEFAULT_SERVER_URL);
  const isGateway = hasCustomPath ? false : await detectGateway(baseUrl);
  const speed = parseSpeed(preferences.speed);
  const saveAudioFiles = preferences.saveAudioFiles ?? false;
  const shouldCheckFfplay = isGateway && !hasCustomPath && !saveAudioFiles && speed === 1;
  const ffplayAvailable = shouldCheckFfplay ? await isFfplayAvailable() : false;
  const { mode, warnings } = resolvePlaybackMode({
    isGateway,
    hasCustomPath,
    saveAudioFiles,
    speed,
    ffplayAvailable,
  });

  if (mode === "stream") {
    try {
      const result = await speakViaStream(text, baseUrl, preferences.voice?.trim());
      return { ...result, warnings: [...warnings, ...result.warnings] };
    } catch (error) {
      if (!(error instanceof StreamUnavailableError)) {
        throw error;
      }
      return await speakBuffered(text, [...warnings, STREAM_UNAVAILABLE_WARNING]);
    }
  }

  return await speakBuffered(text, warnings);
}

async function speakBuffered(text: string, warnings: string[]): Promise<SpeakResult> {
  const { audio, format, engine } = await createSpeech(text);
  const result = await play(audio, format);
  return { warnings: [...warnings, ...result.warnings], completion: result.completion, engine };
}

export async function abortActiveStreamingRequest(): Promise<boolean> {
  let stopped = false;

  if (activeStreamingSession) {
    activeStreamingSession.stopPolling();
    activeStreamingSession.abortController.abort();
    activeStreamingSession = null;
    stopped = true;
  }

  try {
    const session = await readStreamSession();
    if (session) {
      await requestStreamStop(session.sessionId);
      stopped = true;
    }
  } catch {
    // Missing or stale marker should be harmless.
  }

  return stopped;
}

export function resetActiveStreamingSessionForTests(): void {
  activeStreamingSession = null;
  nextStreamingGeneration = 0;
}

async function beginStreamingSession(): Promise<{
  generation: number;
  sessionId: string;
  abortController: AbortController;
  stopPolling: () => void;
}> {
  if (activeStreamingSession) {
    activeStreamingSession.stopPolling();
    activeStreamingSession.abortController.abort();
  }

  nextStreamingGeneration += 1;
  const generation = nextStreamingGeneration;
  const sessionId = await registerStreamSession();
  const abortController = new AbortController();
  const stopPolling = startStreamStopPolling(sessionId, abortController);
  activeStreamingSession = { generation, sessionId, abortController, stopPolling };
  return { generation, sessionId, abortController, stopPolling };
}

function endStreamingSession(generation: number, sessionId: string, stopPolling: () => void): void {
  stopPolling();
  if (activeStreamingSession?.generation === generation) {
    activeStreamingSession = null;
  }
  void clearStreamSession(sessionId).catch(() => undefined);
}

function isActiveStreamingSession(generation: number): boolean {
  return activeStreamingSession?.generation === generation;
}

function supersededStreamResult(): SpeakResult {
  return { warnings: [], completion: "stopped" };
}

async function speakViaStream(text: string, baseUrl: string, voice?: string): Promise<SpeakResult> {
  const { generation, sessionId, abortController, stopPolling } = await beginStreamingSession();

  try {
    const payload = buildStreamPayload(text, voice);
    const pcmAttempt = await tryGatewayPcmStream(baseUrl, payload, abortController, generation);
    if (pcmAttempt.kind === "success") {
      return pcmAttempt.result;
    }
    if (pcmAttempt.kind === "superseded") {
      return supersededStreamResult();
    }

    if (!isActiveStreamingSession(generation)) {
      return supersededStreamResult();
    }

    return await speakViaMp3Stream(baseUrl, payload, abortController, generation);
  } finally {
    endStreamingSession(generation, sessionId, stopPolling);
  }
}

type PcmStreamAttempt = { kind: "success"; result: SpeakResult } | { kind: "fallback" } | { kind: "superseded" };

function isStreamUnavailableStatus(status: number): boolean {
  return status === 404 || status === 405 || status === 501;
}

class StreamUnavailableError extends Error {
  constructor(status: number) {
    super(`Gateway streaming unavailable (${status})`);
    this.name = "StreamUnavailableError";
  }
}

function isFetchAborted(error: unknown, abortController: AbortController): boolean {
  return (
    abortController.signal.aborted ||
    (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError"))
  );
}

async function tryGatewayPcmStream(
  baseUrl: string,
  payload: StreamPayload,
  abortController: AbortController,
  generation: number,
): Promise<PcmStreamAttempt> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${GATEWAY_PCM_STREAM_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: abortController.signal,
    });
  } catch (error) {
    if (isFetchAborted(error, abortController)) {
      return { kind: "superseded" };
    }
    throw error;
  }

  if (!response.ok) {
    await discardResponseBody(response);
    if (isStreamUnavailableStatus(response.status)) {
      return { kind: "fallback" };
    }
    throw new Error(gatewayErrorMessage(response.status));
  }

  const metadata = parsePcmStreamHeaders(response.headers);
  const body = response.body;
  if (!metadata || !body) {
    await discardResponseBody(response);
    return { kind: "fallback" };
  }

  if (!isActiveStreamingSession(generation)) {
    await discardResponseBody(response);
    return { kind: "superseded" };
  }

  const engine = response.headers.get("x-tts-primary-engine") || undefined;
  const completion = await startStdinPlayback(
    async (stdin, abortSignal) => {
      await pumpReadableStream(body, stdin, abortSignal);
    },
    abortController,
    buildPcmFfplayArgs(metadata),
  );

  return {
    kind: "success",
    result: { warnings: [], completion, engine },
  };
}

async function speakViaMp3Stream(
  baseUrl: string,
  payload: StreamPayload,
  abortController: AbortController,
  generation: number,
): Promise<SpeakResult> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${GATEWAY_MP3_STREAM_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: abortController.signal,
    });
  } catch (error) {
    if (isFetchAborted(error, abortController)) {
      return supersededStreamResult();
    }
    throw error;
  }

  if (!response.ok) {
    await discardResponseBody(response);
    if (isStreamUnavailableStatus(response.status)) {
      throw new StreamUnavailableError(response.status);
    }
    throw new Error(gatewayErrorMessage(response.status));
  }

  if (!isActiveStreamingSession(generation)) {
    await discardResponseBody(response);
    return supersededStreamResult();
  }

  const engine = response.headers.get("x-tts-primary-engine") || undefined;
  const body = response.body;
  if (!body) {
    throw new Error("TTS server returned empty stream");
  }

  const completion = await startStdinPlayback(
    async (stdin, abortSignal) => {
      await pumpReadableStream(body, stdin, abortSignal);
    },
    abortController,
    DEFAULT_STDIN_FFPLAY_ARGS,
  );

  return { warnings: [], completion, engine };
}

type StreamPayload = { text: string; voice?: string };

function buildStreamPayload(text: string, voice?: string): StreamPayload {
  const payload: StreamPayload = { text };
  if (voice) {
    payload.voice = voice;
  }
  return payload;
}

async function discardResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Body may already be consumed or closed.
  }
}

async function pumpReadableStream(
  body: ReadableStream<Uint8Array>,
  stdin: NodeJS.WritableStream,
  abortSignal: AbortSignal,
): Promise<void> {
  const reader = body.getReader();

  try {
    while (!abortSignal.aborted) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      if (!value || abortSignal.aborted) {
        break;
      }

      const canContinue = stdin.write(value);
      if (!canContinue) {
        await new Promise<void>((resolve, reject) => {
          const onDrain = () => {
            stdin.off("error", onError);
            resolve();
          };
          const onError = (error: NodeJS.ErrnoException) => {
            stdin.off("drain", onDrain);
            if (abortSignal.aborted || error.code === "EPIPE") {
              resolve();
              return;
            }
            reject(error);
          };
          stdin.once("drain", onDrain);
          stdin.once("error", onError);
        });
      }
    }
  } catch (error) {
    if (abortSignal.aborted || (error instanceof Error && "code" in error && error.code === "EPIPE")) {
      return;
    }
    throw error;
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Stream may already be closed after abort or ffplay exit.
    }
    reader.releaseLock();
    stdin.end();
  }
}
