// Procedural sound: everything is synthesised with the Web Audio API, no audio files.
// The context starts on the first key press, since browsers block audio until then.

const MASTER_VOLUME = 0.5;

export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let drone = null;
  let crackleTimer = null;
  let torchRadius = 8;
  let muted = loadMuted();

  function loadMuted() {
    try {
      return localStorage.getItem("sr.muted") === "1";
    } catch {
      return false;
    }
  }

  function start() {
    if (ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_VOLUME;
    const compressor = ctx.createDynamicsCompressor();
    master.connect(compressor).connect(ctx.destination);

    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    startDrone();
    scheduleCrackle();
  }

  // A low, breathing drone whose pitch sinks as you go deeper.
  function startDrone() {
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 320;
    const a = ctx.createOscillator();
    const b = ctx.createOscillator();
    a.type = "sawtooth";
    b.type = "sine";
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain).connect(filter.frequency);
    a.connect(filter);
    b.connect(filter);
    filter.connect(gain).connect(master);
    a.start();
    b.start();
    lfo.start();
    drone = { a, b };
    setDepth(1);
  }

  function setDepth(depth) {
    if (!drone) return;
    const base = 55 / (1 + (depth - 1) * 0.06);
    drone.a.frequency.setTargetAtTime(base, ctx.currentTime, 1.5);
    drone.b.frequency.setTargetAtTime(base * 1.498, ctx.currentTime, 1.5);
  }

  // Torch crackle: random pops, busier with a bigger flame, silent when it's out.
  function scheduleCrackle() {
    const delay = torchRadius > 0 ? 40 + Math.random() * (900 / torchRadius) : 400;
    crackleTimer = setTimeout(() => {
      if (torchRadius > 0 && Math.random() < 0.8) {
        noise({ duration: 0.012 + Math.random() * 0.03, gain: 0.02 + Math.random() * 0.03, filter: 1800 + Math.random() * 3000, q: 0.8 });
      }
      scheduleCrackle();
    }, delay);
  }

  function envelope(node, { attack = 0.005, peak = 0.3, duration = 0.2, at = 0 }) {
    const t = ctx.currentTime + at;
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak, t + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    return t;
  }

  function tone({ freq = 440, to = null, type = "sine", duration = 0.2, gain = 0.2, at = 0, attack = 0.005 }) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    const t = envelope(g, { attack, peak: gain, duration, at });
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + duration);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  function noise({ duration = 0.2, gain = 0.2, filter = 1000, to = null, q = 1, type = "bandpass", at = 0, attack = 0.003 }) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    const g = ctx.createGain();
    const t = envelope(g, { attack, peak: gain, duration, at });
    f.frequency.setValueAtTime(filter, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + duration);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + duration + 0.05);
  }

  const SOUNDS = {
    step: () => noise({ duration: 0.05, gain: 0.05, filter: 500 + Math.random() * 300, q: 2 }),
    hit: (e) => {
      if (e.by === "player") {
        tone({ freq: e.sneak ? 900 : 520, to: 140, type: "square", duration: 0.09, gain: 0.08 });
        noise({ duration: 0.08, gain: 0.18, filter: 2400, q: 1.2 });
        if (e.killed) tone({ freq: 90, to: 40, type: "sine", duration: 0.35, gain: 0.35, at: 0.02 });
      } else if (e.by === "fire") {
        noise({ duration: 0.25, gain: 0.15, filter: 2500, q: 0.6 });
      } else {
        tone({ freq: 160, to: 55, type: "sawtooth", duration: 0.25, gain: 0.22 });
        noise({ duration: 0.18, gain: 0.25, filter: 600, q: 0.7 });
      }
    },
    heal: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: "sine", duration: 0.35, gain: 0.07, at: i * 0.06 })),
    pickup: (e) => {
      if (e.kind === "oil") noise({ duration: 0.3, gain: 0.12, filter: 400, to: 1600, q: 3 });
      else tone({ freq: 880, to: 1320, type: "triangle", duration: 0.15, gain: 0.12 });
      if (e.kind === "bones") [220, 262, 330].forEach((f, i) => tone({ freq: f, duration: 1.2, gain: 0.06, at: i * 0.15 }));
    },
    brazier: () => {
      noise({ duration: 0.9, gain: 0.3, filter: 200, to: 3000, q: 0.6, attack: 0.08 });
      tone({ freq: 110, to: 220, type: "sine", duration: 0.9, gain: 0.1, attack: 0.1 });
    },
    torch: (e) => noise({ duration: e.lit ? 0.4 : 0.6, gain: 0.2, filter: e.lit ? 300 : 3000, to: e.lit ? 2500 : 200, q: 0.8 }),
    descend: () => {
      tone({ freq: 440, to: 110, type: "triangle", duration: 1.2, gain: 0.12 });
      tone({ freq: 660, to: 165, type: "sine", duration: 1.4, gain: 0.06, at: 0.1 });
    },
    fall: () => {
      noise({ duration: 0.9, gain: 0.25, filter: 3000, to: 150, q: 0.5 });
      tone({ freq: 70, to: 30, type: "sine", duration: 0.5, gain: 0.5, at: 0.8 });
    },
    windup: () => tone({ freq: 80, to: 320, type: "sawtooth", duration: 0.6, gain: 0.08, attack: 0.3 }),
    smash: () => {
      tone({ freq: 60, to: 25, type: "sine", duration: 0.6, gain: 0.6 });
      noise({ duration: 0.4, gain: 0.4, filter: 300, q: 0.5 });
    },
    notice: () => {
      tone({ freq: 740, type: "triangle", duration: 0.12, gain: 0.07 });
      tone({ freq: 988, type: "triangle", duration: 0.2, gain: 0.07, at: 0.1 });
    },
    relic: () => [392, 494, 587, 784, 988].forEach((f, i) => tone({ freq: f, type: "sine", duration: 1.6, gain: 0.05, at: i * 0.07, attack: 0.05 })),
    death: () => {
      tone({ freq: 220, to: 55, type: "sawtooth", duration: 2.5, gain: 0.15, attack: 0.02 });
      tone({ freq: 110, to: 36, type: "sine", duration: 3, gain: 0.25 });
    },
    rest: () => {
      const notes = [659, 784, 988, 1175, 1319];
      tone({ freq: notes[Math.floor(Math.random() * notes.length)], type: "sine", duration: 1.4, gain: 0.05, attack: 0.02 });
      noise({ duration: 0.3, gain: 0.05, filter: 2200, q: 0.8 });
    },
    warmed: () => {
      [262, 330, 392, 494, 523, 659].forEach((f, i) => tone({ freq: f, type: "sine", duration: 3, gain: 0.05, at: i * 0.18, attack: 0.1 }));
      noise({ duration: 2.5, gain: 0.12, filter: 300, to: 1200, q: 0.5, attack: 0.4 });
    },
    faint: () => [523, 440, 392, 330, 262].forEach((f, i) => tone({ freq: f, type: "sine", duration: 1.6, gain: 0.06, at: i * 0.35, attack: 0.05 })),
    wake: () => [392, 523, 659].forEach((f, i) => tone({ freq: f, type: "triangle", duration: 1.2, gain: 0.05, at: i * 0.15, attack: 0.05 })),
    throw: () => {
      noise({ duration: 0.45, gain: 0.25, filter: 800, to: 2600, q: 1.5, attack: 0.02 });
      tone({ freq: 300, to: 120, type: "triangle", duration: 0.4, gain: 0.06, at: 0.3 });
    },
    restart: () => tone({ freq: 196, to: 392, type: "sine", duration: 0.8, gain: 0.1, attack: 0.2 }),
    ignite: () => {
      noise({ duration: 1.2, gain: 0.3, filter: 300, to: 4000, q: 0.5, attack: 0.05 });
      tone({ freq: 90, to: 60, type: "sawtooth", duration: 1, gain: 0.06 });
    },
    win: () =>
      [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) =>
        tone({ freq: f, type: i % 2 ? "triangle" : "sine", duration: 2.5, gain: 0.07, at: i * 0.12, attack: 0.08 }),
      ),
  };

  return {
    start,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      try {
        localStorage.setItem("sr.muted", muted ? "1" : "0");
      } catch {}
      if (master) master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, ctx.currentTime, 0.05);
      return muted;
    },
    play(effects) {
      if (!ctx || muted) return;
      for (const e of effects) SOUNDS[e.type]?.(e);
    },
    setDepth,
    setTorch(radius) {
      torchRadius = radius;
    },
    stop() {
      clearTimeout(crackleTimer);
      ctx?.close();
    },
  };
}
