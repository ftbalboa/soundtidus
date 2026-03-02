#!/usr/bin/env node

// soundtidus CLI — compile .sound and .track files to WAV

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { parseSoundFile, parseTrack } from './parser.js';
import { synthesizeSound, synthesizeTrack } from './synth.js';
import { encodeWAV } from './wav.js';
import { generatePreviewHTML } from './preview.js';

function usage() {
  console.log(`
soundtidus — retro game audio compiler

Usage:
  soundtidus compile <file|dir> [options]    Compile .sound files to WAV
  soundtidus track <file|dir> [options]      Compile .track files to WAV
  soundtidus preview <file> [options]        Generate HTML preview with playback

Options:
  --out <path>           Output directory (default: ./output/)
  --samplerate <n>       Sample rate in Hz (default: 44100)
  --no-preview           Skip HTML preview generation

Examples:
  soundtidus compile sounds/jump.sound --out output/
  soundtidus compile sounds/ --out output/
  soundtidus track tracks/theme.track --out output/
  soundtidus preview sounds/coin.sound --out output/
`);
}

function parseArgs(args) {
  const opts = { out: './output/', sampleRate: 44100, preview: true };
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out' && args[i + 1]) {
      opts.out = args[++i];
    } else if (args[i] === '--samplerate' && args[i + 1]) {
      opts.sampleRate = parseInt(args[++i], 10);
    } else if (args[i] === '--no-preview') {
      opts.preview = false;
    } else if (!args[i].startsWith('--')) {
      positional.push(args[i]);
    }
  }

  return { ...opts, positional };
}

function loadSounds(pathArg) {
  const sounds = [];
  const resolved = resolve(pathArg);

  if (!existsSync(resolved)) {
    console.error(`Error: "${pathArg}" not found.`);
    process.exit(1);
  }

  try {
    const entries = readdirSync(resolved);
    for (const entry of entries) {
      if (extname(entry) === '.sound') {
        const source = readFileSync(join(resolved, entry), 'utf-8');
        sounds.push(...parseSoundFile(source));
      }
    }
  } catch {
    const source = readFileSync(resolved, 'utf-8');
    sounds.push(...parseSoundFile(source));
  }

  return sounds;
}

function loadTracks(pathArg) {
  const tracks = [];
  const resolved = resolve(pathArg);

  if (!existsSync(resolved)) {
    console.error(`Error: "${pathArg}" not found.`);
    process.exit(1);
  }

  try {
    const entries = readdirSync(resolved);
    for (const entry of entries) {
      if (extname(entry) === '.track') {
        const source = readFileSync(join(resolved, entry), 'utf-8');
        tracks.push(parseTrack(source));
      }
    }
  } catch {
    const source = readFileSync(resolved, 'utf-8');
    tracks.push(parseTrack(source));
  }

  return tracks;
}

function compileCommand(args) {
  const opts = parseArgs(args);
  const input = opts.positional[0];

  if (!input) {
    console.error('Error: specify a .sound file or directory.');
    process.exit(1);
  }

  const sounds = loadSounds(input);
  const outDir = opts.out;
  mkdirSync(outDir, { recursive: true });

  for (const sound of sounds) {
    const samples = synthesizeSound(sound, opts.sampleRate);
    const wav = encodeWAV(samples, opts.sampleRate);

    const wavPath = join(outDir, `${sound.name}.wav`);
    writeFileSync(wavPath, wav);

    // Metadata
    let totalDuration = 0;
    for (const step of sound.steps) totalDuration += step.duration;
    totalDuration += (sound.envelope?.release || 0.05);

    const meta = {
      name: sound.name,
      duration: totalDuration,
      sampleRate: opts.sampleRate,
      samples: samples.length,
      wave: sound.wave,
      duty: sound.duty,
      envelope: sound.envelope,
      steps: sound.steps.map(s => ({
        note: s.note,
        duration: s.duration,
        ...(s.effects?.length ? { effects: s.effects } : {}),
      })),
    };

    const metaPath = join(outDir, `${sound.name}.json`);
    writeFileSync(metaPath, JSON.stringify(meta, null, 2));

    console.log(`  ${sound.name} → ${wavPath} (${totalDuration.toFixed(2)}s)`);

    // Preview
    if (opts.preview) {
      const html = generatePreviewHTML(sound.name, meta, wav);
      const htmlPath = join(outDir, `${sound.name}_preview.html`);
      writeFileSync(htmlPath, html);
    }
  }

  console.log(`\nCompiled ${sounds.length} sound(s).`);
}

function trackCommand(args) {
  const opts = parseArgs(args);
  const input = opts.positional[0];

  if (!input) {
    console.error('Error: specify a .track file or directory.');
    process.exit(1);
  }

  const tracks = loadTracks(input);
  const outDir = opts.out;
  mkdirSync(outDir, { recursive: true });

  for (const track of tracks) {
    const samples = synthesizeTrack(track, opts.sampleRate);
    const wav = encodeWAV(samples, opts.sampleRate);

    const wavPath = join(outDir, `${track.name}.wav`);
    writeFileSync(wavPath, wav);

    const duration = samples.length / opts.sampleRate;

    const meta = {
      name: track.name,
      duration,
      sampleRate: opts.sampleRate,
      samples: samples.length,
      bpm: track.bpm,
      rowsPerBeat: track.rowsPerBeat,
      channels: track.channels,
      patterns: Object.keys(track.patterns),
      song: track.song,
    };

    const metaPath = join(outDir, `${track.name}.json`);
    writeFileSync(metaPath, JSON.stringify(meta, null, 2));

    const html = generatePreviewHTML(track.name, meta, wav);
    const htmlPath = join(outDir, `${track.name}_preview.html`);
    writeFileSync(htmlPath, html);

    console.log(`  ${track.name} → ${wavPath} (${duration.toFixed(2)}s, ${track.song.length} patterns)`);
    console.log(`  ${track.name} → ${metaPath}`);
    console.log(`  ${track.name} → ${htmlPath}`);
  }

  console.log(`\nCompiled ${tracks.length} track(s).`);
}

function previewCommand(args) {
  const opts = parseArgs(args);
  const input = opts.positional[0];

  if (!input) {
    console.error('Error: specify a .sound or .track file.');
    process.exit(1);
  }

  const outDir = opts.out;
  mkdirSync(outDir, { recursive: true });

  const ext = extname(input);
  if (ext === '.track') {
    const source = readFileSync(resolve(input), 'utf-8');
    const track = parseTrack(source);
    const samples = synthesizeTrack(track, opts.sampleRate);
    const wav = encodeWAV(samples, opts.sampleRate);
    const duration = samples.length / opts.sampleRate;
    const meta = { name: track.name, duration, bpm: track.bpm, channels: track.channels };
    const html = generatePreviewHTML(track.name, meta, wav);
    const htmlPath = join(outDir, `${track.name}_preview.html`);
    writeFileSync(htmlPath, html);
    console.log(`  Preview → ${htmlPath}`);
  } else {
    const sounds = loadSounds(input);
    for (const sound of sounds) {
      const samples = synthesizeSound(sound, opts.sampleRate);
      const wav = encodeWAV(samples, opts.sampleRate);
      let totalDuration = 0;
      for (const step of sound.steps) totalDuration += step.duration;
      const meta = { name: sound.name, duration: totalDuration, wave: sound.wave, steps: sound.steps };
      const html = generatePreviewHTML(sound.name, meta, wav);
      const htmlPath = join(outDir, `${sound.name}_preview.html`);
      writeFileSync(htmlPath, html);
      console.log(`  Preview → ${htmlPath}`);
    }
  }
}

// Main
const args = process.argv.slice(2);
const command = args[0];

if (!command || command === '--help' || command === '-h') {
  usage();
} else if (command === 'compile') {
  compileCommand(args.slice(1));
} else if (command === 'track') {
  trackCommand(args.slice(1));
} else if (command === 'preview') {
  previewCommand(args.slice(1));
} else {
  console.error(`Unknown command: "${command}". Use --help for usage.`);
  process.exit(1);
}
