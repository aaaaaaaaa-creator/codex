const mediaInput = document.getElementById('mediaInput');
const audio = document.getElementById('audio');
const video = document.getElementById('video');
const emptyState = document.getElementById('emptyState');
const presetList = document.getElementById('presetList');
const mediaBadge = document.getElementById('mediaBadge');
const viz = document.getElementById('viz');
const vctx = viz.getContext('2d');

const speed = document.getElementById('speed');
const wet = document.getElementById('wet');
const warmth = document.getElementById('warmth');
const presence = document.getElementById('presence');
const width = document.getElementById('width');
const drive = document.getElementById('drive');

const speedOut = document.getElementById('speedOut');
const wetOut = document.getElementById('wetOut');
const warmthOut = document.getElementById('warmthOut');
const presenceOut = document.getElementById('presenceOut');
const widthOut = document.getElementById('widthOut');
const driveOut = document.getElementById('driveOut');

const presets = [
  { name: 'Tape Dreams', speed: 0.8, wet: 0.44, warmth: 5, presence: 2, width: 0.25, drive: 0.18 },
  { name: 'Night Runner', speed: 0.73, wet: 0.58, warmth: 2, presence: 5, width: 0.45, drive: 0.22 },
  { name: 'Vinyl Lounge', speed: 0.86, wet: 0.36, warmth: 8, presence: -1, width: 0.18, drive: 0.12 },
  { name: 'Neon Cathedral', speed: 0.68, wet: 0.64, warmth: 4, presence: 6, width: 0.6, drive: 0.3 },
  { name: 'Lo-Fi Sunset', speed: 0.9, wet: 0.3, warmth: 7, presence: -2, width: 0.14, drive: 0.15 },
];

const ctx = new AudioContext();
let source = null;

const dryGain = ctx.createGain();
const wetGain = ctx.createGain();
const convolver = ctx.createConvolver();
const warmthEQ = ctx.createBiquadFilter();
const presenceEQ = ctx.createBiquadFilter();
const stereo = ctx.createStereoPanner();
const shaper = ctx.createWaveShaper();
const analyser = ctx.createAnalyser();

warmthEQ.type = 'lowshelf';
warmthEQ.frequency.value = 260;
presenceEQ.type = 'highshelf';
presenceEQ.frequency.value = 3600;
analyser.fftSize = 256;

function makeImpulse(duration = 2.2, decay = 2.3) {
  const len = ctx.sampleRate * duration;
  const impulse = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < impulse.numberOfChannels; c++) {
    const data = impulse.getChannelData(c);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return impulse;
}

function makeCurve(amount) {
  const n = 256;
  const curve = new Float32Array(n);
  const k = amount * 120;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

convolver.buffer = makeImpulse();

// dry + wet -> EQ -> saturation -> stereo -> analyser -> output
dryGain.connect(warmthEQ);
convolver.connect(wetGain);
wetGain.connect(warmthEQ);
warmthEQ.connect(presenceEQ);
presenceEQ.connect(shaper);
shaper.connect(stereo);
stereo.connect(analyser);
analyser.connect(ctx.destination);

function connectElement(el) {
  if (source) source.disconnect();
  source = ctx.createMediaElementSource(el);
  source.connect(dryGain);
  source.connect(convolver);
}

function getCurrentMedia() {
  if (!audio.hidden && audio.src) return audio;
  if (!video.hidden && video.src) return video;
  return null;
}

function applyValues() {
  const media = getCurrentMedia();
  if (media) media.playbackRate = Number(speed.value);

  wetGain.gain.value = Number(wet.value);
  dryGain.gain.value = 1 - Number(wet.value) * 0.45;
  warmthEQ.gain.value = Number(warmth.value);
  presenceEQ.gain.value = Number(presence.value);
  stereo.pan.value = (Number(width.value) - 0.5) * 0.8;
  shaper.curve = makeCurve(Number(drive.value));
  shaper.oversample = '4x';

  speedOut.value = `${Number(speed.value).toFixed(2)}x`;
  wetOut.value = `${Math.round(Number(wet.value) * 100)}%`;
  warmthOut.value = `${Number(warmth.value) >= 0 ? '+' : ''}${warmth.value} dB`;
  presenceOut.value = `${Number(presence.value) >= 0 ? '+' : ''}${presence.value} dB`;
  widthOut.value = `${Math.round(Number(width.value) * 100)}%`;
  driveOut.value = `${Math.round(Number(drive.value) * 100)}%`;
}

function loadMedia(file) {
  const url = URL.createObjectURL(file);
  const isVideo = file.type.startsWith('video');

  if (isVideo) {
    audio.pause();
    audio.removeAttribute('src');
    audio.hidden = true;
    video.hidden = false;
    video.src = url;
  } else {
    video.pause();
    video.removeAttribute('src');
    video.hidden = true;
    audio.hidden = false;
    audio.src = url;
  }

  connectElement(isVideo ? video : audio);
  emptyState.hidden = true;
  mediaBadge.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
  applyValues();
}

function buildPresets() {
  presets.forEach((preset, idx) => {
    const btn = document.createElement('button');
    btn.className = `preset-btn ${idx === 0 ? 'active' : ''}`;
    btn.textContent = preset.name;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      speed.value = preset.speed;
      wet.value = preset.wet;
      warmth.value = preset.warmth;
      presence.value = preset.presence;
      width.value = preset.width;
      drive.value = preset.drive;
      applyValues();
    });
    presetList.appendChild(btn);
  });
}

function drawViz() {
  requestAnimationFrame(drawViz);
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);

  vctx.clearRect(0, 0, viz.width, viz.height);
  const barW = viz.width / data.length;

  for (let i = 0; i < data.length; i++) {
    const h = (data[i] / 255) * (viz.height - 10);
    const x = i * barW;
    const y = viz.height - h;
    const hue = 280 - i * 1.2;
    vctx.fillStyle = `hsla(${hue}, 95%, 65%, 0.9)`;
    vctx.fillRect(x, y, barW - 1.5, h);
  }
}

[speed, wet, warmth, presence, width, drive].forEach((el) => el.addEventListener('input', applyValues));

mediaInput.addEventListener('change', async (e) => {
  const [file] = e.target.files;
  if (!file) return;
  if (ctx.state === 'suspended') await ctx.resume();
  loadMedia(file);
});

buildPresets();
applyValues();
drawViz();
