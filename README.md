# soundtidus

Retro game audio compiler. Sound is just bytes — no DAWs, no audio AI, no npm dependencies.

Built entirely with Node.js and a from-scratch WAV encoder. Waveforms generated sample by sample.

## How it works

You write `.sound` files — text files that describe sounds as note sequences:

```
name: coin

wave: square
duty: 25

envelope:
  attack   2ms
  decay    20ms
  sustain  0.7
  release  80ms

steps:
  B5  60ms
  E6  120ms
```

Then compile to WAV:

```bash
node src/cli.js compile sounds/coin.sound --out output/
```

Text in, audio out.

## Examples

Every `.sound` file below was compiled with this CLI. Click **play** to hear the result — each preview includes waveform visualization and playback controls.

### coin — [play](https://ftbalboa.github.io/soundtidus/coin.html)

Bright two-tone collect. Square wave, fast attack.

```
name: coin
wave: square
duty: 25

envelope:
  attack   2ms
  decay    20ms
  sustain  0.7
  release  80ms

steps:
  B5  60ms
  E6  120ms
```

### jump — [play](https://ftbalboa.github.io/soundtidus/jump.html)

Platformer jump. Rising arpeggio with duty cycle shift at the top.

```
name: jump
wave: square
duty: 50

envelope:
  attack   5ms
  decay    10ms
  sustain  0.8
  release  40ms

steps:
  E4  30ms
  G4  30ms
  B4  30ms
  E5  30ms
  G5  40ms
  B5  50ms  duty:25
  E6  80ms  duty:25
```

### explosion — [play](https://ftbalboa.github.io/soundtidus/explosion.html)

Noise sweep down with volume fade.

```
name: explosion
wave: noise

envelope:
  attack   5ms
  decay    80ms
  sustain  0.4
  release  200ms

steps:
  800hz  50ms   vol:1.0
  600hz  60ms   vol:0.9
  400hz  70ms   vol:0.7
  200hz  100ms  vol:0.5
  100hz  120ms  vol:0.3
  50hz   150ms  vol:0.1
```

### laser — [play](https://ftbalboa.github.io/soundtidus/laser.html)

Fast descending pew. Sawtooth with pitch slide.

```
name: laser
wave: sawtooth

envelope:
  attack   2ms
  decay    10ms
  sustain  0.6
  release  30ms

steps:
  C7  40ms  fx:slide C5
  rest 10ms
  C6  50ms  vol:0.5  fx:slide C4
```

### powerup — [play](https://ftbalboa.github.io/soundtidus/powerup.html)

Rising arpeggio with vibrato at the peak.

```
name: powerup
wave: square
duty: 50

envelope:
  attack   5ms
  decay    15ms
  sustain  0.8
  release  100ms

steps:
  C4  40ms
  E4  40ms
  G4  40ms
  C5  40ms
  E5  40ms
  G5  40ms
  C6  60ms  duty:25  fx:vibrato 8 0.3
  E6  80ms  duty:25  fx:vibrato 8 0.3
  G6  120ms duty:25  fx:vibrato 6 0.5
```

### hurt — [play](https://ftbalboa.github.io/soundtidus/hurt.html)

Descending buzz. Narrow pulse width for a harsh tone.

```
name: hurt
wave: square
duty: 12.5

envelope:
  attack   2ms
  decay    30ms
  sustain  0.5
  release  60ms

steps:
  A4  30ms
  F4  30ms
  D4  40ms  vol:0.7
  A3  50ms  vol:0.4
```

### victory_jingle — [play](https://ftbalboa.github.io/soundtidus/victory_jingle.html)

Multi-channel track: 2 pulse waves, triangle bass, noise drums. 150 BPM.

```
name: victory_jingle
bpm: 150
rows_per_beat: 4

channel: pulse1
  wave: square
  duty: 50
  volume: 0.8

channel: tri
  wave: triangle
  volume: 0.6

channel: drums
  wave: noise
  volume: 0.4

pattern: fanfare
  pulse1    | tri       | drums
  C5        | C3        | noise
  ...       | ...       | ---
  G5        | G3        | noise
  ...       | ...       | ---
  E5        | E3        | noise
  F5        | F3        | ---
  G5        | G3        | noise
  ...       | ...       | ---
  C6        | C4        | noise

song:
  fanfare
```

[Browse all previews](https://ftbalboa.github.io/soundtidus/)

## Music

Write `.track` files with multiple channels, tracker-style:

```
name: victory
bpm: 150
rows_per_beat: 4

channel: pulse1
  wave: square
  duty: 50
  volume: 0.8
  envelope:
    attack 5ms
    decay 20ms
    sustain 0.7
    release 80ms

channel: bass
  wave: triangle
  volume: 0.6

pattern: fanfare
  pulse1    | bass
  C5        | C3
  ...       | ...
  E5        | E3
  ...       | ...
  G5        | G3
  ...       | ...
  C6        | C4
  ...       | ...

song:
  fanfare
```

```bash
node src/cli.js track tracks/victory.track --out output/
```

Output: `.wav` + `.json` metadata + interactive `.html` preview.

## Commands

```bash
# Compile sound effects
node src/cli.js compile sounds/jump.sound --out output/
node src/cli.js compile sounds/ --out output/

# Compile music tracks
node src/cli.js track tracks/theme.track --out output/

# Generate HTML preview
node src/cli.js preview sounds/coin.sound --out output/
```

### Options

| Flag | Description | Default |
|---|---|---|
| `--out <path>` | Output directory | `./output/` |
| `--samplerate <n>` | Sample rate in Hz | `44100` |
| `--no-preview` | Skip HTML preview | preview on |

## Waveforms

| Type | Character | Sound |
|---|---|---|
| `square` | Pulse wave with configurable duty cycle | Classic NES lead/bass |
| `triangle` | Quantized to 16 levels (NES-authentic) | Smooth bass, soft lead |
| `sawtooth` | Linear ramp wave | Buzzy, aggressive |
| `noise` | 15-bit LFSR (NES-authentic) | Drums, explosions, SFX |
| `sine` | Pure tone | Clean, modern |

## .sound format reference

```
name: sound_name
wave: square              # waveform type
duty: 50                  # duty cycle for square (%)
volume: 1.0               # master volume

envelope:                 # ADSR amplitude shaping
  attack   5ms
  decay    10ms
  sustain  0.8
  release  40ms

steps:                    # note sequence
  C5  80ms                # note duration
  E5  80ms  vol:0.8       # per-step volume override
  G5  120ms duty:25       # per-step duty override
  C6  200ms fx:vibrato 6 0.5   # effect
  B6  100ms fx:slide G6        # pitch slide to target
```

Notes: `C4`, `D#5`, `Bb3`, `440hz`, `rest`, `noise`

## Requirements

- Node.js 18+
- Zero npm dependencies

## Sister project

[pixelyuna](https://github.com/ftbalboa/pixelyuna) — pixel art sprite compiler using the same philosophy.

## Why

Retro game audio is not music production — it's math. A square wave is a comparison. A triangle is an absolute value. Noise is a shift register. Any code-writing tool can generate these waveforms sample by sample. No Ableton, no FMOD, no sound designers. Just bytes.
