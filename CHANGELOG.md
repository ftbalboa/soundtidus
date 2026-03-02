# Changelog

## [0.1.0] - 2026-03-02

### Added
- **WAV encoder from scratch** — zero dependencies, RIFF header + PCM 16-bit LE.
- **`.sound` text format** — define SFX as note/duration sequences with palettes of waveforms.
- **`.track` text format** — multi-channel music with channels, patterns, and song arrangement (tracker-style).
- **Synthesizer engine** — square (with duty cycle), triangle (NES 4-bit quantized), sawtooth, noise (15-bit LFSR), sine waveforms.
- **ADSR envelope** — attack, decay, sustain, release shaping.
- **Effects** — vibrato, pitch slide, arpeggio.
- **CLI commands**: `compile` (SFX → WAV), `track` (music → WAV), `preview` (→ HTML).
- **HTML audio preview** — embedded base64 audio, canvas waveform visualization, playhead, speed control.
- **Claude Code skill** (`/sound`) — invoke from any conversation to generate sounds with full format context.
- **Example sounds**: jump, coin, explosion, powerup, hurt, laser.
- **Example track**: victory jingle (4-channel chiptune).
