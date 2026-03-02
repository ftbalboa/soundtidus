// Sound and track definition parser
// Formats: .sound (SFX) and .track (music)

/**
 * Parse a duration string to seconds.
 * Supports: 100ms, 0.5s
 */
function parseDuration(str) {
  const match = str.match(/^(\d+(?:\.\d+)?)(ms|s)$/);
  if (!match) throw new Error(`Invalid duration: "${str}"`);
  const value = parseFloat(match[1]);
  if (match[2] === 'ms') return value / 1000;
  return value;
}

/**
 * Parse a step line's inline overrides and effects.
 * Format: NOTE DURATION [wave:TYPE] [duty:N] [vol:N] [fx:EFFECT PARAMS...]
 */
function parseStepTokens(tokens) {
  const step = {
    note: tokens[0],
    duration: parseDuration(tokens[1]),
    wave: null,
    duty: null,
    volume: null,
    effects: [],
  };

  let i = 2;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.startsWith('wave:')) {
      step.wave = t.slice(5);
    } else if (t.startsWith('duty:')) {
      step.duty = parseFloat(t.slice(5));
    } else if (t.startsWith('vol:')) {
      step.volume = parseFloat(t.slice(4));
    } else if (t.startsWith('fx:')) {
      const fxType = t.slice(3);
      if (fxType === 'vibrato' && tokens[i + 1] && tokens[i + 2]) {
        step.effects.push({
          type: 'vibrato',
          rate: parseFloat(tokens[i + 1]),
          depth: parseFloat(tokens[i + 2]),
        });
        i += 2;
      } else if (fxType === 'slide' && tokens[i + 1]) {
        step.effects.push({ type: 'slide', target: tokens[i + 1] });
        i += 1;
      } else if (fxType === 'arpeggio' && tokens[i + 1] && tokens[i + 2]) {
        step.effects.push({
          type: 'arpeggio',
          note1: tokens[i + 1],
          note2: tokens[i + 2],
        });
        i += 2;
      }
    }
    i++;
  }

  return step;
}

/**
 * Parse a .sound file block into structured data.
 * @param {string} source
 * @returns {object} { name, wave, duty, volume, envelope, steps }
 */
export function parseSound(source) {
  const lines = source.split(/\r?\n/);
  let name = 'sound';
  let wave = 'square';
  let duty = 50;
  let volume = 1.0;
  let sampleRate = 44100;
  const envelope = {};
  const steps = [];
  let section = null; // 'envelope' | 'steps'

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    // Section headers
    if (line.match(/^envelope:\s*$/i)) { section = 'envelope'; continue; }
    if (line.match(/^steps:\s*$/i)) { section = 'steps'; continue; }

    // Directives
    const nameMatch = line.match(/^name:\s*(.+)$/i);
    if (nameMatch) { name = nameMatch[1].trim(); continue; }

    const waveMatch = line.match(/^wave:\s*(.+)$/i);
    if (waveMatch) { wave = waveMatch[1].trim(); continue; }

    const dutyMatch = line.match(/^duty:\s*(.+)$/i);
    if (dutyMatch) { duty = parseFloat(dutyMatch[1]); continue; }

    const volMatch = line.match(/^volume:\s*(.+)$/i);
    if (volMatch) { volume = parseFloat(volMatch[1]); continue; }

    const srMatch = line.match(/^samplerate:\s*(.+)$/i);
    if (srMatch) { sampleRate = parseInt(srMatch[1], 10); continue; }

    // Envelope params
    if (section === 'envelope') {
      const trimmed = line.trim();
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2) {
        const key = parts[0].toLowerCase();
        if (key === 'sustain') {
          envelope[key] = parseFloat(parts[1]);
        } else {
          envelope[key] = parseDuration(parts[1]);
        }
      }
      continue;
    }

    // Steps
    if (section === 'steps') {
      const trimmed = line.trim();
      const tokens = trimmed.split(/\s+/);
      if (tokens.length >= 2) {
        steps.push(parseStepTokens(tokens));
      }
      continue;
    }
  }

  if (steps.length === 0) {
    throw new Error('No steps defined. Add a "steps:" section with notes.');
  }

  return { name, wave, duty, volume, sampleRate, envelope, steps };
}

/**
 * Parse a .sound file that may contain multiple sounds (separated by ---).
 * @param {string} source
 * @returns {Array}
 */
export function parseSoundFile(source) {
  const blocks = source.split(/^---\s*$/m);
  return blocks
    .filter(b => b.trim().length > 0)
    .map(block => parseSound(block));
}

/**
 * Parse a .track file into structured data.
 * @param {string} source
 * @returns {object} { name, bpm, rowsPerBeat, channels, patterns, song }
 */
export function parseTrack(source) {
  const lines = source.split(/\r?\n/);
  let name = 'track';
  let bpm = 120;
  let rowsPerBeat = 4;
  const channels = {};
  const patterns = {};
  const song = [];

  let section = null;      // 'channel' | 'pattern' | 'song'
  let currentChannel = null;
  let currentPattern = null;
  let channelEnvSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    // Top-level directives
    const nameMatch = line.match(/^name:\s*(.+)$/i);
    if (nameMatch) { name = nameMatch[1].trim(); continue; }

    const bpmMatch = line.match(/^bpm:\s*(\d+)$/i);
    if (bpmMatch) { bpm = parseInt(bpmMatch[1], 10); continue; }

    const rpbMatch = line.match(/^rows_per_beat:\s*(\d+)$/i);
    if (rpbMatch) { rowsPerBeat = parseInt(rpbMatch[1], 10); continue; }

    // Channel definition
    const channelMatch = line.match(/^channel:\s*(.+)$/i);
    if (channelMatch) {
      currentChannel = channelMatch[1].trim();
      channels[currentChannel] = { wave: 'square', duty: 50, volume: 0.8, envelope: {} };
      section = 'channel';
      channelEnvSection = false;
      continue;
    }

    // Pattern definition
    const patternMatch = line.match(/^pattern:\s*(.+)$/i);
    if (patternMatch) {
      currentPattern = patternMatch[1].trim();
      patterns[currentPattern] = { channelOrder: [], rows: [] };
      section = 'pattern';
      continue;
    }

    // Song section
    if (line.match(/^song:\s*$/i)) { section = 'song'; continue; }

    // Channel properties
    if (section === 'channel' && currentChannel) {
      const trimmed = line.trim();

      if (trimmed.match(/^envelope:\s*$/i)) {
        channelEnvSection = true;
        continue;
      }

      if (channelEnvSection) {
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 2) {
          const key = parts[0].toLowerCase();
          if (key === 'sustain') {
            channels[currentChannel].envelope[key] = parseFloat(parts[1]);
          } else {
            channels[currentChannel].envelope[key] = parseDuration(parts[1]);
          }
        }
        continue;
      }

      const wMatch = trimmed.match(/^wave:\s*(.+)$/i);
      if (wMatch) { channels[currentChannel].wave = wMatch[1].trim(); continue; }

      const dMatch = trimmed.match(/^duty:\s*(.+)$/i);
      if (dMatch) { channels[currentChannel].duty = parseFloat(dMatch[1]); continue; }

      const vMatch = trimmed.match(/^volume:\s*(.+)$/i);
      if (vMatch) { channels[currentChannel].volume = parseFloat(vMatch[1]); continue; }
    }

    // Pattern rows
    if (section === 'pattern' && currentPattern) {
      const trimmed = line.trim();
      const cells = trimmed.split(/\s*\|\s*/);

      // First row with channel names = header
      if (patterns[currentPattern].channelOrder.length === 0) {
        // Check if this looks like a header (channel names, not notes)
        const isHeader = cells.every(c => /^[a-z_][a-z0-9_]*$/i.test(c.trim()));
        if (isHeader) {
          patterns[currentPattern].channelOrder = cells.map(c => c.trim());
          continue;
        }
      }

      patterns[currentPattern].rows.push(cells.map(c => c.trim()));
      continue;
    }

    // Song arrangement
    if (section === 'song') {
      const trimmed = line.trim();
      if (trimmed) song.push(trimmed);
      continue;
    }
  }

  return { name, bpm, rowsPerBeat, channels, patterns, song };
}
