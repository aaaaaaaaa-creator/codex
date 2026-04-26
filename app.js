const mediaInput = document.getElementById('mediaInput');
const audio = document.getElementById('audio');
const video = document.getElementById('video');
const emptyState = document.getElementById('emptyState');
const presetList = document.getElementById('presetList');

const speed = document.getElementById('speed');
const wet = document.getElementById('wet');
const warmth = document.getElementById('warmth');
const presence = document.getElementById('presence');

const speedOut = document.getElementById('speedOut');
const wetOut = document.getElementById('wetOut');
const warmthOut = document.getElementById('warmthOut');
const presenceOut = document.getElementById('presenceOut');

const presets = [
  { name: 'Tape Dreams', speed: 0.8, wet: 0.44, warmth: 5, presence: 2 },
  { name: 'Night Runner', speed: 0.73, wet: 0.58, warmth: 2, presence: 5 },
  { name: 'Vinyl Lounge', speed: 0.86, wet: 0.36, warmth: 8, presence: -1 },
  { name: 'Neon Cathedral', speed: 0.68, wet: 0.64, warmth: 4, presence: 6 },
  { name: 'Lo-Fi Sunset', speed: 0.9, wet: 0.3, warmth: 7, presence: -2 },
];

const ctx = new AudioContext();
let currentNode = null;
let source = null;

const dryGain = ctx.createGain();
const wetGain = ctx.createGain();
const convolver = ctx.createConvolver();
const warmthEQ = ctx.createBiquadFilter();
const presenceEQ = ctx.createBiquadFilter();

warmthEQ.type = 'lowshelf';
warmthEQ.frequency.value = 260;
presenceEQ.type = 'highshelf';
presenceEQ.frequency.value = 3500;

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

convolver.buffer = makeImpulse();

dryGain.connect(warmthEQ);
convolver.connect(wetGain);
wetGain.connect(warmthEQ);
warmthEQ.connect(presenceEQ);
presenceEQ.connect(ctx.destination);

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

  speedOut.value = `${Number(speed.value).toFixed(2)}x`;
  wetOut.value = `${Math.round(Number(wet.value) * 100)}%`;
  warmthOut.value = `${Number(warmth.value) >= 0 ? '+' : ''}${warmth.value} dB`;
  presenceOut.value = `${Number(presence.value) >= 0 ? '+' : ''}${presence.value} dB`;
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
    currentNode = video;
  } else {
    video.pause();
    video.removeAttribute('src');
    video.hidden = true;
    audio.hidden = false;
    audio.src = url;
    currentNode = audio;
  }

  connectElement(currentNode);
  emptyState.hidden = true;
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
      applyValues();
    });
    presetList.appendChild(btn);
  });
}

[speed, wet, warmth, presence].forEach((el) => {
  el.addEventListener('input', applyValues);
});

mediaInput.addEventListener('change', async (e) => {
  const [file] = e.target.files;
  if (!file) return;
  if (ctx.state === 'suspended') await ctx.resume();
  loadMedia(file);
});

buildPresets();
applyValues();
