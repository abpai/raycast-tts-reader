import { Action, ActionPanel, Detail, openExtensionPreferences } from "@raycast/api";

export default function Onboarding() {
  const markdown = `
  # Configuration

  This extension reads text aloud using a local TTS server. It auto-detects [tts-gateway](https://github.com/abpai/tts-gateway) servers and streams from \`/tts/stream/pcm\` when \`ffplay\` is available, then falls back to buffered \`/v1/speech\` playback when streaming is unavailable. Any server that accepts \`POST /tts\` with a \`text\` form field also works.

  **Recommended: tts-gateway v1.3.1 with Tiny Voca (CPU)**
  1. Install [uv](https://docs.astral.sh/uv/getting-started/installation/) and Git.
  2. Install the published gateway and pinned Dizione phonemizer: \`uv tool install --force 'tts-gateway[tiny-voca]==1.3.1' --with 'git+https://github.com/n4ze3m/dizione@8cd889e4de7be6bd1dd2e6891344a0729fa14dd4'\`
  3. Start the server: \`tts serve --provider tiny-voca --device cpu --format wav --host 127.0.0.1 --port 45123\`
  4. Press \`⏎\` to open preferences. Set **Server URL** to \`http://127.0.0.1:45123\`. Leave **Voice** blank for \`F2\`, or enter \`F2\` or \`M2\`. Replace any saved Kokoro voice name.

  Tiny Voca speaks American English. First startup downloads about 27 MB of model and phonemizer files; later starts can use the cached files offline.

  If a gateway is already running, stop it before starting this server, or update and restart its service with the command above. Installing a new version does not update an already running process.

  **Using another TTS server**
  1. Start your TTS server.
  2. Press \`⏎\` to open preferences.
  3. Set the "Server URL" to your server's endpoint.

  **Optional: ffmpeg**

  Install \`ffmpeg\` to enable playback speed adjustment and audio format conversion. Without it, audio plays at the original speed and format returned by the server.

  Install \`ffplay\` to enable low-latency tts-gateway streaming for normal-speed playback.

  **Playback controls**

  Add a hotkey for **Stop Audio** if you want quick control after speech starts.
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
