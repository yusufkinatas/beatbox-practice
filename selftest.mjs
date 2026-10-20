// Self-test for the pure logic in index.html (<script id="logic">). Run: node selftest.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const block = html.match(/<script id="logic">([\s\S]*?)<\/script>/);
if (!block) { console.error('FAIL: <script id="logic"> not found in index.html'); process.exit(1); }
new Function(block[1])();
const L = globalThis.BBLogic;

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error(`FAIL: ${name}\n  ${e.message}`); process.exit(1); }
}
const M = '−';

// ---------- hit-to-step matching (section 8) ----------
// 60 BPM: step 0.5 s, half window 0.25 s, all exact in binary.
test('step and half window', () => {
  assert.equal(L.stepSec(60), 0.5);
  assert.equal(L.halfSec(60), 0.25);
  assert.equal(Math.round(L.halfSec(70) * 1000), 214);
  assert.equal(Math.round(L.halfSec(120) * 1000), 125);
});
test('window edges at ±half a step', () => {
  const t0 = 10;
  assert.equal(L.stepIndex(t0, 60, 10), 0);
  assert.equal(L.stepIndex(t0, 60, 9.75), 0, 'start edge t0 - h belongs to step 0');
  assert.equal(L.stepIndex(t0, 60, 10.25), 1, 'end edge t0 + h belongs to the next step');
  assert.equal(L.stepIndex(t0, 60, 10.2499), 0);
  assert.equal(L.stepIndex(t0, 60, 12.0), 4);
});
test('hits before the first window are ignored', () => {
  assert.equal(L.stepIndex(10, 60, 9.7499), null);
  const s = L.createSession({ patternId: 'boots', bpm: 60, t0: 10 });
  assert.equal(L.applyHit(s, { time: 9.5, sound: 'B' }).type, 'ignored');
  assert.equal(s.judged, 0);
});
test('rest step hit = EXTRA', () => {
  const s = L.createSession({ patternId: 'pulse', bpm: 60, t0: 10 });
  s.streak = 5;
  const ev = L.applyHit(s, { time: 10.5, sound: 't' }); // step 1 is a rest in Pulse
  assert.equal(ev.type, 'extra'); assert.equal(ev.rest, true); assert.equal(ev.k, 1);
  assert.equal(s.extras, 1); assert.equal(s.streak, 0, 'extra resets the streak');
  assert.equal(s.judged, 0, 'extras are not judged target steps');
});
test('second hit on a step = EXTRA, counts up', () => {
  const s = L.createSession({ patternId: 'boots', bpm: 60, t0: 10 });
  assert.equal(L.applyHit(s, { time: 10, sound: 'B' }).type, 'hit');
  const e1 = L.applyHit(s, { time: 10.1, sound: 'B' });
  const e2 = L.applyHit(s, { time: 10.2, sound: 't' });
  assert.equal(e1.type, 'extra'); assert.equal(e1.rest, false); assert.equal(e1.count, 1);
  assert.equal(e2.count, 2);
  assert.equal(s.extras, 2); assert.equal(s.hitsOnTarget, 1);
  assert.equal(s.marks[0].hit.offsetMs, 0, 'first hit keeps its judgment');
});
test('MISS when an unclaimed window closes', () => {
  const s = L.createSession({ patternId: 'pulse', bpm: 60, t0: 10 });
  L.applyHit(s, { time: 10, sound: 'B' });
  assert.equal(L.closableStep(s, 10.7499), 0);
  assert.equal(L.closableStep(s, 10.75), 1);
  // windows 0..3 closed: step 0 hit, 1 rest, 2 unclaimed (MISS), 3 rest
  assert.deepEqual(L.closeUpTo(s, 3), [2]);
  assert.equal(s.marks[2].missed, true);
  assert.equal(s.per.B.missed, 1); assert.equal(s.judged, 2);
  assert.deepEqual(L.closeUpTo(s, 3), [], 'closing again is a no-op');
  const late = L.applyHit(s, { time: 11.0, sound: 'B' });
  assert.equal(late.type, 'extra', 'a hit on an already missed step is an extra');
  assert.equal(s.lanes[2][0].miss, true);
});

// ---------- on time / early / late ----------
test('timing class at ±50 ms boundaries', () => {
  assert.equal(L.timingOf(0), 'on');
  assert.equal(L.timingOf(50), 'on'); assert.equal(L.timingOf(-50), 'on');
  assert.equal(L.timingOf(51), 'late'); assert.equal(L.timingOf(-51), 'early');
  const s = L.createSession({ patternId: 'boots', bpm: 60, t0: 10 });
  assert.equal(L.applyHit(s, { time: 10.05, sound: 'B' }).timing, 'on');
  assert.equal(L.applyHit(s, { time: 10.5 - 0.051, sound: 't' }).timing, 'early');
  const late = L.applyHit(s, { time: 11.051, sound: 'K' });
  assert.equal(late.timing, 'late'); assert.equal(late.offsetMs, 51);
});
test('letter shift (sections 3, 11.3)', () => {
  assert.equal(L.letterShift(-64, false), -21); assert.equal(L.letterShift(72, false), 22);
  assert.equal(L.letterShift(-64, true), -13); assert.equal(L.letterShift(72, true), 13);
  assert.equal(L.letterShift(40, false), 0);
  assert.equal(L.letterShift(-400, false), -28); assert.equal(L.letterShift(400, true), 16);
  assert.equal(L.letterShift(51, false), 20);
});
test('signed formatting uses U+2212', () => {
  assert.equal(L.signedMs(-64), `${M}64 ms`); assert.equal(L.signedMs(72), '+72 ms'); assert.equal(L.signed(0), '0');
  // x.5 rounds away from zero both ways, so the K row matches the tendency sentence
  assert.equal(L.signed(-38.5), `${M}39`); assert.equal(L.signed(38.5), '+39'); assert.equal(L.signed(-0.4), '0');
  assert.equal(L.tendency([{ sound: 'K', hits: 20, meanMs: -38.5, inPattern: true }]), 'You rush the snare (K) by 39 ms on average.');
  assert.equal(L.mmss(78.4), '01:18'); assert.equal(L.mmss(308.57), '05:09');
});
test('lane caret: 3+ hits, value only past ±50', () => {
  const lane = [{ offsetMs: -64 }, { offsetMs: -58 }, { offsetMs: -71 }, { offsetMs: -35 }];
  const a = L.laneSummary(lane);
  assert.equal(a.show, true); assert.equal(Math.round(a.mean), -57); assert.equal(a.showValue, true); assert.equal(a.text, `${M}57`);
  const b = L.laneSummary([{ miss: true }, { offsetMs: -44 }, { offsetMs: -12 }, { offsetMs: 26 }]);
  assert.equal(b.show, true); assert.equal(Math.round(b.mean), -10); assert.equal(b.showValue, false);
  assert.equal(L.laneSummary([{ miss: true }, { offsetMs: 1 }, { offsetMs: 2 }]).show, false);
  assert.equal(L.laneSummary([{ offsetMs: 50 }, { offsetMs: 50 }, { offsetMs: 50 }]).showValue, false, 'exactly 50 shows no value');
  assert.equal(L.laneSummary([{ offsetMs: -50 }, { offsetMs: -51 }, { offsetMs: -50 }, { offsetMs: -51 }]).text, `${M}51`);
});

// ---------- streak ----------
test('streak rules', () => {
  const s = L.createSession({ patternId: 'pulse', bpm: 60, t0: 10 }); // B·B·B·B·
  L.applyHit(s, { time: 10, sound: 'B' });
  L.applyHit(s, { time: 11, sound: 'B' });
  assert.equal(s.streak, 2);
  L.closeUpTo(s, 3); // rest steps 1 and 3 with no hit neither add nor reset
  assert.equal(s.streak, 2);
  L.applyHit(s, { time: 12, sound: 'B' }); assert.equal(s.streak, 3); assert.equal(s.best, 3);
  L.applyHit(s, { time: 13 + 0.06, sound: 'B' }); assert.equal(s.streak, 0, 'off-time hit resets');
  L.applyHit(s, { time: 14, sound: 'B' }); assert.equal(s.streak, 1);
  L.applyHit(s, { time: 15, sound: 'K' }); assert.equal(s.streak, 0, 'wrong sound resets');
  L.applyHit(s, { time: 16, sound: 'B' }); assert.equal(s.streak, 1);
  L.applyHit(s, { time: 16.1, sound: 'B' }); assert.equal(s.streak, 0, 'extra resets');
  L.applyHit(s, { time: 17, sound: 'B' }); assert.equal(s.streak, 1);
  L.closeUpTo(s, 20); // step 18 missed
  assert.equal(s.streak, 0, 'miss resets'); assert.equal(s.best, 3);
});

// ---------- denominators ----------
test('on-time % and sound-match % denominators', () => {
  const s = L.createSession({ patternId: 'boots', bpm: 60, t0: 10 }); // BtKtBtKt
  L.applyHit(s, { time: 10, sound: 'B' });          // on, right
  L.applyHit(s, { time: 10.5 + 0.08, sound: 'B' }); // late, wrong (t heard as B)
  L.applyHit(s, { time: 10.6, sound: 't' });        // extra, left out of both
  L.closeUpTo(s, 3);                                // steps 2, 3 missed
  const r = L.readouts(s);
  assert.equal(r.judged, 4); assert.equal(r.onTime, 1); assert.equal(r.onPct, 25, 'missed counts as not on time');
  assert.equal(r.hits, 2); assert.equal(r.right, 1); assert.equal(r.matchPct, 50, 'missed and extras left out of match');
  assert.deepEqual(r.perSound.map(x => [x.sound, x.pct]), [['B', 100], ['t', 0], ['K', null]]);
  const pulse = L.readouts(L.createSession({ patternId: 'pulse', bpm: 60, t0: 0 }));
  assert.deepEqual(pulse.perSound.map(x => x.sound), ['B'], 'Pulse shows B only');
});

// ---------- tendency ----------
const snd = (sound, hits, meanMs, extra = {}) => Object.assign({ sound, hits, meanMs, inPattern: true }, extra);
test('tendency thresholds', () => {
  assert.equal(L.tendency([snd('K', 171, -38.02), snd('B', 174, 6)]), 'You rush the snare (K) by 38 ms on average.');
  assert.equal(L.tendency([snd('t', 50, 25)]), 'You drag the hi-hat (t) by 25 ms on average.');
  assert.equal(L.tendency([snd('B', 50, 20)]), 'Your timing is centered.', 'exactly 20 ms is centered');
  assert.equal(L.tendency([snd('B', 50, -20.6)]), 'You rush the kick (B) by 21 ms on average.');
  assert.equal(L.tendency([snd('K', 9, -90), snd('B', 10, 5)]), 'Your timing is centered.', 'fewer than 10 hits ignored');
  assert.equal(L.tendency([snd('K', 30, -30), snd('t', 30, 45)]), 'You drag the hi-hat (t) by 45 ms on average.', 'largest |mean| wins');
  assert.equal(L.tendency([]), 'Your timing is centered.');
});

// ---------- next step, every rule in section 8, first match wins ----------
const NS = (o) => L.nextStep(Object.assign({ bars: 20, onTimePct: 80, bpm: 70, patternId: 'boots', sounds: [] }, o));
test('next step: fewer than 8 bars', () => {
  const n = NS({ bars: 7, onTimePct: 10 });
  assert.equal(n.sentence, 'Play at least 8 bars for a next step.'); assert.equal(n.reason, '');
});
test('next step 1: drop tempo', () => {
  const n = NS({ onTimePct: 58, bpm: 70 });
  assert.equal(n.sentence, 'Drop to 60 BPM and play Boots & cats until on time is above 70%.');
  assert.equal(n.reason, 'You were on time for 58% of steps at 70 BPM. At 60 BPM each step lasts 500 ms instead of 429 ms.');
  assert.equal(n.bpm, 60); assert.equal(n.patternId, 'boots');
  const m = NS({ onTimePct: 40, bpm: 95, patternId: 'push' });
  assert.equal(m.sentence, 'Drop to 85 BPM and play Push until on time is above 70%.');
  assert.equal(m.reason, 'You were on time for 40% of steps at 95 BPM. At 85 BPM each step lasts 353 ms instead of 316 ms.');
  assert.equal(NS({ onTimePct: 50, bpm: 64 }).bpm, 60, 'never below 60');
});
test('next step 2: easier pattern at 60', () => {
  const a = NS({ onTimePct: 65, bpm: 60, patternId: 'push' });
  assert.equal(a.sentence, 'Stay at 60 BPM and switch to Boots & cats until on time is above 70%.');
  assert.equal(a.reason, 'You were on time for 65% of steps at the slowest tempo.');
  assert.equal(a.patternId, 'boots'); assert.equal(a.bpm, 60);
  const b = NS({ onTimePct: 65, bpm: 60, patternId: 'boots' });
  assert.equal(b.sentence, 'Stay at 60 BPM and switch to Pulse until on time is above 70%.'); assert.equal(b.patternId, 'pulse');
});
test('next step 3: Pulse at 60', () => {
  const n = NS({ onTimePct: 45, bpm: 60, patternId: 'pulse' });
  assert.equal(n.sentence, 'Keep playing Pulse at 60 BPM until on time is above 70%.');
  assert.equal(n.reason, 'You were on time for 45% of steps. Land each B on the click.');
});
const weakK = [snd('B', 40, 0, { matchPct: 90, heardAs: { sound: 't', count: 2 } }), snd('K', 40, 0, { matchPct: 45, heardAs: { sound: 't', count: 20 } })];
test('next step 4: re-teach a weak sound', () => {
  const n = NS({ onTimePct: 80, bpm: 90, sounds: weakK });
  assert.equal(n.sentence, 'Re-teach the snare (K), then play Boots & cats at 90 BPM again.');
  assert.equal(n.reason, 'Only 45% of your K hits matched. Most were heard as t.');
  assert.equal(n.reteachSound, 'K'); assert.equal(n.bpm, 90);
  const few = NS({ onTimePct: 80, bpm: 90, sounds: [snd('K', 9, 0, { matchPct: 10, heardAs: { sound: 't', count: 8 } })] });
  assert.match(few.sentence, /^Raise/, 'needs at least 10 hits');
  assert.match(NS({ onTimePct: 80, sounds: [snd('K', 40, 0, { matchPct: 60 })] }).sentence, /^Raise/, '60% is not below 60%');
});
test('next step 5: raise tempo', () => {
  const n = NS({ onTimePct: 82, bpm: 115 });
  assert.equal(n.sentence, 'Raise to 120 BPM and keep playing Boots & cats.');
  assert.equal(n.reason, 'You were on time for 82% of steps at 115 BPM.'); assert.equal(n.bpm, 120);
  assert.equal(NS({ onTimePct: 70, bpm: 70 }).sentence, 'Raise to 80 BPM and keep playing Boots & cats.', '70% is not below 70%');
});
test('next step 6: harder pattern at 120', () => {
  const a = NS({ onTimePct: 75, bpm: 120, patternId: 'pulse' });
  assert.equal(a.sentence, 'Move on to Boots & cats at 70 BPM.');
  assert.equal(a.reason, 'You were on time for 75% of steps at the fastest tempo.');
  assert.equal(a.patternId, 'boots'); assert.equal(a.bpm, 70);
  assert.equal(NS({ onTimePct: 75, bpm: 120, patternId: 'boots' }).sentence, 'Move on to Push at 70 BPM.');
});
test('next step 7: Push at 120', () => {
  const n = NS({ onTimePct: 90, bpm: 120, patternId: 'push' });
  assert.equal(n.sentence, 'Keep Push at 120 BPM and aim for a longer streak.');
  assert.equal(n.reason, 'You were on time for 90% of steps at the fastest tempo.');
});
test('next step: first match wins', () => {
  assert.match(NS({ bars: 3, onTimePct: 40, sounds: weakK }).sentence, /^Play at least/);
  assert.match(NS({ onTimePct: 40, bpm: 90, sounds: weakK }).sentence, /^Drop to 80/, 'timing beats re-teach');
  assert.match(NS({ onTimePct: 80, bpm: 120, patternId: 'push', sounds: weakK }).sentence, /^Re-teach/, 're-teach beats tempo/pattern');
});

// ---------- section 5 sample session, end to end ----------
test('section 5 Results numbers from a simulated 90-bar session', () => {
  const bpm = 70, t0 = 100;
  const s = L.createSession({ patternId: 'boots', bpm, t0 });
  // per sound: [early, on, late, missed], offsets, wrong sounds
  const plan = {
    B: { n: [27, 117, 30, 6], on: 7, wrong: { t: 20, K: 8 } },
    t: { n: [86, 216, 40, 18], on: -2, wrong: { K: 60, B: 32 } },
    K: { n: [74, 86, 11, 9], on: -17, wrong: { t: 58, B: 17 } },
  };
  const outcomes = {};
  for (const x of ['B', 't', 'K']) {
    const p = plan[x], list = [];
    const wrong = Object.entries(p.wrong).flatMap(([y, c]) => Array(c).fill(y));
    const off = [...Array(p.n[0]).fill(-80), ...Array(p.n[1]).fill(p.on), ...Array(p.n[2]).fill(80)];
    off.forEach((o, i) => list.push({ o, sound: i < wrong.length ? wrong[i] : x }));
    for (let i = 0; i < p.n[3]; i++) list.push(null);
    outcomes[x] = list;
  }
  const used = { B: 0, t: 0, K: 0 };
  let extras = 0;
  for (let k = 0; k < 720; k++) {
    const x = s.steps[k % 8], o = outcomes[x][used[x]++];
    if (!o) continue;
    const tk = t0 + k * 30 / bpm;
    L.applyHit(s, { time: tk + o.o / 1000, sound: o.sound });
    if (x === 'B' && extras < 12) { L.applyHit(s, { time: tk + 0.15, sound: 'B' }); extras++; }
  }
  const stop = t0 + 90 * 8 * 30 / bpm;
  L.closeUpTo(s, L.closableStep(s, stop));
  const r = L.summarize(s, stop);
  assert.equal(r.sessionText, '05:09'); assert.equal(r.bars, 90);
  assert.equal(r.judged, 720); assert.equal(r.onTime, 419); assert.equal(r.onTimePct, 58); assert.equal(r.extras, 12);
  assert.equal(r.hitsOnTarget, 687); assert.equal(r.right, 492); assert.equal(r.matchPct, 72);
  const by = Object.fromEntries(r.sounds.map(x => [x.sound, x]));
  assert.deepEqual([by.B.pct.early, by.B.pct.on, by.B.pct.late, by.B.pct.missed], [15, 65, 17, 3]);
  assert.deepEqual([by.t.pct.early, by.t.pct.on, by.t.pct.late, by.t.pct.missed], [24, 60, 11, 5]);
  assert.deepEqual([by.K.pct.early, by.K.pct.on, by.K.pct.late, by.K.pct.missed], [41, 48, 6, 5]);
  assert.deepEqual([L.signedMs(by.B.meanMs), L.signedMs(by.t.meanMs), L.signedMs(by.K.meanMs)], ['+6 ms', `${M}12 ms`, `${M}38 ms`]);
  assert.deepEqual([by.B.matchPct, by.t.matchPct, by.K.matchPct], [84, 73, 56]);
  assert.deepEqual([by.K.right, by.K.hits], [96, 171]);
  assert.deepEqual(by.K.heardAs, { sound: 't', count: 58 });
  assert.equal(r.tendency, 'You rush the snare (K) by 38 ms on average.');
  assert.equal(r.next.sentence, 'Drop to 60 BPM and play Boots & cats until on time is above 70%.');
  assert.equal(r.next.reason, 'You were on time for 58% of steps at 70 BPM. At 60 BPM each step lasts 500 ms instead of 429 ms.');
  assert.equal(r.reteachSound, 'K', 'Re-teach a sound targets the lowest match (Snare)');
});
test('summary skips sounds not in the pattern', () => {
  const s = L.createSession({ patternId: 'pulse', bpm: 60, t0: 0 });
  const r = L.summarize(s, 1.9);
  assert.equal(r.bars, 0);
  assert.deepEqual(r.sounds.filter(x => x.inPattern).map(x => x.sound), ['B']);
  assert.equal(r.next.sentence, 'Play at least 8 bars for a next step.');
  assert.equal(L.summarize(L.createSession({ patternId: 'boots', bpm: 60, t0: 0 }), 8.6 * 4).bars, 8, 'a partial bar is not counted');
});

// ---------- classifier ----------
test('features + k-NN classifier + closeness + alike hint', () => {
  const sr = 48000;
  const tone = (f, noise) => { const a = new Float32Array(2048); let seed = 1; for (let i = 0; i < 2048; i++) { seed = (seed * 16807) % 2147483647; a[i] = Math.sin(2 * Math.PI * f * i / sr) * (1 - noise) + ((seed / 2147483647) * 2 - 1) * noise; } return a; };
  const f = L.features(tone(100, 0), sr);
  assert.equal(f.length, 8); assert.ok(f.every(Number.isFinite));
  const hi = L.features(tone(8000, 0), sr);
  assert.ok(hi[6] > f[6], 'centroid rises with pitch'); assert.ok(hi[7] > f[7], 'zero-crossing rate rises with pitch');
  const samples = { B: [], t: [], K: [] };
  for (let i = 0; i < 8; i++) { samples.B.push(L.features(tone(90 + i * 5, 0.02), sr)); samples.t.push(L.features(tone(9000 + i * 100, 0.6), sr)); samples.K.push(L.features(tone(900 + i * 20, 0.3), sr)); }
  const model = L.trainModel(samples);
  assert.equal(L.classify(model, L.features(tone(110, 0.02), sr)).sound, 'B');
  assert.equal(L.classify(model, L.features(tone(9500, 0.6), sr)).sound, 't');
  const c = L.classify(model, L.features(tone(950, 0.3), sr));
  assert.equal(c.sound, 'K');
  assert.ok(Math.abs(c.closeness.B + c.closeness.t + c.closeness.K - 1) < 1e-9, 'closeness sums to 1');
  assert.ok(c.closeness.K > c.closeness.B && c.closeness.K > c.closeness.t);
  // tie on votes goes to the nearest: hand-built model
  const m2 = { mean: [0], sd: [1], pts: [{ s: 'B', z: [1] }, { s: 't', z: [2] }, { s: 'K', z: [3] }] };
  assert.equal(L.classify(m2, [1.1]).sound, 'B');
  assert.equal(L.alikeHint({ B: 0.09, t: 0.41, K: 0.50 }), 't and K sound alike. Re-teach one of them for cleaner results.');
  assert.equal(L.alikeHint({ B: 0.1, t: 0.2, K: 0.7 }), '');
  assert.notEqual(L.alikeHint({ B: .15, t: .50, K: .35 }), '', 'within 15 points');
  assert.equal(L.alikeHint({ B: .14, t: .51, K: .35 }), '');
  // closeness = inverse mean distance to the 3 nearest samples of each sound, normalised
  const m3 = { mean: [0], sd: [1], pts: [[0, 'B'], [1, 'B'], [5, 'B'], [10, 't'], [11, 't'], [12, 't'], [20, 'K'], [21, 'K'], [22, 'K']].map(([z, s]) => ({ s, z: [z] })) };
  const inv = [3 / 5.5, 1 / 10.5, 1 / 20.5];
  assert.ok(Math.abs(L.classify(m3, [0.5]).closeness.B - inv[0] / (inv[0] + inv[1] + inv[2])) < 1e-9);
});

console.log(`selftest: ${passed} tests passed`);
