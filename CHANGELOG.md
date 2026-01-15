# Pocket Reader Changelog

## [Initial Version] - {PR_MERGE_DATE}

🎉 **First release of Pocket Reader extension for Raycast!**

### Features
- **Text-to-Speech Integration**: Convert any selected text or clipboard content to speech using Kyutai Pocket TTS
- **Interactive Text Editor**: Review and edit text before converting to speech
- **Direct Reading Mode**: Instant text-to-speech without confirmation dialogs
- **Serve or Generate Mode**: Use a running Pocket TTS server or invoke the CLI per request
- **Voice Configuration**: Default alba voice with support for custom voice URLs or files
- **Voice Parameters**: Control variant, temperature, decode steps, and EOS tuning (generate mode)
- **Speed & Format Options**: Optional speed and output format conversion via ffmpeg
- **Audio File Management**: Option to save generated audio files for reuse
- **Native macOS Playback**: Reliable audio playback using built-in `afplay`
- **Comprehensive Error Handling**: Detailed feedback and troubleshooting information
- **User Onboarding**: Guided setup for serve/generate configuration

### Technical Implementation
- Built with TypeScript and React
- Pocket TTS HTTP and CLI integration
- Raycast view command mode with form interface
- Temporary and persistent file storage options
