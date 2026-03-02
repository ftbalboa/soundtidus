# soundtidus

Retro game audio compiler. Sound is just bytes — no audio AI, no DAWs, no dependencies.

## Stack
- Node.js (zero npm dependencies)
- WAV encoder built from scratch (RIFF header + PCM 16-bit)
- Custom `.sound` and `.track` text formats
- Synthesizer with square, triangle, sawtooth, noise (LFSR), sine waveforms

## Project Structure
```
src/
  cli.js      — CLI entry point (compile, track, preview commands)
  wav.js      — Raw WAV encoder (RIFF + PCM 16-bit LE)
  synth.js    — Waveform generation, ADSR envelopes, effects
  parser.js   — .sound and .track format parsers
  preview.js  — HTML audio preview with waveform visualization
  notes.js    — Note-to-frequency table (equal temperament, A4=440Hz)
sounds/       — Source .sound definitions
tracks/       — Source .track definitions
output/       — Compiled WAVs, metadata, previews
```

## Commands
```bash
node src/cli.js compile sounds/ --out output/
node src/cli.js track tracks/theme.track --out output/
node src/cli.js preview sounds/jump.sound --out output/
```

## Key Conventions
- `.sound` files define SFX with steps (note + duration sequences)
- `.track` files define multi-channel music (channels, patterns, song arrangement)
- ADSR envelopes shape amplitude over time
- Effects: vibrato, pitch slide, arpeggio
- Triangle waves quantized to 16 levels (NES-authentic)
- Noise uses 15-bit LFSR (NES-authentic)
- Use the `/sound` skill to generate new sounds
