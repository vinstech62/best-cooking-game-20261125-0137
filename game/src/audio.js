// All sound is synthesised in the browser with WebAudio: short blips for picking
// up and plating, a chop thock, a grill sizzle from filtered noise, a serve ding
// and a fail buzz. No audio files, no network. Sound starts on the first gesture.

export function createAudio() {
  let context = null;
  let muted = false;
  let sizzleNodes = null;

  function ensure() {
    if (context === null) {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor();
    }
    if (context.state === 'suspended') void context.resume();
    return context;
  }

  function blip(frequency, duration, type, gainValue, slideTo) {
    if (muted) return;
    const ctx = ensure();
    if (ctx === null) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
    gain.gain.setValueAtTime(gainValue, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (!muted) ensure();
      return muted;
    },
    get muted() {
      return muted;
    },
    pickup() {
      blip(520, 0.08, 'sine', 0.12, 780);
    },
    place() {
      blip(300, 0.07, 'triangle', 0.12, 220);
    },
    chop() {
      blip(180, 0.06, 'square', 0.08, 90);
    },
    ding() {
      blip(880, 0.25, 'sine', 0.15);
      setTimeout(() => blip(1320, 0.35, 'sine', 0.12), 90);
    },
    buzz() {
      blip(140, 0.3, 'sawtooth', 0.1, 90);
    },
    expire() {
      blip(220, 0.4, 'sawtooth', 0.1, 110);
    },
    /** A soft looping sizzle while any patty is on the grill; silent otherwise. */
    setSizzle(on) {
      const ctx = ensure();
      if (ctx === null) return;
      if (on && sizzleNodes === null) {
        const length = ctx.sampleRate * 1;
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 5200;
        filter.Q.value = 0.6;
        const gain = ctx.createGain();
        gain.gain.value = muted ? 0 : 0.035;
        source.connect(filter).connect(gain).connect(ctx.destination);
        source.start();
        sizzleNodes = { source, gain };
      } else if (!on && sizzleNodes !== null) {
        try {
          sizzleNodes.source.stop();
        } catch {
          // Already stopped: nothing to do.
        }
        sizzleNodes = null;
      } else if (sizzleNodes !== null) {
        sizzleNodes.gain.gain.value = muted ? 0 : 0.035;
      }
    },
  };
}
