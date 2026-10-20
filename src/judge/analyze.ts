/* Measures one hit. Quality rules read the measures; the identity model reads the feature vector. */
import { SR, db, filter, meanPow, power, resample } from './dsp.ts';
import { onsetIndex } from './detector.ts';

export type AnalysisCfg = {
  attackMs: number;     // the burst right after the onset
  bodyMs: number;       // the window after the attack, for punch and body features
  activeDb: number;     // frames within this of the loudest frame count as sound
  endRunMs: number;     // this long below activeDb ends the sound
  lowHz: number;        // "low end" means energy below this
  hfHz: number;         // "hiss" means energy above this
  vowelHf: number;      // a voiced frame with less hiss share than this is vowel-like, otherwise voiced hiss
  vowelFormant: number; // a vowel frame also needs this share of its energy in 300 to 3000 Hz (a kick's boom sits lower)
  airShare: number;     // an unvoiced frame is air only with this share of its energy above 1 kHz (a kick's boom is not air)
  voiceR: number;       // autocorrelation peak (90 to 500 Hz) that counts as voice
  voiceGateDb: number;  // voice only counts when the 150 to 900 Hz band is within this of the loudest frame
};

export type Measures = {
  peakDb: number;       // loudest 23 ms frame, dBFS
  lengthMs: number;     // onset to the end of the sound
  vowelMs: number;      // voiced, vowel-like time after the attack
  airMs: number;        // unvoiced time after the attack
  voicedMs: number;     // voiced time that also carries hiss
  lowDb: number;        // share of attack energy below lowHz, dB
  punchDb: number;      // attack power over the following bodyMs, dB
  centroidKHz: number;  // attack spectral centroid
};

export const HOP_MS = 10;
const HOP = 441, FR = 1024, DEC = 4, VL = 331, LAG_MIN = 22, LAG_MAX = 122; // voicing: 150 to 900 Hz band at 11025 Hz, 30 ms frames, pitch 90 to 500 Hz
const BANDS = [0, 150, 300, 600, 1200, 2400, 4800, 9600, 22050];

function bands(p: Float64Array, n: number): { logs: number[]; centroid: number; total: number } {
  const e = new Array(BANDS.length - 1).fill(0);
  let total = 1e-12, wsum = 0;
  for (let k = 1; k < p.length; k++) {
    const f = k * SR / n;
    total += p[k]; wsum += p[k] * f;
    for (let b = 0; b < e.length; b++) if (f < BANDS[b + 1]) { e[b] += p[k]; break; }
  }
  return { logs: e.map(v => Math.log10(v / total + 1e-6)), centroid: wsum / total / 1000, total };
}

function share(p: Float64Array, n: number, lo: number, hi: number): number {
  let s = 0, t = 1e-12;
  for (let k = 1; k < p.length; k++) { const f = k * SR / n; t += p[k]; if (f >= lo && f < hi) s += p[k]; }
  return s / t;
}

function voicing(d: Float32Array, start: number): number {
  let best = 0;
  for (let lag = LAG_MIN; lag <= LAG_MAX; lag++) {
    let xy = 0, xx = 0, yy = 0;
    for (let n = start; n < start + VL - lag; n++) {
      const a = n >= 0 && n < d.length ? d[n] : 0, b = n + lag >= 0 && n + lag < d.length ? d[n + lag] : 0;
      xy += a * b; xx += a * a; yy += b * b;
    }
    const r = xy / Math.sqrt(xx * yy + 1e-20);
    if (r > best) best = r;
  }
  return best;
}

/** raw: a hit as the detector cuts it, onset at preMs. */
export function analyze(raw: Float32Array, sr: number, preMs: number, cfg: AnalysisCfg): { m: Measures; features: number[] } {
  const x = resample(raw, sr), on = onsetIndex(SR, preMs);
  const lp = filter(filter(x, SR, 900), SR, 150, true), d = new Float32Array(Math.ceil(lp.length / DEC));
  for (let i = 0; i < d.length; i++) d[i] = lp[i * DEC];

  const nFr = Math.max(1, Math.floor((x.length - on - FR) / HOP) + 1);
  const fdb: number[] = [], hf: number[] = [], fm: number[] = [], nz: number[] = [], low: number[] = [], r: number[] = [];
  for (let i = 0; i < nFr; i++) {
    const s = on + i * HOP, p = power(x, s, FR, FR);
    fdb.push(db(meanPow(x, s, s + FR)));
    hf.push(share(p, FR, cfg.hfHz, Infinity));
    fm.push(share(p, FR, 300, 3000));
    nz.push(share(p, FR, 1000, Infinity));
    low.push(db(meanPow(lp, s, s + FR)));
    r.push(voicing(d, Math.round(s / DEC)));
  }
  const peakDb = Math.max(...fdb), top = fdb.indexOf(peakDb);
  const active = fdb.map(v => v > peakDb + cfg.activeDb);
  const run = Math.round(cfg.endRunMs / HOP_MS);
  let end = nFr;
  for (let i = top + 1; i < nFr; i++) {
    let quiet = true;
    for (let j = i; j < Math.min(nFr, i + run); j++) if (active[j]) { quiet = false; break; }
    if (quiet) { end = i; break; }
  }
  const voiced = r.map((v, i) => v > cfg.voiceR && low[i] > peakDb + cfg.voiceGateDb);
  let vowel = 0, air = 0, voicedHiss = 0;
  for (let i = 0; i < end; i++) {
    if (!active[i]) continue;
    const after = i * HOP_MS >= cfg.attackMs;
    if (!voiced[i]) { if (after && nz[i] >= cfg.airShare) air++; }
    else if (hf[i] >= cfg.vowelHf) voicedHiss++;
    else if (after && fm[i] >= cfg.vowelFormant) vowel++;
  }

  const A = Math.round(cfg.attackMs * SR / 1000), Bn = Math.round(cfg.bodyMs * SR / 1000);
  const pa = power(x, on, A, 2048), pb = power(x, on + A, Bn, 8192);
  const ba = bands(pa, 2048), bb = bands(pb, 8192);
  const punchDb = Math.max(-40, Math.min(40, db(meanPow(x, on, on + A)) - db(meanPow(x, on + A, on + A + Bn))));
  let zc = 0;
  for (let i = on + 1; i < on + A && i < x.length; i++) if ((x[i - 1] >= 0) !== (x[i] >= 0)) zc++;

  const m: Measures = {
    peakDb, lengthMs: end * HOP_MS, vowelMs: vowel * HOP_MS, airMs: air * HOP_MS, voicedMs: voicedHiss * HOP_MS,
    lowDb: db(share(pa, 2048, 0, cfg.lowHz)), punchDb, centroidKHz: ba.centroid,
  };
  // The first 20 ms alone: the release burst before a vowel can colour it (AVP held-out balanced accuracy 0.919 vs 0.908 without).
  const bu = bands(power(x, on, Math.round(0.02 * SR), 1024), 1024);
  const features = [
    ...ba.logs, ...bb.logs, -punchDb, ba.centroid, bb.centroid,
    Math.log10(m.lengthMs + 10), m.vowelMs / 100, m.airMs / 100, m.voicedMs / 100, zc / A,
    ...bu.logs, bu.centroid,
  ];
  return { m, features };
}
