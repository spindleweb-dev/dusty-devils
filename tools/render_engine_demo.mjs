// Renders a short demo of the synthesised V8 the same way the game plays it:
// seamless loops at fixed RPMs, blended and pitched to the current rpm.
// Usage: node tools/render_engine_demo.mjs out.wav [tin=0.35] [bassDb=7] [blower=0.3]
import fs from "node:fs";

const src = fs.readFileSync(new URL("./engine_synth.js", import.meta.url), "utf8");
const code = src.split("// ENGINE-SYNTH-START")[1].split("// ENGINE-SYNTH-END")[0];
const { ENGINE_LOOP_RPMS, makeEngineLoop, engineMix, makeGearbox, gearboxStep, BLOWER_RATIO } =
  new Function(code + "; return { ENGINE_LOOP_RPMS, makeEngineLoop, engineMix, makeGearbox, gearboxStep, BLOWER_RATIO };")();

const sr = 44100;
const TIN = +(process.argv[3] ?? 0.35);   // same default as the game's slider
const loops = ENGINE_LOOP_RPMS.map(r => makeEngineLoop(sr, r));

// drive: idle, two blips standing still, full throttle through the gears,
// lift, brake down through the gears, idle
const throttleOn = t => (t > 2.0 && t < 2.2) || (t > 3.4 && t < 3.6) || (t > 5.0 && t < 11.5);
const braking = t => t > 12.2 && t < 15.5;
const gb = makeGearbox();
let sp = 0;
// RBJ low-shelf, same as the game's "Engine bass boost"
function lowShelf(f0, dB) {
  const A = Math.pow(10, dB / 40), w = 2 * Math.PI * f0 / sr, cs = Math.cos(w), al = Math.sin(w) / 2 * Math.SQRT2, sA = 2 * Math.sqrt(A) * al;
  const a0 = (A + 1) + (A - 1) * cs + sA;
  const b = [A * ((A + 1) - (A - 1) * cs + sA), 2 * A * ((A - 1) - (A + 1) * cs), A * ((A + 1) - (A - 1) * cs - sA)].map(v => v / a0);
  const a = [-2 * ((A - 1) + (A + 1) * cs), (A + 1) + (A - 1) * cs - sA].map(v => v / a0);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return x => { const y = b[0] * x + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}
const BASS = +(process.argv[4] ?? 7);
const BLOW = +(process.argv[5] ?? 0.3);
let bph = 0, blp = 0;
const shelf = lowShelf(140, BASS);
const dur = 18, n = dur * sr;
const out = new Float32Array(n);
const phase = loops.map(() => 0);
let lp = 0, load = 0;
for (let i = 0; i < n; i++) {
  const t = i / sr;
  const thr = throttleOn(t);
  if (i % 64 === 0) {
    const dt = 64 / sr;
    if (thr) sp += 0.42 * Math.max(0, 1 - sp / 1.0) * dt;
    else sp -= (braking(t) ? 0.32 : 0.05) * dt;
    sp = Math.max(0, sp);
    var st = gearboxStep(gb, sp, thr, false, dt);
    if (st.shifted === 1 || st.shifted === -1) console.log(t.toFixed(2) + "s shift " + (st.shifted > 0 ? "up" : "down") + " -> gear " + st.gear);
  }
  const { gains, rates } = engineMix(gb.rpm);
  let s = 0, tin = 0;
  for (let k = 0; k < loops.length; k++) {
    const L = loops[k].body, T = loops[k].tin;
    phase[k] = (phase[k] + rates[k]) % L.length;
    if (gains[k] < 1e-4) continue;
    const p = phase[k], i0 = Math.floor(p), f = p - i0, i1 = (i0 + 1) % L.length;
    s += (L[i0] * (1 - f) + L[i1] * f) * gains[k];
    tin += (T[i0] * (1 - f) + T[i1] * f) * gains[k];
  }
  // on/off throttle: louder and brighter on load (as the game does with a filter)
  load += (st.load - load) * 0.0012;
  const cut = 1500 + load * 3500;
  const a = 1 - Math.exp(-2 * Math.PI * cut / sr);
  lp += (s - lp) * a;
  // supercharger whine, as in the game
  bph = (bph + gb.rpm / 60 * BLOWER_RATIO / sr) % 1;
  const tri = 1 - 4 * Math.abs(bph - 0.5), oct = Math.sin(4 * Math.PI * bph) * 0.35;
  blp += ((tri + oct) - blp) * (1 - Math.exp(-2 * Math.PI * 2600 / sr));
  const whine = blp * BLOW * (0.015 + 0.045 * load) * (0.4 + gb.rpm / 5400) / 0.5;
  out[i] = (shelf(lp) * (0.65 + load * 0.35) + tin * TIN * (0.4 + load * 0.6) + whine) * 0.55;
}

const buf = Buffer.alloc(44 + n * 2);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(out[i] * 32767))), 44 + i * 2);
fs.writeFileSync(process.argv[2] || "engine_demo.wav", buf);
console.log("wrote", process.argv[2] || "engine_demo.wav");
