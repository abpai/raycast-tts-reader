import { Clipboard, getSelectedText } from "@raycast/api";

export async function getSelectedTextOrClipboard(): Promise<string> {
  try {
    return await getSelectedText();
  } catch {
    return (await Clipboard.readText()) ?? "";
  }
}
