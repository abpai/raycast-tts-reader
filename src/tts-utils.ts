import { getPreferenceValues } from "@raycast/api";
import { spawn } from "child_process";
import { readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { ensureToolingInPath } from "./path-utils";
import { Preferences } from "./types";

export type SpeechResult = {
  audio: Buffer;
  format: string;
};

const DEFAULT_SERVER_URL = "http://localhost:8000";

export function getConfigError(preferences: Preferences): string | null {
  if (preferences.mode === "serve") {
    const serverUrl = preferences.serverUrl?.trim();
    if (serverUrl) {
      try {
        normalizeServerUrl(serverUrl);
      } catch {
        return "Invalid Pocket TTS server URL";
      }
    }
  }

  return null;
}

export async function createSpeech(text: string): Promise<SpeechResult> {
  const preferences = getPreferenceValues<Preferences>();
  const configError = getConfigError(preferences);
  if (configError) {
    throw new Error(configError);
  }

  const voice = preferences.voice?.trim() || "alba";

  if (preferences.mode === "serve") {
    const serverUrl = normalizeServerUrl(preferences.serverUrl ?? DEFAULT_SERVER_URL);
    const audio = await requestServerSpeech(serverUrl, text, voice);
    return { audio, format: "wav" };
  }

  const audio = await runGenerateSpeech(text, preferences, voice);
  return { audio, format: "wav" };
}

function normalizeServerUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim() || DEFAULT_SERVER_URL;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Invalid Pocket TTS server URL");
  }

  if (!url.pathname || url.pathname === "/") {
    url.pathname = "/tts";
  }

  return url.toString();
}

async function requestServerSpeech(serverUrl: string, text: string, voice: string): Promise<Buffer> {
  const formData = new FormData();
  formData.append("text", text);
  if (voice) {
    formData.append("voice_url", voice);
  }

  const response = await fetch(serverUrl, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    const details = message ? `: ${message}` : "";
    throw new Error(`Pocket TTS server error (${response.status})${details}`);
  }

  const audioBuffer = await response.arrayBuffer();
  return Buffer.from(audioBuffer);
}

async function readErrorMessage(response: { text: () => Promise<string> }): Promise<string | null> {
  try {
    const text = await response.text();
    return text.trim() ? text.trim() : null;
  } catch {
    return null;
  }
}

async function runGenerateSpeech(text: string, preferences: Preferences, voice: string): Promise<Buffer> {
  const outputPath = join(tmpdir(), `pocket-tts-${Date.now()}.wav`);
  const args = ["generate", "--text", text, "--output-path", outputPath, "--quiet"];

  if (voice) {
    args.push("--voice", voice);
  }

  const variant = preferences.variant?.trim();
  if (variant) {
    args.push("--variant", variant);
  }

  const lsdDecodeSteps = parseOptionalInt(preferences.lsdDecodeSteps);
  if (lsdDecodeSteps !== undefined) {
    args.push("--lsd-decode-steps", String(lsdDecodeSteps));
  }

  const temperature = parseOptionalFloat(preferences.temperature);
  if (temperature !== undefined) {
    args.push("--temperature", String(temperature));
  }

  const noiseClamp = parseOptionalFloat(preferences.noiseClamp);
  if (noiseClamp !== undefined) {
    args.push("--noise-clamp", String(noiseClamp));
  }

  const eosThreshold = parseOptionalFloat(preferences.eosThreshold);
  if (eosThreshold !== undefined) {
    args.push("--eos-threshold", String(eosThreshold));
  }

  const framesAfterEos = parseOptionalInt(preferences.framesAfterEos);
  if (framesAfterEos !== undefined) {
    args.push("--frames-after-eos", String(framesAfterEos));
  }

  const device = preferences.device?.trim();
  if (device) {
    args.push("--device", device);
  }

  try {
    await runCommand("pocket-tts", args);
    return await readFile(outputPath);
  } finally {
    await unlink(outputPath).catch(() => undefined);
  }
}

function parseOptionalFloat(value?: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalInt(value?: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function runCommand(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, PATH: ensureToolingInPath() },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new Error("pocket-tts not found. Install it or ensure it's on your PATH."));
      } else {
        reject(err);
      }
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const details = stderr.trim();
      reject(new Error(`pocket-tts exited with code ${code}${details ? `: ${details}` : ""}`));
    });
  });
}
