/* Cuts the pro reference clip candidates (PLAN.md table) into testset/pro/candidates/ for approval by ear,
   then judges them on the rules alone and writes data/pro/measures.md. Run: node scripts/pro-clips.ts */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { db, decodeWav, encodeWav, meanPow } from '../src/judge/dsp.ts';
import { detectAll, type Hit } from '../src/judge/detector.ts';
import { analyze, type Measures } from '../src/judge/analyze.ts';
import { judgeMeasured, SOUNDS, type Config, type Model, type Sound, type Verdict } from '../src/judge/judge.ts';

const FFMPEG = '/opt/homebrew/bin/ffmpeg', YTDLP = '/opt/homebrew/bin/yt-dlp';
const RAW = 'data/pro/raw', OUT = 'testset/pro/candidates';
const TOL = 0.2, MARGIN_S = 1.5, GAP_S = 5;   // match tolerance, section margin, max gap inside one section
// Isolation: for ISO_MS on both sides (skipping the GUARD_MS right before the onset) no 10 ms frame above the hit's peak + QUIET dB,
// and the background median stays 5 dB under the analysis gate (activeDb), or the background is measured as part of the hit.
const ISO_MS = 250, QUIET = -25, GUARD_MS = 20;

// A number is a listed time, [a, b] a range, [a, b, step] a time every step seconds.
type Spec = (number | [number, number] | [number, number, number])[];
type Src = { slug: string; name: string; id: string; triggerDb?: number } & Partial<Record<Sound, Spec>>;
const SRCS: Src[] = [
  { slug: 'wing', name: 'Wing, "DOPAMINE | Tutorial"', id: 'TT-9OhiSX8Y', B: [368.1], t: [368.8, 377.6], K: [369.6, 380.0] },
  { slug: 'dlow-tips', name: 'D-Low, "5 TOP TIPS"', id: 'v0POPH-M3SU', B: [182.8], K: [87.7, 88.4, 89.1, 89.8, 91.8, 93.3, [97.8, 100.7], [175.4, 185.0]] },
  { slug: 'dlow-whistle', name: 'D-Low, "Whistle Hihat Tutorial"', id: 'zpjXQHt9AB4', t: [56.8] },
  {
    slug: 'seboom', name: 'Seboom Academy, "Your First Beat"', id: 'XBSPHZp0s60',
    B: [552.8, 554.8, 556.8, 558.8, [566.8, 578.8, 2]], t: [219.1, 220.0, 220.9, 222.8, 223.8, 224.7, 233.4], K: [373.6, 376.1, 378.5, 390.9, 393.3, 395.7],
  },
  { slug: 'footboxg-kick', name: 'FootboxG, kick', id: 'm37cDsDl-4I', B: [44.9, 46.0, 48.1, 49.1, 50.4, 55.2, 58.1] },
  { slug: 'footboxg-hihat', name: 'FootboxG, hi-hat', id: 'B19ZKJaHamo', t: [17.7, 18.8, 22.2, 29.8, 31.1, 40.9, 45.7] },
  { slug: 'footboxg-k', name: 'FootboxG, outward K', id: 'BTWwO_Dh21g', K: [26.5, 27.2, 27.8, 30.6, 31.7, 46.8, 49.3, 54.2, 56.6] },
  { slug: 'skiller', name: 'SkilleR, "How to beatbox"', id: 'gXv8x4HVEcI', triggerDb: -15 /* music at about -35 dBFS keeps triggering at -40 */, B: [101.6, 102.3, 103.0, 110.6, 111.2, 111.7, 112.8, 116.9], K: [179.7, 181.0, 181.6, 182.1, 182.6, 183.1, 183.5, 184.0] },
];

const cfg: Config = JSON.parse(readFileSync('src/judge/config.json', 'utf8'));
const SR = 44100, PRE = cfg.detector.preMs, PRE_N = Math.round(PRE * SR / 1000);
const fix1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);

/** Points (sound, time) and ranges (sound, a, b) of one source. */
function targets(s: Src) {
  const pts: { sound: Sound; t: number }[] = [], rng: { sound: Sound; a: number; b: number }[] = [];
  for (const sound of SOUNDS) for (const v of s[sound] ?? []) {
    if (typeof v === 'number') pts.push({ sound, t: v });
    else if (v.length === 3) for (let t = v[0]; t <= v[1] + 1e-6; t += v[2]) pts.push({ sound, t: Math.round(t * 10) / 10 });
    else rng.push({ sound, a: v[0], b: v[1] });
  }
  return { pts, rng };
}

/** Clusters of nearby listed times and ranges, each downloaded as one section with MARGIN_S around it. */
function sections(s: Src): [number, number][] {
  const { pts, rng } = targets(s), out: [number, number][] = [];
  for (const [a, b] of [...pts.map(p => [p.t, p.t]), ...rng.map(r => [r.a, r.b])].sort((u, v) => u[0] - v[0])) {
    const last = out[out.length - 1];
    if (last && a - last[1] <= GAP_S) last[1] = Math.max(last[1], b); else out.push([a, b]);
  }
  return out.map(([a, b]) => [Math.round((a - MARGIN_S) * 10) / 10, Math.round((b + MARGIN_S) * 10) / 10]);
}

/** Mono 44.1 kHz audio of [a, b] seconds of the video, cached in RAW. */
function fetchSection(s: Src, a: number, b: number): Float32Array {
  const base = `${RAW}/${s.slug}-${a}-${b}`, wav = `${base}.wav`;
  if (!existsSync(wav)) {
    const got = execFileSync(YTDLP, [
      '-f', 'bestaudio', '-x', '--download-sections', `*${a}-${b}`, '--force-keyframes-at-cuts',
      '--ffmpeg-location', FFMPEG, '--no-playlist', '-o', `${base}.%(ext)s`, '--print', 'after_move:filepath', `https://youtu.be/${s.id}`,
    ], { encoding: 'utf8' }).trim().split('\n').pop()!;
    execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', got, '-ac', '1', '-ar', String(SR), '-c:a', 'pcm_f32le', wav]);
    rmSync(got);
  }
  const { x, sr } = decodeWav(readFileSync(wav));
  if (sr !== SR) throw new Error(`${wav}: ${sr} Hz`);
  if (Math.abs(x.length / SR - (b - a)) > 0.1) console.warn(`${wav}: ${(x.length / SR).toFixed(2)} s, asked for ${(b - a).toFixed(2)} s`);
  return x;
}

/** 10 ms frame levels of x[from, to), dB re the hit's peak. */
function levels(x: Float32Array, from: number, to: number, peak: number): number[] {
  const out: number[] = [];
  for (let i = from; i + 441 <= to; i += 441) out.push(db(meanPow(x, i, i + 441)) - peak);
  return out;
}

type Cand = { file: string; sound: Sound; source: string; url: string; time: number; m: Measures; v: Verdict; fails: string[] };
const cands: Cand[] = [];
const D = analyze(new Float32Array(SR), SR, PRE, cfg.analysis).features.length;
const stub = (s: Sound): Model => ({
  classes: SOUNDS, mean: Array(D).fill(0), sd: Array(D).fill(1),
  layers: [{ W: SOUNDS.map(() => Array(D).fill(0)), b: SOUNDS.map(c => (c === s ? 5 : 0)) }],
  centroids: SOUNDS.map(() => Array(D).fill(0)), spread: SOUNDS.map(() => Array(D).fill(1)), noneDist: 1e9,
});

mkdirSync(RAW, { recursive: true });
rmSync(OUT, { recursive: true, force: true });
for (const s of SOUNDS) mkdirSync(`${OUT}/${s}`, { recursive: true });

const cutMs = (h: Hit) => (h.x.length - PRE_N) * 1000 / SR;
/** The cut ended (on a new trigger) while the analysed sound was still going. */
const cutShort = (h: Hit, m: Measures) => m.lengthMs >= cutMs(h) - 30 && cutMs(h) < cfg.detector.maxMs - 10;

/** Why a hit is not a clean isolated cut, or '' if it is. x: the section, h.at: onset in it. */
function problem(x: Float32Array, h: Hit, m: Measures): string {
  if (cutShort(h, m)) return `cut ends at +${cutMs(h).toFixed(0)} ms while still sounding (re-trigger)`;
  const ms = (v: number) => Math.round(v * SR / 1000), iso = ms(ISO_MS), g = ms(GUARD_MS), end = h.at + ms(m.lengthMs), cutEnd = h.at + ms(cutMs(h));
  if (h.at < iso + g || end + iso > x.length) return 'too close to the section edge';
  const pre = levels(x, h.at - iso - g, h.at - g, m.peakDb), post = levels(x, end, Math.max(end + iso, cutEnd), m.peakDb);
  const before = Math.max(...pre), after = Math.max(...post), floor = Math.max(stats(pre).med, stats(post).med);
  if (floor > cfg.analysis.activeDb - 5) return `background (music or noise) at ${floor.toFixed(0)} dB re peak, limit ${cfg.analysis.activeDb - 5}`;
  if (before > QUIET) return `sound at ${before.toFixed(0)} dB re peak in the ${ISO_MS} ms before`;
  if (after > QUIET) return `sound at ${after.toFixed(0)} dB re peak in the ${ISO_MS} ms after (or later in the cut)`;
  return '';
}

const why: Record<string, { peak: number; reason: string }> = {};   // listed time (or range hit) -> why no candidate came from it, from its loudest hit
for (const src of SRCS) {
  const { pts, rng } = targets(src), kept = new Set<number>(), key = (p: { sound: Sound; t: number }) => `${src.slug} ${p.sound} ${fix1(p.t)}`;
  for (const [a, b] of sections(src)) {
    const x = fetchSection(src, a, b), hits = detectAll(x, SR, { ...cfg.detector, triggerDb: src.triggerDb ?? cfg.detector.triggerDb });
    const an = hits.map(h => analyze(h.x, SR, PRE, cfg.analysis));
    hits.forEach((h, k) => {
      const q = hits[k - 1], { m, features } = an[k];
      // a re-trigger in the tail of a louder hit is not a hit of its own
      if (q && q.at + q.x.length - PRE_N === h.at && cutShort(q, an[k - 1].m) && an[k - 1].m.peakDb > m.peakDb) return;
      const t = a + h.at / SR, pi = pts.findIndex(p => Math.abs(p.t - t) <= TOL), r = rng.find(r => t >= r.a - TOL && t <= r.b + TOL);
      const sound = pi >= 0 ? pts[pi].sound : r?.sound;
      if (!sound) return;
      const bad = problem(x, h, m);
      if (bad) {
        const k = pi >= 0 ? key(pts[pi]) : `${src.slug} ${sound} ${r!.a} to ${r!.b}, hit at ${fix1(t)}`;
        if ((why[k]?.peak ?? -Infinity) <= m.peakDb) why[k] = { peak: m.peakDb, reason: `${pi >= 0 ? `hit at ${fix1(t)}: ` : ''}${bad}` };
        return;
      }
      if (pi >= 0) kept.add(pi);
      const v = judgeMeasured(m, features, { model: stub(sound), cfg, target: sound, level: 3 });
      const fails = [...v.checks.filter(c => !c.pass).map(c => c.id), ...v.vetoes.filter(w => w.hit && w.sound === sound).map(w => w.id), ...(v.noneReason ? ['none.length'] : [])];
      const file = `${sound}/${src.slug}-${fix1(t)}.wav`;
      writeFileSync(`${OUT}/${file}`, encodeWav(h.x, SR));
      cands.push({ file, sound, source: src.name, url: `https://youtu.be/${src.id}?t=${Math.floor(t)}`, time: +fix1(t), m, v, fails });
    });
  }
  pts.forEach((p, i) => { if (kept.has(i)) delete why[key(p)]; else why[key(p)] ??= { peak: 0, reason: `no hit detected within ${TOL} s` }; });
}
writeFileSync(`${OUT}/manifest.json`, JSON.stringify(cands.map(({ file, sound, source, url, time }) => ({ file, sound, source, url, time })), null, 1) + '\n');

// Rules-only read: per check and sound, the pro range and a limit that passes every candidate with a margin.
const MARGIN: Record<string, number> = { dBFS: 3, dB: 3, ms: 30, kHz: 0.5 }, STEP: Record<string, number> = { dBFS: 1, dB: 1, ms: 10, kHz: 0.1 };
const unitOf = (k: string) => (k.endsWith('KHz') ? 'kHz' : k.endsWith('Ms') ? 'ms' : 'dB');
const f1 = (v: number) => (Math.round(v * 10) / 10).toString();
function stats(a: number[]) {
  const s = [...a].sort((x, y) => x - y), n = s.length;
  return { min: s[0], med: n % 2 ? s[n >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2, max: s[n - 1] };
}
/** vals[i] belongs to clips[i]. Returns the edge, the proposal and the clip at the extreme. */
function propose(vals: number[], op: '>=' | '<=', cur: number, unit: string, clips: Cand[]) {
  const w = vals.indexOf(op === '>=' ? Math.min(...vals) : Math.max(...vals)), st = STEP[unit], edge = +(op === '>=' ? Math.floor((Math.min(...vals) - MARGIN[unit]) / st) * st : Math.ceil((Math.max(...vals) + MARGIN[unit]) / st) * st).toFixed(1);
  return { edge, next: op === '>=' ? Math.min(cur, edge) : Math.max(cur, edge), worst: `${clips[w].file} (${f1(vals[w])})` };
}

const next = { checks: structuredClone(cfg.checks), vetoes: structuredClone(cfg.vetoes) };
const md: string[] = ['# Pro clip candidates: rules-only first read', '',
  `Generated by \`node scripts/pro-clips.ts\`. ${cands.length} candidates in testset/pro/candidates, none approved by ear yet. Each is judged at level 3 against its own sound with a stub model that always names that sound, so only the quality checks, the vetoes and the length rule decide. Cuts come from the shared detector (per-source trigger overrides in the script) and are kept only if isolated: ${ISO_MS} ms with no frame above ${QUIET} dB re peak on both sides, background median under ${cfg.analysis.activeDb - 5} dB re peak, and not cut short by a re-trigger.`, ''];
const MEAS = Object.keys(cands[0].m) as (keyof Measures)[];
for (const s of SOUNDS) {
  const cs = cands.filter(c => c.sound === s);
  if (!cs.length) continue;
  md.push(`## ${s} (${cs.length} clips)`, '', '| measure | min | median | max |', '|---|---|---|---|');
  for (const k of MEAS) { const st = stats(cs.map(c => c.m[k])); md.push(`| ${k} | ${f1(st.min)} | ${f1(st.med)} | ${f1(st.max)} |`); }
  md.push('', '| clip | ' + MEAS.join(' | ') + ' | failing |', '|---|' + MEAS.map(() => '---|').join('') + '---|');
  for (const c of cs) md.push(`| ${c.file} | ${MEAS.map(k => f1(c.m[k])).join(' | ')} | ${c.fails.join(', ') || '-'} |`);
  md.push('');
}

const rows: string[] = [];
for (const s of SOUNDS) {
  const cs = cands.filter(c => c.sound === s);
  if (!cs.length) continue;
  for (const ch of cs[0].v.checks) {
    const vals = cs.map(c => c.v.checks.find(x => x.id === ch.id)!.value), p = propose(vals, ch.op, ch.limit, ch.unit, cs), fail = vals.filter(v => (ch.op === '>=' ? v < ch.limit : v > ch.limit)).length;
    (ch.op === '>=' ? next.checks[ch.check].min! : next.checks[ch.check].max!)[s] = p.next;
    rows.push(`| ${ch.id} | ${ch.op} ${ch.limit} | ${fail} of ${vals.length} | ${f1(Math.min(...vals))} to ${f1(Math.max(...vals))} | ${p.worst} | ${p.edge} | **${p.next}** |`);
  }
  const vt = cs[0].v.vetoes.find(w => w.sound === s);
  if (vt) {
    const vals = cs.map(c => c.v.vetoes.find(w => w.sound === s)!.value), p = propose(vals, vt.op, vt.limit, unitOf(vt.measure), cs), fail = cs.filter(c => c.v.vetoes.find(w => w.sound === s)!.hit).length;
    next.vetoes[s] = { measure: vt.measure, [vt.op === '>=' ? 'min' : 'max']: p.next };
    rows.push(`| ${vt.id} (${vt.measure}) | ${vt.op} ${vt.limit} | ${fail} of ${vals.length} | ${f1(Math.min(...vals))} to ${f1(Math.max(...vals))} | ${p.worst} | ${p.edge} | **${p.next}** |`);
  }
}
const len = cands.map(c => c.m.lengthMs), pl = propose(len, '<=', cfg.identity.maxLengthMs, 'ms', cands);
rows.push(`| none.length (lengthMs, all sounds) | <= ${cfg.identity.maxLengthMs} | ${len.filter(v => v > cfg.identity.maxLengthMs).length} of ${len.length} | ${Math.min(...len)} to ${Math.max(...len)} | ${pl.worst} | ${pl.edge} | **${pl.next}** |`);
md.push('## Proposed limits', '', `Edge: the strictest limit that still passes every candidate with a margin (${Object.entries(MARGIN).map(([u, v]) => `${v} ${u}`).join(', ')}), rounded outward. Proposed: the current limit if it already clears the edge, else the edge. config.json is not changed. A proposal far looser than the current limit can mean the measure, not the limit, is wrong for pros: listen to the worst clip first.`, '',
  '| rule | current | candidates failing | candidate range | worst clip | edge | proposed |', '|---|---|---|---|---|---|---|', ...rows, '',
  '```json', JSON.stringify(next, null, 1), '```', '', '## Listed times without a candidate', '',
  ...Object.entries(why).map(([k, v]) => `- ${k}: ${v.reason}`), '');
mkdirSync('data/pro', { recursive: true });
writeFileSync('data/pro/measures.md', md.join('\n'));

const count = (f: (c: Cand) => string) => [...new Set(cands.map(f))].map(k => `${k} ${cands.filter(c => f(c) === k).length}`).join(', ');
console.log(`${cands.length} candidates. Per sound: ${count(c => c.sound)}. Per source: ${count(c => c.source)}.`);
for (const [k, v] of Object.entries(why)) console.log(`dropped ${k}: ${v.reason}`);
console.log(JSON.stringify(next));
