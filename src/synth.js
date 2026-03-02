// Retro audio synthesizer
// Waveform generation, ADSR envelopes, effects

import { noteToFreq } from './notes.js';

// --- Waveform generators ---
// Each takes a phase (0.0-1.0) and returns a sample (-1.0 to 1.0)

function squareWave(phase, duty = 0.5) {
  return phase < duty ? 1.0 : -1.0;
}

function triangleWave(phase) {
  // Quantized to 16 levels like NES 4-bit DAC
  const raw = phase < 0.5 ? (4.0 * phase - 1.0) : (3.0 - 4.0 * phase);
  return Math.round(raw * 7.5) / 7.5;
}

function sawtoothWave(phase) {
  return 2.0 * phase - 1.0;
}

function sineWave(phase) {
  return Math.sin(2.0 * Math.PI * phase);
}

// Noise via 15-bit LFSR (linear feedback shift register) like NES
function createNoiseState() {
  return { lfsr: 0x7FFF, timer: 0 };
}

function noiseWave(state, period) {
  state.timer++;
  if (state.timer >= period) {
    state.timer = 0;
    const feedback = (state.lfsr ^ (state.lfsr >> 1)) & 1;
    state.lfsr = (state.lfsr >> 1) | (feedback << 14);
  }
  return (state.lfsr & 1) ? 1.0 : -1.0;
}

function getWaveformFn(type) {
  switch (type) {
    case 'square': return squareWave;
    case 'triangle': return triangleWave;
    case 'sawtooth': return sawtoothWave;
    case 'sine': return sineWave;
    default: return squareWave;
  }
}

// --- ADSR Envelope ---

const DEFAULT_ENVELOPE = {
  attack: 0.005,
  decay: 0.02,
  sustain: 0.8,
  release: 0.05,
};

function getEnvelopeGain(time, duration, env) {
  const { attack, decay, sustain, release } = env;
  const noteOff = Math.max(0, duration - release);

  if (time < attack) {
    return attack > 0 ? time / attack : 1.0;
  } else if (time < attack + decay) {
    const t = (time - attack) / (decay || 0.001);
    return 1.0 - t * (1.0 - sustain);
  } else if (time < noteOff) {
    return sustain;
  } else {
    const t = (time - noteOff) / (release || 0.001);
    return sustain * Math.max(0, 1.0 - t);
  }
}

// --- Effects ---

function applyVibrato(frequency, time, rate, depth) {
  const modulation = Math.sin(2.0 * Math.PI * rate * time) * depth;
  return frequency * Math.pow(2, modulation / 12);
}

function applySlide(startFreq, targetFreq, time, duration) {
  const t = Math.min(time / duration, 1.0);
  return startFreq + (targetFreq - startFreq) * t;
}

function applyArpeggio(baseFreq, note1Freq, note2Freq, time) {
  const cycle = Math.floor(time * 50) % 3; // 50Hz cycle rate
  if (cycle === 0) return baseFreq;
  if (cycle === 1) return note1Freq;
  return note2Freq;
}

// --- Main synthesis ---

/**
 * Synthesize a parsed sound definition into PCM samples.
 * @param {object} sound - Parsed sound from parser.js
 * @param {number} sampleRate
 * @returns {Float32Array}
 */
export function synthesizeSound(sound, sampleRate = 44100) {
  const envelope = { ...DEFAULT_ENVELOPE, ...sound.envelope };
  const globalWave = sound.wave || 'square';
  const globalDuty = (sound.duty || 50) / 100;
  const globalVolume = sound.volume ?? 1.0;

  // Calculate total duration
  let totalDuration = 0;
  for (const step of sound.steps) {
    totalDuration += step.duration;
  }
  // Add release tail
  totalDuration += envelope.release;

  const totalSamples = Math.ceil(totalDuration * sampleRate);
  const samples = new Float32Array(totalSamples);

  let phase = 0;
  let sampleOffset = 0;
  const noiseState = createNoiseState();

  for (const step of sound.steps) {
    const waveType = step.wave || globalWave;
    const duty = (step.duty != null ? step.duty : sound.duty || 50) / 100;
    const volume = (step.volume != null ? step.volume : globalVolume);
    const waveFn = getWaveformFn(waveType);
    const isNoise = waveType === 'noise' || step.note === 'noise';
    const isRest = step.note === 'rest';

    let baseFreq = isNoise ? 440 : noteToFreq(step.note);
    if (isRest) baseFreq = 0;

    // Parse effects
    let slideTarget = null;
    let vibratoRate = 0, vibratoDepth = 0;
    let arp1 = 0, arp2 = 0;

    for (const fx of (step.effects || [])) {
      if (fx.type === 'slide') {
        slideTarget = noteToFreq(fx.target);
      } else if (fx.type === 'vibrato') {
        vibratoRate = fx.rate;
        vibratoDepth = fx.depth;
      } else if (fx.type === 'arpeggio') {
        arp1 = noteToFreq(fx.note1);
        arp2 = noteToFreq(fx.note2);
      }
    }

    const stepSamples = Math.ceil(step.duration * sampleRate);
    const stepWithRelease = stepSamples + Math.ceil(envelope.release * sampleRate);

    for (let i = 0; i < stepWithRelease; i++) {
      const idx = sampleOffset + i;
      if (idx >= totalSamples) break;

      const time = i / sampleRate;

      if (isRest) continue; // silence

      // Calculate effective frequency with effects
      let freq = baseFreq;
      if (slideTarget != null) {
        freq = applySlide(baseFreq, slideTarget, time, step.duration);
      }
      if (vibratoRate > 0) {
        freq = applyVibrato(freq, time, vibratoRate, vibratoDepth);
      }
      if (arp1 > 0) {
        freq = applyArpeggio(freq, arp1, arp2, time);
      }

      // Generate sample
      let sample;
      if (isNoise) {
        const period = Math.max(1, Math.round(sampleRate / (freq * 2)));
        sample = noiseWave(noiseState, period);
      } else {
        phase += freq / sampleRate;
        phase -= Math.floor(phase); // wrap to 0-1
        sample = waveFn(phase, duty);
      }

      // Apply envelope and volume
      const envGain = getEnvelopeGain(time, step.duration + envelope.release, envelope);
      sample *= envGain * volume;

      // Additive mix (for overlapping release tails)
      samples[idx] += sample;
    }

    sampleOffset += stepSamples;
  }

  // Clamp
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.max(-1, Math.min(1, samples[i]));
  }

  return samples;
}

/**
 * Synthesize a parsed track into PCM samples.
 * Renders each channel independently, then mixes.
 * @param {object} track - Parsed track from parser.js
 * @param {number} sampleRate
 * @returns {Float32Array}
 */
export function synthesizeTrack(track, sampleRate = 44100) {
  const { bpm, rowsPerBeat, channels, patterns, song } = track;
  const rowDuration = 60 / bpm / rowsPerBeat; // seconds per row

  // Expand song into flat rows per channel
  const channelNames = Object.keys(channels);
  const expandedRows = {}; // channelName -> [cell, cell, ...]
  for (const name of channelNames) expandedRows[name] = [];

  for (const patternName of song) {
    const pattern = patterns[patternName];
    if (!pattern) throw new Error(`Unknown pattern: "${patternName}"`);

    for (const row of pattern.rows) {
      for (let c = 0; c < pattern.channelOrder.length; c++) {
        const chName = pattern.channelOrder[c];
        if (expandedRows[chName]) {
          expandedRows[chName].push(row[c] || '---');
        }
      }
    }
  }

  const totalRows = Math.max(...Object.values(expandedRows).map(r => r.length));
  const totalDuration = totalRows * rowDuration + 0.1; // extra for release
  const totalSamples = Math.ceil(totalDuration * sampleRate);

  // Synthesize each channel
  const channelBuffers = [];

  for (const chName of channelNames) {
    const ch = channels[chName];
    const rows = expandedRows[chName] || [];
    const buffer = new Float32Array(totalSamples);
    const envelope = { ...DEFAULT_ENVELOPE, ...ch.envelope };
    const waveFn = getWaveformFn(ch.wave || 'square');
    const duty = (ch.duty || 50) / 100;
    const isNoiseChannel = ch.wave === 'noise';
    const noiseState = createNoiseState();

    let phase = 0;
    let currentFreq = 0;
    let noteOn = false;
    let noteStartSample = 0;

    for (let row = 0; row < rows.length; row++) {
      const cell = rows[row].trim();
      const rowStartSample = Math.floor(row * rowDuration * sampleRate);

      if (cell === '...') {
        // Continue current note — do nothing
      } else if (cell === '---' || cell === 'rest') {
        noteOn = false;
      } else {
        // New note
        const freq = isNoiseChannel ? 440 : noteToFreq(cell === 'noise' ? 'A4' : cell);
        currentFreq = freq;
        noteOn = true;
        noteStartSample = rowStartSample;
      }

      if (!noteOn && cell !== '...') continue;
      if (currentFreq <= 0 && !isNoiseChannel) continue;

      // Render this row's samples
      const rowEndSample = Math.min(
        Math.floor((row + 1) * rowDuration * sampleRate),
        totalSamples
      );

      for (let i = rowStartSample; i < rowEndSample; i++) {
        const noteTime = (i - noteStartSample) / sampleRate;

        let sample;
        if (isNoiseChannel) {
          const period = Math.max(1, Math.round(sampleRate / 880));
          sample = noiseWave(noiseState, period);
        } else {
          phase += currentFreq / sampleRate;
          phase -= Math.floor(phase);
          sample = waveFn(phase, duty);
        }

        // Envelope from note start
        const envGain = noteOn
          ? getEnvelopeGain(noteTime, rowDuration * 4, envelope) // sustain across multiple rows
          : 0;

        buffer[i] = sample * envGain * (ch.volume ?? 0.8);
      }
    }

    channelBuffers.push(buffer);
  }

  // Mix all channels
  const mixed = new Float32Array(totalSamples);
  for (const buf of channelBuffers) {
    for (let i = 0; i < buf.length; i++) {
      mixed[i] += buf[i];
    }
  }

  // Normalize to prevent clipping
  let peak = 0;
  for (let i = 0; i < mixed.length; i++) {
    peak = Math.max(peak, Math.abs(mixed[i]));
  }
  if (peak > 0.95) {
    const scale = 0.9 / peak;
    for (let i = 0; i < mixed.length; i++) {
      mixed[i] *= scale;
    }
  }

  return mixed;
}
