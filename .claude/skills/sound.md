---
name: sound
description: Generate retro game sound effects and music using the soundtidus .sound/.track format
user_invocable: true
---

# Sound Generation Skill

You are generating retro game audio for the soundtidus engine. You write `.sound` or `.track` files and compile them to WAV.

## .sound Format (SFX)
```
name: sound_name
wave: square          # square, triangle, sawtooth, noise, sine
duty: 50              # duty cycle for square wave (%)
volume: 1.0

envelope:
  attack   5ms
  decay    10ms
  sustain  0.8
  release  40ms

steps:
  C5  80ms
  E5  80ms  vol:0.8
  G5  120ms duty:25  fx:vibrato 6 0.5
  C6  200ms fx:slide G6
```

## .track Format (Music)
```
name: track_name
bpm: 140
rows_per_beat: 4

channel: pulse1
  wave: square
  duty: 50
  volume: 0.8
  envelope:
    attack 5ms
    decay 20ms
    sustain 0.7
    release 50ms

pattern: verse
  pulse1    | pulse2    | bass      | drums
  C5        | E4        | C2        | noise
  ...       | ...       | ...       | ---
  E5        | G4        | E2        | noise
  ...       | ...       | ...       | ---

song:
  verse
  verse
```

## Rules

1. **Notes**: Standard notation C0-B8, sharps (#), flats (b). Also: `rest`, `noise`, raw Hz (`440hz`)
2. **Durations**: `ms` (milliseconds) or `s` (seconds)
3. **`...`** in tracks = continue previous note, **`---`** = note off
4. **Envelope**: attack/decay/release in ms, sustain is 0.0-1.0
5. **Effects**: `fx:vibrato RATE DEPTH`, `fx:slide TARGET_NOTE`, `fx:arpeggio NOTE1 NOTE2`
6. **Multiple sounds** in one file separated by `---`

## Common SFX Recipes

- **Jump**: rising square wave, fast C4→E4→G4→C5→E5→G5, 30-50ms per step
- **Coin**: two quick notes B5→E6, square duty:25, 60+120ms
- **Explosion**: descending noise, decreasing volume, 50-150ms steps
- **Power-up**: rising arpeggio with vibrato on final notes
- **Hurt**: fast descending square, low duty (12.5), 30-50ms
- **Laser**: fast descending sawtooth with fx:slide
- **Menu select**: triangle, quick two-note up (A5→E6)
- **Menu back**: triangle, quick two-note down (E6→A5)

## Workflow

1. Write `.sound` file to `sounds/` or `.track` file to `tracks/`
2. Compile:
   ```bash
   node src/cli.js compile sounds/<name>.sound --out output/
   node src/cli.js track tracks/<name>.track --out output/
   ```
3. Preview: open `output/<name>_preview.html` in browser
4. For bulk compile: `node src/cli.js compile sounds/ --out output/`
