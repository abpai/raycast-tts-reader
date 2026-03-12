import { Action, ActionPanel, Detail, openExtensionPreferences } from "@raycast/api";

export default function Onboarding() {
  const markdown = `
  # Configuration

  This extension reads text aloud using any TTS server that accepts \`POST /tts\` with a \`text\` form field. See [tts-gateway](https://github.com/abpai/tts-gateway) for a reference implementation.

  **Recommended example: tts-gateway**
  1. Install: \`uv tool install tts-gateway[kokoro]\`
  2. Start the server: \`tts serve --provider kokoro\`
  3. Press \`⏎\` to open preferences and confirm the server URL (default: \`http://localhost:8000\`).

  **Using another TTS server**
  1. Start your TTS server.
  2. Press \`⏎\` to open preferences.
  3. Set the "Server URL" to your server's endpoint.
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
