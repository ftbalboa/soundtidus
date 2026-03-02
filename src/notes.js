// Note-to-frequency conversion
// Equal temperament tuning, A4 = 440 Hz

const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/**
 * Convert a note name to frequency in Hz.
 * Supports: C4, D#5, Bb3, 440hz, rest, noise
 * @param {string} note
 * @returns {number} Frequency in Hz (0 for rest, -1 for noise)
 */
export function noteToFreq(note) {
  if (note === 'rest') return 0;
  if (note === 'noise') return -1;

  const hzMatch = note.match(/^(\d+(?:\.\d+)?)hz$/i);
  if (hzMatch) return parseFloat(hzMatch[1]);

  const match = note.match(/^([A-G])(#|b)?(\d)$/);
  if (!match) throw new Error(`Invalid note: "${note}"`);

  const [, name, accidental, octaveStr] = match;
  let semitone = SEMITONES[name];
  if (accidental === '#') semitone += 1;
  if (accidental === 'b') semitone -= 1;

  const octave = parseInt(octaveStr, 10);
  const midiNote = (octave + 1) * 12 + semitone;

  // A4 = MIDI 69 = 440 Hz
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}
