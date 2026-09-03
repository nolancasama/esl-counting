/* ============================================================
   GHOST COUNT — synthesized supernatural sound engine
   Every sound is made with WebAudio. No audio files are used.
   ============================================================ */
'use strict';

const Sfx = (() => {
  let context = null;
  let master = null;
  let noiseBuffer = null;
  let volume = 0.7;
  let muted = false;
  let ambience = null;

  function ensure() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!context) {
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : volume;
      master.connect(context.destination);
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
    return context;
  }

  function getNoiseBuffer() {
    if (noiseBuffer) return noiseBuffer;
    noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = noiseBuffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < samples.length; index += 1) {
      const white = Math.random() * 2 - 1;
      previous = previous * 0.96 + white * 0.04;
      samples[index] = previous * 3.2;
    }
    return noiseBuffer;
  }

  function tone(options = {}) {
    if (!ensure()) return;
    const now = context.currentTime + (options.when || 0);
    const duration = options.duration || 0.18;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = options.type || 'sine';
    oscillator.frequency.setValueAtTime(options.frequency || 440, now);
    if (options.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(24, options.endFrequency), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(options.gain || 0.14, now + Math.min(0.025, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.04);
  }

  function noise(options = {}) {
    if (!ensure()) return;
    const now = context.currentTime + (options.when || 0);
    const duration = options.duration || 0.2;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = getNoiseBuffer();
    source.loop = true;
    filter.type = options.filterType || 'bandpass';
    filter.frequency.setValueAtTime(options.frequency || 1200, now);
    if (options.endFrequency) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(24, options.endFrequency), now + duration);
    }
    filter.Q.value = options.q || 0.8;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(options.gain || 0.1, now + Math.min(0.03, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
    source.stop(now + duration + 0.04);
  }

  function ambienceStart() {
    if (ambience || !ensure()) return;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const shimmer = context.createOscillator();
    const shimmerGain = context.createGain();
    source.buffer = getNoiseBuffer();
    source.loop = true;
    filter.type = 'lowpass';
    filter.frequency.value = 540;
    gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(0.065, context.currentTime + 0.8);
    shimmer.type = 'sine';
    shimmer.frequency.value = 116;
    shimmerGain.gain.value = 0.018;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(master);
    source.start();
    shimmer.start();
    ambience = { source, shimmer, gain, shimmerGain };
  }

  function ambienceStop(fade = 0.45) {
    if (!ambience || !context) return;
    const active = ambience;
    ambience = null;
    const now = context.currentTime;
    active.gain.gain.cancelScheduledValues(now);
    active.gain.gain.setValueAtTime(Math.max(0.0001, active.gain.gain.value), now);
    active.gain.gain.exponentialRampToValueAtTime(0.0001, now + fade);
    active.shimmerGain.gain.setValueAtTime(Math.max(0.0001, active.shimmerGain.gain.value), now);
    active.shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + fade);
    active.source.stop(now + fade + 0.05);
    active.shimmer.stop(now + fade + 0.05);
  }

  const api = {
    getCtx: ensure,
    unlock: ensure,
    click() {
      tone({ frequency: 760, endFrequency: 980, duration: 0.055, type: 'triangle', gain: 0.07 });
    },
    shutter() {
      noise({ frequency: 2800, endFrequency: 680, duration: 0.105, gain: 0.2, q: 1.6 });
      tone({ frequency: 125, endFrequency: 72, duration: 0.12, type: 'triangle', gain: 0.13, when: 0.035 });
    },
    chime() {
      [659, 880, 1175].forEach((frequency, index) => {
        tone({ frequency, duration: 0.28, type: 'sine', gain: 0.12, when: index * 0.075 });
      });
    },
    sparkle() {
      [1047, 1397, 1760].forEach((frequency, index) => {
        tone({ frequency, duration: 0.18, type: 'sine', gain: 0.08, when: index * 0.055 });
      });
    },
    materialize(index = 0) {
      noise({ frequency: 360, endFrequency: 2100, duration: 0.55, gain: 0.075, q: 2, when: index * 0.01 });
      tone({ frequency: 185 + index * 9, endFrequency: 510 + index * 14, duration: 0.48, gain: 0.07 });
    },
    vanish() {
      noise({ frequency: 2400, endFrequency: 420, duration: 0.32, gain: 0.1, q: 1.7 });
      tone({ frequency: 760, endFrequency: 160, duration: 0.3, type: 'triangle', gain: 0.08 });
    },
    count(number = 1) {
      const base = 480 + Math.min(10, Math.max(1, number)) * 42;
      tone({ frequency: base, endFrequency: base * 1.18, duration: 0.13, type: 'triangle', gain: 0.12 });
      tone({ frequency: base * 2, duration: 0.09, type: 'sine', gain: 0.045, when: 0.045 });
    },
    result() {
      [523, 659, 784, 1047].forEach((frequency, index) => {
        tone({ frequency, duration: index === 3 ? 0.5 : 0.2, type: 'triangle', gain: 0.13, when: index * 0.11 });
      });
    },
    evolution() {
      [196, 247, 294, 392, 494, 659, 988].forEach((frequency, index) => {
        tone({ frequency, endFrequency: frequency * 1.08, duration: 0.5, type: index < 3 ? 'triangle' : 'sine', gain: 0.095, when: index * 0.17 });
      });
      noise({ frequency: 280, endFrequency: 3600, duration: 1.4, gain: 0.075 });
    },
    whoosh() {
      noise({ frequency: 380, endFrequency: 2500, duration: 0.38, gain: 0.13, q: 1.2 });
    },
    ambienceStart,
    ambienceStop,
    setVolume(value) {
      volume = Number.isFinite(Number(value)) ? Math.min(1, Math.max(0, Number(value))) : volume;
      if (master && context) master.gain.setTargetAtTime(muted ? 0 : volume, context.currentTime, 0.025);
      return volume;
    },
    getVolume: () => volume,
    setMuted(value) {
      muted = value === true;
      if (master && context) master.gain.setTargetAtTime(muted ? 0 : volume, context.currentTime, 0.025);
      if (muted) ambienceStop(0.1);
    },
    isMuted: () => muted,
  };

  return api;
})();
