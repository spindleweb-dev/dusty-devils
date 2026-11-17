// Renders a short demo of the synthesised V8 the same way the game plays it:
// seamless loops at fixed RPMs, blended and pitched to the current rpm.
// Usage: node tools/render_engine_demo.mjs out.wav
import fs from "node:fs";

const src = fs.readFileSync(new URL("./engine_synth.js", import.meta.url), "utf8");
const code = src.split("// ENGINE-SYNTH-START")[1].split("// ENGINE-SYNTH-END")[0];
const { ENGINE_LOOP_RPMS, makeEngineLoop, engineMix } =
  new Function(code + "; return { ENGINE_LOOP_RPMS, makeEngineLoop, engineMix };")();

const sr = 44100;
const loops = ENGINE_LOOP_RPMS.map(r => makeEngineLoop(sr, r));

// rpm profile: idle, two blips, a run up through the revs, lift off, idle
const keys = [[0, 800], [2.0, 800], [2.25, 3600], [2.7, 900], [3.6, 900], [3.85, 4200], [4.4, 950],
  [5.5, 950], [9.5, 6200], [9.9, 6300], [11.2, 1100], [12.5, 820], [14, 800]];
const throttleOn = t => (t > 2.0 && t < 2.25) || (t > 3.6 && t < 3.85) || (t > 5.5 && t < 9.9);
function rpmAt(t) {
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, r0] = keys[i], [t1, r1] = keys[i + 1];
    if (t <= t1) { const f = (t - t0) / (t1 - t0); return r0 + (r1 - r0) * (f * f * (3 - 2 * f)); }
  }
  return keys[keys.length - 1][1];
}

const dur = 14, n = dur * sr;
const out = new Float32Array(n);
const phase = loops.map(() => 0);
let lp = 0, load = 0;
for (let i = 0; i < n; i++) {
  const t = i / sr;
  const { gains, rates } = engineMix(rpmAt(t));
  let s = 0;
  for (let k = 0; k < loops.length; k++) {
    const L = loops[k];
    phase[k] = (phase[k] + rates[k]) % L.length;
    if (gains[k] < 1e-4) continue;
    const p = phase[k], i0 = Math.floor(p), f = p - i0;
    s += (L[i0] * (1 - f) + L[(i0 + 1) % L.length] * f) * gains[k];
  }
  // on/off throttle: louder and brighter on load (as the game does with a filter)
  load += ((throttleOn(t) ? 1 : 0) - load) * 0.0004;
  const cut = 1800 + load * 5000;
  const a = 1 - Math.exp(-2 * Math.PI * cut / sr);
  lp += (s - lp) * a;
  out[i] = lp * (0.65 + load * 0.35) * 0.9;
}

const buf = Buffer.alloc(44 + n * 2);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(out[i] * 32767))), 44 + i * 2);
fs.writeFileSync(process.argv[2] || "engine_demo.wav", buf);
console.log("wrote", process.argv[2] || "engine_demo.wav");
