import { getPreferenceValues } from "@raycast/api";
import { Preferences } from "./types";

export type SpeechResult = {
  audio: Buffer;
  format: string;
};

const DEFAULT_SERVER_URL = "http://localhost:8000";

export function getConfigError(preferences: Preferences): string | null {
  const serverUrl = preferences.serverUrl?.trim();
  if (serverUrl) {
    try {
      normalizeServerUrl(serverUrl);
    } catch {
      return "Invalid TTS server URL";
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

  const serverUrl = normalizeServerUrl(preferences.serverUrl ?? DEFAULT_SERVER_URL);
  const voice = preferences.voice?.trim();

  const formData = new FormData();
  formData.append("text", text);
  if (voice) {
    formData.append("voice", voice);
  }

  const response = await fetch(serverUrl, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    const details = message ? `: ${message}` : "";
    throw new Error(`TTS server error (${response.status})${details}`);
  }

  const contentType = response.headers.get("content-type") || "audio/wav";
  const format = parseAudioFormat(contentType);
  const audioBuffer = await response.arrayBuffer();
  return { audio: Buffer.from(audioBuffer), format };
}

function normalizeServerUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim() || DEFAULT_SERVER_URL;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Invalid TTS server URL");
  }

  if (!url.pathname || url.pathname === "/") {
    url.pathname = "/tts";
  }

  return url.toString();
}

function parseAudioFormat(contentType: string): string {
  const mime = contentType.split(";")[0].trim().toLowerCase();
  if (mime === "audio/mpeg" || mime === "audio/mp3") return "mp3";
  if (mime === "audio/wav" || mime === "audio/wave" || mime === "audio/x-wav") return "wav";
  if (mime === "audio/flac") return "flac";
  if (mime === "audio/mp4" || mime === "audio/x-m4a" || mime === "audio/m4a") return "m4a";
  return "wav";
}

async function readErrorMessage(response: { text: () => Promise<string> }): Promise<string | null> {
  try {
    const text = await response.text();
    return text.trim() ? text.trim() : null;
  } catch {
    return null;
  }
}
