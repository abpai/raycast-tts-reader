import { Clipboard, closeMainWindow, getPreferenceValues, getSelectedText, showToast, Toast } from "@raycast/api";
import { play } from "./play";
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

  let text: string;
  try {
    text = await getSelectedText();
  } catch {
    const clipboardText = await Clipboard.readText();
    text = clipboardText ?? "";
  }

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
  });

  try {
    await closeMainWindow();

    const { audio, format } = await createSpeech(text);
    await play(audio, format);

    toast.style = Toast.Style.Success;
    toast.title = "Finished reading";
  } catch (err) {
    toast.style = Toast.Style.Failure;
    toast.title = "Failed to generate speech";
    toast.message = err instanceof Error ? err.message : "Unknown error";
  }
}
