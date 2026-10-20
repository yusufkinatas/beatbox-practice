// Run: npm test. Synthetic hits, so the measures and the verdict logic are checked without recordings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeWav, encodeWav } from './dsp.ts';
import { detectAll, onsetIndex } from './detector.ts';
import { analyze } from './analyze.ts';
import { judge, type Config, type Model } from './judge.ts';

const cfg: Config = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const sr = 44100, PRE = cfg.detector.preMs;
let seed = 7;
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const sig = (ms: number, f: (t: number) => number) => Float32Array.from({ length: Math.round(ms * sr / 1000) }, (_, i) => f(i / sr));
function mix(...parts: [number, Float32Array][]): Float32Array {
  const pre = onsetIndex(sr, PRE), out = new Float32Array(pre + Math.round(0.6 * sr));
  for (const [ms, p] of parts) out.set(p.map((v, i) => v + out[pre + Math.round(ms * sr / 1000) + i]), pre + Math.round(ms * sr / 1000));
  return out;
}
let prev = 0;
const hiss = (amp: number) => () => { const n = noise(), v = n - prev; prev = n; return amp * v; };
// harmonics of f0 shaped by one formant at 650 Hz, like "uh"
const vowel = (f0: number, amp: number) => (t: number) => {
  let s = 0;
  for (let h = 1; h * f0 < 4000; h++) s += Math.sin(2 * Math.PI * h * f0 * t) * (0.3 / h + 1 / (1 + ((h * f0 - 650) / 200) ** 2));
  return amp * s / 3;
};

const kick = sig(150, t => 0.8 * Math.exp(-t / 0.02) * Math.sin(2 * Math.PI * 70 * t) + 0.3 * Math.exp(-t / 0.003) * noise());
const tBurst = sig(60, t => Math.exp(-t / 0.008) * hiss(0.5)());
const KICK = mix([0, kick]);
const BUH = mix([0, kick], [30, sig(250, vowel(130, 0.3))]);
const T = mix([0, tBurst]);
const TSSS = mix([0, tBurst], [20, sig(300, hiss(0.08))]);
const TZ = mix([0, sig(150, hiss(0.3))], [0, sig(150, vowel(150, 0.2))]);
const m = (x: Float32Array) => analyze(x, sr, PRE, cfg.analysis).m;

test('wav round trip is exact', () => {
  const back = decodeWav(encodeWav(BUH, 48000));
  assert.equal(back.sr, 48000);
  assert.deepEqual(back.x, BUH);
});

test('detector cuts each hit with the onset at preMs', () => {
  const x = new Float32Array(sr * 1.5);
  x.set(kick, Math.round(0.2 * sr));
  x.set(tBurst, Math.round(0.9 * sr));
  const hits = detectAll(x, sr, cfg.detector);
  assert.equal(hits.length, 2);
  assert.ok(Math.abs(hits[0].at - 0.2 * sr) < sr * 0.003, `kick onset at ${hits[0].at}`);
  assert.ok(Math.abs(hits[1].at - 0.9 * sr) < sr * 0.003, `t onset at ${hits[1].at}`);
  const pre = onsetIndex(sr, PRE);
  assert.equal(hits[0].x[pre], x[hits[0].at]);
  assert.ok(hits[0].x.length < (0.7 - 0.2) * sr + pre, 'first hit ends before the second starts');
});

test('a tail wobbling around the trigger is not a new hit', () => {
  const thr = 10 ** (cfg.detector.triggerDb / 20), x = new Float32Array(sr);
  x.set(kick, Math.round(0.1 * sr));
  // 400 ms of hiss at the trigger level, gated on and off every 20 ms
  x.set(sig(400, t => (Math.floor(t / 0.02) % 2 ? 0.3 : 1.6) * thr * noise()), Math.round(0.25 * sr));
  assert.equal(detectAll(x, sr, cfg.detector).length, 1);
});

test('kick: low end and punch, no vowel', () => {
  const k = m(KICK);
  assert.ok(k.lowDb > -10, `lowDb ${k.lowDb}`);
  assert.ok(k.punchDb > 4, `punchDb ${k.punchDb}`);
  assert.ok(k.vowelMs < 60, `vowelMs ${k.vowelMs}`);
});
test('a long low boom (100 Hz) is not a vowel', () => {
  const boom = mix([0, sig(250, t => 0.8 * Math.exp(-t / 0.08) * Math.sin(2 * Math.PI * 100 * t) + 0.3 * Math.exp(-t / 0.003) * noise())]);
  assert.equal(m(boom).vowelMs, 0);
});
test('"buh" has a vowel tail', () => assert.ok(m(BUH).vowelMs >= 150, `vowelMs ${m(BUH).vowelMs}`));
test('t is high and short; "tsss" is airy', () => {
  const t = m(T), s = m(TSSS);
  assert.ok(t.centroidKHz > 3, `centroid ${t.centroidKHz}`);
  assert.ok(t.airMs < 60 && t.vowelMs === 0, `t air ${t.airMs} vowel ${t.vowelMs}`);
  assert.ok(s.airMs >= 150, `tsss air ${s.airMs}`);
});
test('voiced "ts" carries voice under the hiss', () => {
  const z = m(TZ);
  assert.ok(z.voicedMs >= 60, `voicedMs ${z.voicedMs}`);
  assert.ok(z.vowelMs < 60, `vowelMs ${z.vowelMs}`);
});

const D = analyze(KICK, sr, PRE, cfg.analysis).features.length;
const stub = (b: number[], noneDist = 1e9): Model => ({
  classes: ['B', 't', 'K'], mean: Array(D).fill(0), sd: Array(D).fill(1),
  layers: [{ W: [0, 1, 2].map(() => Array(D).fill(0)), b }], centroids: [Array(D).fill(0)], spread: [Array(D).fill(1)], noneDist,
});
const sayB = stub([3, 0, 0]);

test('verdicts', () => {
  assert.equal(judge(KICK, sr, { model: sayB, cfg, target: 'B' }).result, 'pass');
  const buh = judge(BUH, sr, { model: sayB, cfg, target: 'B' });
  assert.equal(buh.result, 'fail');
  assert.ok(buh.checks.find(c => c.check === 'vowel' && !c.pass));
  assert.equal(buh.tips.length, buh.checks.filter(c => c.active && !c.pass).length);
  assert.equal(judge(KICK, sr, { model: sayB, cfg, target: 't' }).result, 'wrong');
  assert.equal(judge(T, sr, { model: stub([0, 0, 0]), cfg, target: 't' }).result, 'unsure', 'only the kick is vetoed, t and K stay 50/50');
  assert.equal(judge(KICK, sr, { model: stub([3, 0, 0], 0), cfg }).heard, 'none');
});
test('veto: a hi-hat the model calls a kick is not a kick', () => {
  const v = judge(T, sr, { model: sayB, cfg, target: 'B' });
  assert.equal(v.result, 'wrong');
  assert.equal(v.vetoed, 'B');
  const back = judge(T, sr, { model: stub([3, 1, 0]), cfg });
  assert.equal(back.heard, 't', 'the sounds left share the confidence');
  assert.ok(back.probs.t > 0.7 && back.probs.B === 0);
  const gone = judge(T, sr, { model: stub([6, 0, 0]), cfg });
  assert.equal(gone.result, 'none', 'nothing else was likely');
  assert.equal(gone.vetoed, 'B');
});
test('levels and the audit switch checks off', () => {
  assert.equal(judge(BUH, sr, { model: sayB, cfg, target: 'B', level: 1, audit: { disabled: { 'vowel.B': 'test' } } }).result, 'pass');
  const tsss = judge(TSSS, sr, { model: stub([0, 3, 0]), cfg, target: 't', level: 1 });
  assert.equal(tsss.result, 'pass', 'air is a level 2 check');
});
