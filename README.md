<div align="center">

# Pocket Reader

![Extension Icon](./assets/extension-icon.png)

*Turn any selected text into lifelike speech using [Kyutai Pocket TTS](https://github.com/kyutai-labs/pocket-tts) – directly from Raycast.*

</div>

---

## Why This Extension Exists

I'm dyslexic (shoutout to fellow dyslexics! 👋), and I just wanted something that could read any text to me. Whether I'm browsing the web, in Slack, poking around Cursor agent chats, or anywhere else on my Mac.

The built-in Mac and Chrome voices are still stuck in the uncanny valley, so I built this with the goal of high-quality local text-to-speech for *any* selected text, anywhere on your system, powered by [Pocket TTS](https://github.com/kyutai-labs/pocket-tts)—right from Raycast. Enjoy!

*This project is not affiliated with Pocket TTS or Kyutai. I just liked that it runs locally and I'm a fan.*

---

## ✨ Features

* **Serve or Generate Mode** – Use a running `pocket-tts serve` instance or invoke `pocket-tts generate` per request.
* **Voice Control** – Default voice is **alba**, with support for custom voice URLs or files.
* **Voice Parameters** – Configure variant, temperature, decode steps, EOS threshold, and more.
* **Speed & Format Options** – Adjust playback speed and output format (requires ffmpeg for non-WAV or speed changes).
* **Audio File Management** – Option to save generated audio files to `~/.cache/raycast-pocket-tts/` for debugging and reuse.
* **Real-time Feedback** – Visual feedback during speech generation with detailed error handling.

---

## 📦 Installation

Install from the Raycast Store - search for "Pocket Reader" or install directly from this page.

### Commands Available

* **"Get Started"** – Onboarding and configuration help

* **"Read Selected Text"** – Main text-to-speech interface
* **"Read Text with Editor"** – Opens text editor for writing and reading custom text

---

## ⚙️ Requirements

**Serve mode**

* Install Pocket TTS and run: `pocket-tts serve` (or `uvx pocket-tts serve`).
* The extension defaults to `http://localhost:8000`.

**Generate mode**

* Install Pocket TTS and ensure `pocket-tts` is on your PATH.
* With uv: `uv tool install pocket-tts` (global) or run on demand with `uvx pocket-tts generate`.
* If PATH isn't updated, run `uv tool dir --bin` and `uv tool update-shell`.

**Optional (speed/format)**

* Install `ffmpeg` if you want non-WAV output or playback speed changes.

---

## ⚙️ Accessing Settings

To configure the extension:

1. Open **Raycast Settings** (`Cmd + ,`)
2. Navigate to **Extensions** tab
3. Find **Pocket Reader** in the list
4. Click the extension name to open its settings panel
5. Configure your preferences (mode, voice, parameters, etc.)

![Raycast Settings](./assets/settings.png)

**💡 Pro Tip:** It's nice to set a hotkey like `⌥ + R` (Option + R) for the "Read Selected Text" command to quickly access text-to-speech from any application without opening Raycast first. You can see this configured in the screenshot above.

All changes are saved automatically and take effect immediately.

---

## 📋 Configuration Options

| Preference          | Type / Default               | Description                                                        |
| ------------------- | ---------------------------- | ------------------------------------------------------------------ |
| `mode`              | Dropdown – `serve`           | Use Pocket TTS server or CLI generation.                            |
| `serverUrl`         | Text – `http://localhost:8000` | Pocket TTS serve endpoint (serve mode only).                    |
| `voice`             | Text – `alba`                | Voice name or URL/path (e.g., `alba`, `hf://...`, `https://...`).   |
| `speed`             | Text – `1.0`                 | Playback speed (0.25–4.0). Requires ffmpeg when not 1.0.            |
| `outputFormat`      | Dropdown – `wav`             | Output format. Requires ffmpeg when not WAV.                        |
| `variant`           | Text – `b6369a24`            | Model variant (generate mode only).                                 |
| `lsdDecodeSteps`    | Text – `1`                   | Decode steps (generate mode only).                                  |
| `temperature`       | Text – `0.7`                 | Sampling temperature (generate mode only).                          |
| `noiseClamp`        | Text – empty                 | Noise clamp (generate mode only).                                   |
| `eosThreshold`      | Text – `-4.0`                | EOS threshold (generate mode only).                                 |
| `framesAfterEos`    | Text – empty                 | Frames after EOS (generate mode only).                              |
| `device`            | Text – `cpu`                 | Device (generate mode only).                                        |
| `saveAudioFiles`    | Checkbox – `false`           | Save generated audio files for debugging/reuse.                     |

---

## 🚀 Usage

### Basic Usage

1. **Select text** in any app —or— copy text to the clipboard.
2. Open Raycast and run **"Read Selected Text"**.
3. The extension opens with your text pre-loaded in an editable form.
4. **Edit the text** if needed, then press **Enter** or click **"Read Aloud"**.
5. Audio generation begins with real-time feedback and plays automatically.

### Advanced Features

* **Voice Parameters**: Tune variant, temperature, decode steps, and EOS behavior in generate mode.

* **Speed Control**: Adjust playback speed from 0.25x to 4.0x.
* **Format Options**: Output WAV/MP3/M4A/FLAC (ffmpeg required for non-WAV).
* **Save Files**: Enable "Save Audio Files" to keep generated speech in `~/.cache/raycast-pocket-tts/`.

---

## 💾 Audio File Management

The extension handles audio files intelligently:

* **Temporary mode** (default): Files are created temporarily and cleaned up after playback.
* **Persistent mode**: Enable "Save Audio Files" to keep files in `~/.cache/raycast-pocket-tts/` for reuse.
* **Format matching**: File extensions automatically match your selected audio format.
* **Native playback**: Uses macOS's built-in `afplay` for maximum compatibility.

---

## 🐛 Troubleshooting

### Serve Mode Errors

1. Confirm `pocket-tts serve` is running.
2. Check the server URL in preferences.

### Generate Mode Errors

1. Confirm `pocket-tts` is installed and on your PATH.
2. Try running `pocket-tts generate` in a terminal to verify the CLI works.

### Speed / Format Issues

1. Install `ffmpeg` if using non-WAV output or playback speed changes.
2. Use WAV if you want to avoid ffmpeg entirely.

### File Issues

1. Check `~/.cache/raycast-pocket-tts/` if saving is enabled.
2. Verify file extensions match the selected format.
3. Test saved files manually: `afplay ~/.cache/raycast-pocket-tts/filename.wav`

---

## 📄 License

MIT © 2025 Andy Pai – Not affiliated with Kyutai. Always disclose AI-generated speech to users when appropriate.
