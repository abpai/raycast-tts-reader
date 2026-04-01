import { closeMainWindow, getPreferenceValues, showToast, Toast } from "@raycast/api";
import { play } from "./play";
import { getSelectedTextOrClipboard } from "./text-source";
import { createSpeech, getConfigError } from "./tts-utils";
import { Preferences } from "./types";

export default async function Command() {
  const preferences = getPreferenceValues<Preferences>();

  const configError = getConfigError(preferences);
  if (configError) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Not configured",
      message: configError,
    });
    return;
  }

  const { text, source } = await getSelectedTextOrClipboard();

  if (!text.trim()) {
    await showToast({
      style: Toast.Style.Failure,
      title: "No text found",
      message: "No text selected or in clipboard.",
    });
    return;
  }

  const toast = await showToast({
    style: Toast.Style.Animated,
    title: "Generating speech…",
    message: source === "clipboard" ? "Using clipboard text" : undefined,
  });

  try {
    await closeMainWindow();

    const { audio, format, engine } = await createSpeech(text);
    const { warnings } = await play(audio, format);

    toast.style = Toast.Style.Success;
    toast.title = engine ? `Finished reading (${engine})` : "Finished reading";
    toast.message = warnings.length > 0 ? warnings.join("; ") : undefined;
  } catch (err) {
    toast.style = Toast.Style.Failure;
    toast.title = "Failed to generate speech";
    toast.message = err instanceof Error ? err.message : "Unknown error";
  }
}
