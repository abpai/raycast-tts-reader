import { Action, ActionPanel, Detail, openExtensionPreferences } from "@raycast/api";

export default function Onboarding() {
  const markdown = `
  # Configuration ⚙️

  This extension works with Kyutai Pocket TTS and supports two modes:

  **Serve mode (recommended)**
  1. Install Pocket TTS and run \`pocket-tts serve\` (or \`uvx pocket-tts serve\`).
  2. Press \`⏎\` to open the extension preferences.
  3. Set "Mode" to **serve** and confirm the server URL (default: \`http://localhost:8000\`).

  **Generate mode**
  1. Install Pocket TTS and ensure \`pocket-tts\` is available on your PATH.
  2. Press \`⏎\` to open the extension preferences.
  3. Set "Mode" to **generate** and adjust voice/parameters as needed.
  `;

  return (
    <Detail
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action title="Open Extension Preferences" onAction={openExtensionPreferences} />
        </ActionPanel>
      }
    />
  );
}
