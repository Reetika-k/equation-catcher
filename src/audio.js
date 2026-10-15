// Sounds synthesised with the Web Audio API (no audio files). Created on the first user gesture.
const KEY = "equation-catcher.muted";
let ctx = null;
export const audio = {
  muted: (() => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } })(),
  toggle() { this.muted = !this.muted; try { localStorage.setItem(KEY, this.muted ? "1" : "0"); } catch {} return this.muted; },
  unlock() { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; } } if (ctx?.state === "suspended") ctx.resume(); },
  play(name) {
    if (this.muted || !ctx) return;
    const t = ctx.currentTime;
    const tone = (freq, start, dur, type = "sine", gain = 0.18) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t + start);
      g.gain.setValueAtTime(0.0001, t + start); g.gain.exponentialRampToValueAtTime(gain, t + start + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
      o.connect(g).connect(ctx.destination); o.start(t + start); o.stop(t + start + dur + 0.02);
    };
    switch (name) {
      case "catch": tone(660, 0, 0.09); tone(990, 0.08, 0.14); break;
      case "wrong": tone(170, 0, 0.22, "sawtooth", 0.12); break;
      case "bomb": tone(90, 0, 0.35, "sawtooth", 0.16); tone(60, 0.1, 0.35, "square", 0.1); break;
      case "miss": tone(330, 0, 0.06, "triangle", 0.08); break;
      case "levelup": [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.16, "triangle")); break;
      case "win": [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, i * 0.1, 0.22, "triangle")); break;
      case "lose": tone(392, 0, 0.25, "triangle"); tone(262, 0.25, 0.45, "triangle"); break;
    }
  },
};
