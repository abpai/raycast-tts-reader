# TTS Reader Changelog

## [2.0.0] - 2026-03-11

**Renamed and rewritten for provider-agnostic TTS.**

### Highlights

- Renamed the extension and repository from Pocket Reader / `raycast-pocket-tts-reader` to TTS Reader / `raycast-tts-reader`
- Works with any TTS server that accepts `POST /tts` with a `text` form field
- Sends the optional voice preference as a `voice` parameter
- Detects output audio format from the server `Content-Type` header
- Simplified configuration from 13 preferences down to 5

### Breaking Changes

- Removed generate mode (CLI) — the extension is now HTTP-only
- Removed Pocket TTS-specific preferences: mode, variant, lsdDecodeSteps, temperature, noiseClamp, eosThreshold, framesAfterEos, device
- Cache directory changed from `~/.cache/raycast-pocket-tts/` to `~/.cache/raycast-tts/`

### Recommended Server

Use [tts-gateway](https://github.com/abpai/tts-gateway) for a multi-provider TTS server:
```bash
uv tool install tts-gateway[kokoro]
tts serve --provider kokoro
```

## [1.0.0] - 2025-03-18

Initial release as Pocket Reader in the `raycast-pocket-tts-reader` repository.

- Text-to-Speech with Kyutai Pocket TTS (serve and generate modes)
- Interactive text editor for reviewing text before speech
- Direct reading mode without confirmation dialogs
- Voice configuration with custom voice URLs
- Speed and format options via ffmpeg
- Audio file management and native macOS playback
