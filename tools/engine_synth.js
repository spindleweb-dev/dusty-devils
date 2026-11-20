// ============================================================
//  V8 engine synthesiser (original, no recordings)
//  Shared by the game (copied into index.html between the
//  ENGINE-SYNTH markers) and by tools/render_engine_demo.mjs.
//
//  How it works:
//   * A cross-plane V8 fires every 90° of crank in the order
//     1-8-4-3-6-5-7-2. Odd cylinders are on the left bank, even
//     on the right, so each bank's exhaust gets UNEVEN pulses.
//     That unevenness is the classic V8 burble.
//   * Each firing is a short pressure pulse (fast rise, decay)
//     with a little combustion noise. Cylinders differ slightly
//     in strength, which gives the lumpy idle.
//   * Each bank goes through its own exhaust-pipe resonances,
//     the right bank slightly delayed (longer pipe), then both
//     go through a muffler low-pass and gentle saturation.
//   * A separate thin "tin" layer: the raw pulses ring a few
//     narrow high resonances (2.7 / 3.9 / 5.3 kHz), like thin
//     steel pipe and tips. It is returned on its own so the game
//     can mix it in at any level, phase-locked to the body.
//   * makeEngineLoop() renders a seamless loop at a fixed RPM:
//     a whole number of engine cycles, pulses wrapped around
//     the loop end, and the filters run over three copies so
//     the middle copy is in steady state.
// ============================================================
// ENGINE-SYNTH-START
const ENGINE_LOOP_RPMS = [580, 1200, 2100, 3100, 4200, 5400];   // big, low-revving monster engine

function engineHash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function makeBiquad(type, f, q, sr) {
  const w = 2 * Math.PI * f / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === "lp") { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
  else if (type === "hp") { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
  else { b0 = al; b1 = 0; b2 = -al; }                 // band-pass, 0 dB peak
  const a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
  const c = [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return x => {
    const y = c[0] * x + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

function makeEngineLoop(sr, rpm, seed = 7) {
  const cycleSec = 120 / rpm;                          // two crank turns
  // near idle: big-cam lope, so make the loop longer so the lumpiness doesn't repeat too obviously
  const idleness = Math.max(0, Math.min(1, (1500 - rpm) / 900));
  const cycles = Math.max(4, Math.round((1.1 + 1.1 * idleness) / cycleSec));
  const n = Math.round(cycles * cycleSec * sr);
  const fires = cycles * 8;
  const ORDER = [1, 8, 4, 3, 6, 5, 7, 2];
  const lope = 0.07 + 0.3 * idleness;                  // idle is far lumpier than high revs
  const cylAmp = [];
  for (let c = 1; c <= 8; c++) cylAmp[c] = 1 + (engineHash(seed, c) - 0.5) * 2 * lope;
  // cam overlap makes a couple of cylinders lazy at idle, which gives the loping "lump-lump" beat
  cylAmp[3] *= 1 - 0.38 * idleness;
  cylAmp[6] *= 1 - 0.22 * idleness;

  // excitation for each bank, wrapped so the loop is seamless
  const ex = [new Float32Array(n), new Float32Array(n)];
  // near idle, pulses are shorter and ring less, so each cylinder is heard separately
  const width = Math.max(0.0016, (60 / rpm) * (0.11 - 0.045 * idleness)) * sr;   // pulse length in samples
  const decay = 3.2 + 2.4 * idleness;
  for (let k = 0; k < fires; k++) {
    const cyl = ORDER[k % 8];
    const bank = cyl % 2 ? 0 : 1;
    const jitT = (engineHash(seed + 11, k) - 0.5) * (0.0003 + 0.0016 * idleness) * sr;
    const start = k / fires * n + jitT;
    const amp = cylAmp[cyl] * (1 + (engineHash(seed + 23, k) - 0.5) * (0.12 + 0.3 * idleness));
    const len = Math.ceil(width * 4);
    for (let j = 0; j < len; j++) {
      const x = j / width;
      const shape = x < 0.18 ? x / 0.18 : Math.exp(-(x - 0.18) * decay);
      const grit = (engineHash(k * 977 + seed, j) - 0.5) * 0.45 * Math.exp(-x * 1.6);
      const idx = ((Math.floor(start) + j) % n + n) % n;
      ex[bank][idx] += amp * (shape + grit);
    }
  }

  // exhaust: each bank has its own pipe resonances
  const banks = [
    { res: [[56, 2.2, 1.3], [128, 3.0, 0.6], [400, 4.5, 0.12]], delay: 0 },
    { res: [[52, 2.2, 1.3], [140, 3.0, 0.6], [375, 4.5, 0.12]], delay: Math.round(0.0015 * sr) }
  ];
  const bright = 520 + rpm * 0.28;          // darker muffler = deeper tone
  const drive = 1.4 + rpm / 4000;
  const out = new Float32Array(n);
  const total = n * 3;
  const fil = banks.map(b => ({ bp: b.res.map(([f, q, g]) => [makeBiquad("bp", f, q * (1 - 0.3 * idleness), sr), g]), lp: makeBiquad("lp", 320, 0.7, sr), delay: b.delay }));
  const muffler = makeBiquad("lp", bright, 0.9, sr);
  const tinOut = new Float32Array(n);
  const tinHp = makeBiquad("hp", 1600, 0.7, sr);
  const tinBands = [[2700, 9, 1.0], [3900, 11, 0.7], [5300, 12, 0.4]].map(([f, q, g]) => [makeBiquad("bp", f, q, sr), g]);
  const muffler2 = makeBiquad("lp", bright * 1.6, 0.7, sr);
  const hp = makeBiquad("hp", 24, 0.7, sr);
  for (let i = 0; i < total; i++) {
    let s = 0;
    for (let b = 0; b < 2; b++) {
      const F = fil[b];
      const x = ex[b][((i - F.delay) % n + n) % n];
      let y = F.lp(x) * 1.1;                      // chesty low thump of each pulse
      for (const [f, g] of F.bp) y += f(x) * g * 2.2;
      s += y;
    }
    // tin layer from both banks' raw pulses
    const raw = ex[0][i % n] + ex[1][((i - fil[1].delay) % n + n) % n];
    const h = tinHp(raw);
    let tn = 0;
    for (const [bf, g] of tinBands) tn += bf(h) * g;
    if (i >= n && i < 2 * n) tinOut[i - n] = Math.tanh(tn * 1.5);
    s = hp(muffler2(muffler(s)));
    s = Math.tanh(s * drive * 0.6);
    if (i >= n && i < 2 * n) out[i - n] = s;
  }
  // normalise loudness (RMS) so the loops crossfade evenly
  let ss = 0;
  for (let i = 0; i < n; i++) ss += out[i] * out[i];
  const g = 0.32 / Math.sqrt(ss / n);
  let peak = 0;
  for (let i = 0; i < n; i++) { out[i] *= g; peak = Math.max(peak, Math.abs(out[i])); }
  if (peak > 0.98) for (let i = 0; i < n; i++) out[i] *= 0.98 / peak;
  // tin layer: scaled to a fixed level relative to the body (amount 1 = clearly audible)
  let ts = 0;
  for (let i = 0; i < n; i++) ts += tinOut[i] * tinOut[i];
  const tg = 0.08 / Math.sqrt(ts / n || 1);
  for (let i = 0; i < n; i++) tinOut[i] *= tg;
  return { body: out, tin: tinOut };
}

// Given the current rpm, which two loops to blend, how much of each, and
// the playback rate that brings each loop to exactly that rpm.
function engineMix(rpm) {
  const R = ENGINE_LOOP_RPMS;
  const r = Math.max(R[0] * 0.8, Math.min(R[R.length - 1] * 1.15, rpm));
  let i = 0;
  while (i < R.length - 2 && r > R[i + 1]) i++;
  const f = Math.max(0, Math.min(1, (r - R[i]) / (R[i + 1] - R[i])));
  const gains = R.map(() => 0);
  gains[i] = Math.cos(f * Math.PI / 2);
  gains[i + 1] = Math.sin(f * Math.PI / 2);
  return { gains, rates: R.map(x => r / x) };
}

// ---- Pretend gearbox (sound only) ----
// speed (0..1.2 of top speed) -> gear and engine rpm. Upshifts near the
// red line (~5000 rpm) with a short power cut; downshifts with a throttle blip.
// The supercharger whine is a separate live layer: pitch = rpm / 60 * BLOWER_RATIO.
const BLOWER_RATIO = 14;
const GEAR_TOPS = [0.32, 0.55, 0.8, 1.2];   // speed reached at the red line in each gear
function makeGearbox() { return { gear: 0, rpm: 580, cut: 0, blip: 0, shifted: 0, since: 1 }; }
function gearboxStep(g, sp, thr, boost, dt) {
  const inGear = i => 800 + Math.max(0, sp) / GEAR_TOPS[i] * 4500;
  g.shifted = 0;
  g.since += dt;
  if (g.cut > 0) g.cut -= dt;
  else if (thr && g.rpm > 5000 && g.gear < GEAR_TOPS.length - 1) { g.gear++; g.cut = 0.16; g.shifted = 1; g.since = 0; }
  else if (g.gear > 0 && g.since > 0.35 && inGear(g.gear) < (thr ? 2200 : 1400)) { g.gear--; g.cut = 0.1; g.blip = 0.16; g.shifted = -1; g.since = 0; }
  let target = inGear(g.gear);
  if (g.gear === 0 && thr && sp < 0.12) target = Math.max(target, 2000 + sp * 8000);   // launch / wheelspin
  if (g.gear === 0 && !thr && sp < 0.06) target = 580;                                 // clutch in, idling
  if (boost) target += 400;
  if (g.blip > 0) { g.blip -= dt; target += 700; }
  target = Math.max(560, Math.min(5900, target));
  const rate = g.cut > 0 ? 14 : target > g.rpm ? 6 : 3;
  g.rpm += (target - g.rpm) * Math.min(1, dt * rate);
  const load = g.blip > 0 || (thr && g.cut <= 0) ? 1 : 0;
  return { rpm: g.rpm, load, gear: g.gear + 1, shifted: g.shifted };
}
// ENGINE-SYNTH-END
