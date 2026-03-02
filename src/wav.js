// WAV encoder from scratch — zero dependencies
// WAV spec: PCM format, RIFF container

/**
 * Encode PCM sample data into a WAV file buffer.
 * @param {Float32Array} samples - PCM samples normalized -1.0 to 1.0
 * @param {number} sampleRate - Sample rate in Hz (default: 44100)
 * @param {number} numChannels - 1 = mono, 2 = stereo (default: 1)
 * @returns {Buffer} Complete WAV file buffer
 */
export function encodeWAV(samples, sampleRate = 44100, numChannels = 1) {
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const fileSize = 44 + dataSize;

  const buf = Buffer.alloc(fileSize);

  // RIFF header
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(fileSize - 8, 4);
  buf.write('WAVE', 8, 'ascii');

  // fmt subchunk
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);            // subchunk size (16 for PCM)
  buf.writeUInt16LE(1, 20);             // audio format (1 = PCM)
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);

  // data subchunk
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataSize, 40);

  // PCM samples — float to 16-bit signed integer
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const int16 = Math.round(clamped * 32767);
    buf.writeInt16LE(int16, 44 + i * 2);
  }

  return buf;
}
