// HTML audio preview generator
// Produces a self-contained HTML with embedded base64 audio + waveform canvas

/**
 * Generate an HTML preview for a sound effect or track.
 * @param {string} name - Sound name
 * @param {object} meta - Metadata (duration, steps, etc.)
 * @param {Buffer} wavBuffer - The compiled WAV file buffer
 * @returns {string} Complete HTML file
 */
export function generatePreviewHTML(name, meta, wavBuffer) {
  const base64 = wavBuffer.toString('base64');
  const durationStr = meta.duration ? meta.duration.toFixed(2) + 's' : '?';
  const infoLine = meta.bpm
    ? `${meta.bpm} BPM · ${Object.keys(meta.channels || {}).length} channels · ${durationStr}`
    : `${meta.wave || 'square'} · ${meta.steps?.length || 0} steps · ${durationStr}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${name} — soundtidus preview</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #1a1a2e;
    color: #e0e0e0;
    font-family: monospace;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: 20px;
  }
  h1 { font-size: 16px; color: #888; font-weight: normal; }
  canvas {
    border: 1px solid #333;
    border-radius: 4px;
    background: #12121e;
  }
  .controls {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  button {
    background: #333;
    color: #e0e0e0;
    border: 1px solid #555;
    padding: 8px 20px;
    font-family: monospace;
    font-size: 14px;
    cursor: pointer;
    border-radius: 3px;
  }
  button:hover { background: #444; }
  button.active { background: #4a6; color: #fff; border-color: #4a6; }
  .info { font-size: 12px; color: #666; }
  .speed-control {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #888;
  }
  input[type="range"] { width: 80px; accent-color: #4a6; }
</style>
</head>
<body>

<h1>soundtidus — ${name}</h1>

<canvas id="waveform" width="600" height="150"></canvas>

<div class="controls">
  <button id="playBtn" onclick="togglePlay()">Play</button>
  <div class="speed-control">
    <span>Speed:</span>
    <input type="range" id="speedSlider" min="0.25" max="2" step="0.25" value="1" oninput="setSpeed(this.value)">
    <span id="speedLabel">1x</span>
  </div>
</div>

<div class="info">${infoLine}</div>

<script>
const audioData = 'data:audio/wav;base64,${base64}';
const canvas = document.getElementById('waveform');
const ctx = canvas.getContext('2d');

let audio = new Audio(audioData);
let playing = false;
let animFrame = null;

// Decode and draw waveform
fetch(audioData)
  .then(r => r.arrayBuffer())
  .then(buf => {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx.decodeAudioData(buf);
  })
  .then(decoded => {
    const data = decoded.getChannelData(0);
    drawWaveform(data);
  });

function drawWaveform(data) {
  const w = canvas.width;
  const h = canvas.height;
  const mid = h / 2;

  ctx.fillStyle = '#12121e';
  ctx.fillRect(0, 0, w, h);

  // Grid lines
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, mid); ctx.lineTo(w, mid);
  ctx.stroke();

  // Waveform
  ctx.strokeStyle = '#4a6';
  ctx.lineWidth = 1.5;
  ctx.beginPath();

  const step = Math.max(1, Math.floor(data.length / w));
  for (let x = 0; x < w; x++) {
    const idx = Math.floor(x * data.length / w);
    // Find min/max in this window for anti-aliasing
    let min = 1, max = -1;
    for (let j = 0; j < step; j++) {
      const val = data[idx + j] || 0;
      if (val < min) min = val;
      if (val > max) max = val;
    }
    const y1 = mid - max * mid * 0.9;
    const y2 = mid - min * mid * 0.9;
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
  }
  ctx.stroke();

  // Store for playhead drawing
  canvas._waveData = data;
}

function drawPlayhead() {
  if (!canvas._waveData || !playing) return;
  const data = canvas._waveData;
  const progress = audio.currentTime / audio.duration;
  if (isNaN(progress)) return;

  drawWaveform(data);

  // Playhead line
  const x = Math.floor(progress * canvas.width);
  ctx.strokeStyle = '#e74c3c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, canvas.height);
  ctx.stroke();

  if (playing) animFrame = requestAnimationFrame(drawPlayhead);
}

function togglePlay() {
  if (playing) {
    audio.pause();
    playing = false;
    document.getElementById('playBtn').textContent = 'Play';
    document.getElementById('playBtn').classList.remove('active');
    if (animFrame) cancelAnimationFrame(animFrame);
  } else {
    if (audio.ended || audio.currentTime >= audio.duration) {
      audio.currentTime = 0;
    }
    audio.play();
    playing = true;
    document.getElementById('playBtn').textContent = 'Pause';
    document.getElementById('playBtn').classList.add('active');
    drawPlayhead();
  }
}

audio.addEventListener('ended', () => {
  playing = false;
  document.getElementById('playBtn').textContent = 'Play';
  document.getElementById('playBtn').classList.remove('active');
  if (canvas._waveData) drawWaveform(canvas._waveData);
});

function setSpeed(val) {
  audio.playbackRate = parseFloat(val);
  document.getElementById('speedLabel').textContent = val + 'x';
}
</script>

</body>
</html>`;
}
