/* Cuts every annotated AVP hit the way the app does and measures it with the shared analyze(), for scripts/train.py.
   Run from the project root: node scripts/avp-features.ts           -> data/avp/features.json
                              node scripts/avp-features.ts --check   -> predict() on model.json vs sklearn (data/avp/sk-pred.json) */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { decodeWav } from '../src/judge/dsp.ts';
import { detectAll, onsetIndex, type Hit } from '../src/judge/detector.ts';
import { analyze } from '../src/judge/analyze.ts';
import { predict, type Config, type Model } from '../src/judge/judge.ts';

const ROOT = 'data/avp/x/AVP_Dataset', OUT = 'data/avp/features.json', PRED = 'data/avp/sk-pred.json';
const MATCH_MS = 40, GAINS = [0, -6, -12, -18, -24];   // detector offsets tried per file (trigger and end level together, i.e. a gain)
const cfg: Config = JSON.parse(readFileSync('src/judge/config.json', 'utf8'));
const dc = cfg.detector;

if (process.argv.includes('--check')) check(); else extract();

type Ann = { t: number; label: string; phon: string };

function extract(): void {
  const rows: unknown[] = [];
  let hits = 0, matched = 0, skipped = 0;
  const offs: number[] = [], gains: Record<string, number> = {};
  for (const subset of ['Personal', 'Fixed']) for (const p of readdirSync(`${ROOT}/${subset}`).filter(d => d.startsWith('Participant_'))) {
    const dir = `${ROOT}/${subset}/${p}`;
    for (const csv of readdirSync(dir).filter(f => f.endsWith('.csv'))) {
      const file = csv.slice(0, -4);
      const ann: Ann[] = readFileSync(`${dir}/${csv}`, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim()).map(l => {
        const [t, label, phon = ''] = l.split(',').map(s => s.trim());
        return { t: +t, label, phon };
      }).sort((a, b) => a.t - b.t);
      const { x, sr } = decodeWav(readFileSync(`${dir}/${file}.wav`));
      // Quiet files: lower the detector levels until it finds the most annotated hits (only where hits start changes; features ignore gain).
      let best: { g: number; m: (Hit | null)[]; n: number } | null = null;
      for (const g of GAINS) {
        const m = match(ann, detectAll(x, sr, { ...dc, triggerDb: dc.triggerDb + g, endDb: dc.endDb + g }), sr), n = m.filter(Boolean).length;
        if (!best || n > best.n) best = { g, m, n };
      }
      gains[best!.g] = (gains[best!.g] ?? 0) + 1;
      const pre = onsetIndex(sr, dc.preMs), maxN = Math.round(dc.maxMs * sr / 1000);
      const on = ann.map((a, i) => best!.m[i]?.at ?? Math.round(a.t * sr));
      ann.forEach((a, i) => {
        const d = best!.m[i], start = on[i];
        // Same layout as the detector's cut: onset at preMs, at most maxMs after it, ending at the next hit or where the detector ended it.
        const end = Math.min(start + maxN, i + 1 < on.length ? on[i + 1] : x.length, d ? d.at + d.x.length - pre : Infinity, x.length);
        if (end - start < sr * 0.02) { skipped++; return; }
        const cut = new Float32Array(end - start + pre);
        for (let j = 0; j < cut.length; j++) { const k = start - pre + j; if (k >= 0) cut[j] = x[k]; }
        const { m, features } = analyze(cut, sr, dc.preMs, cfg.analysis);
        hits++;
        if (d) { matched++; offs.push((d.at / sr - a.t) * 1000); }
        rows.push({ participant: p.replace('Participant_', 'P'), subset, file, label: a.label, phon: a.phon, matched: !!d, features, m });
      });
    }
  }
  writeFileSync(OUT, JSON.stringify(rows));
  offs.sort((a, b) => a - b);
  const q = (f: number) => offs[Math.floor(f * (offs.length - 1))].toFixed(1);
  console.log(`${hits} hits cut (${skipped} skipped, shorter than 20 ms), ${matched} matched a detection (${(100 * matched / hits).toFixed(1)}%)`);
  console.log(`detection minus annotation, ms: p5 ${q(0.05)}, median ${q(0.5)}, p95 ${q(0.95)}; files per detector offset (dB):`, gains);
}

/** Each annotation takes the nearest unused detection within MATCH_MS. */
function match(ann: Ann[], hits: Hit[], sr: number): (Hit | null)[] {
  const used = new Set<Hit>(), w = MATCH_MS * sr / 1000;
  return ann.map(a => {
    let best: Hit | null = null;
    for (const h of hits) if (!used.has(h) && Math.abs(h.at - a.t * sr) <= w && (!best || Math.abs(h.at - a.t * sr) < Math.abs(best.at - a.t * sr))) best = h;
    if (best) used.add(best);
    return best;
  });
}

function check(): void {
  const model: Model = JSON.parse(readFileSync('src/judge/model.json', 'utf8'));
  const rows: { features: number[] }[] = JSON.parse(readFileSync(OUT, 'utf8'));
  const sk: { p: number[]; dist: number }[] = JSON.parse(readFileSync(PRED, 'utf8'));
  let same = 0, dp = 0, dd = 0;
  rows.forEach((r, i) => {
    const { probs, dist } = predict(model, r.features), p = model.classes.map(c => probs[c]);
    if (p.indexOf(Math.max(...p)) === sk[i].p.indexOf(Math.max(...sk[i].p))) same++;
    dp = Math.max(dp, ...p.map((v, k) => Math.abs(v - sk[i].p[k])));
    dd = Math.max(dd, Math.abs(dist - sk[i].dist) / sk[i].dist);
  });
  console.log(`parity: ${same}/${rows.length} same class (${(100 * same / rows.length).toFixed(3)}%), max prob diff ${dp.toExponential(2)}, max relative dist diff ${dd.toExponential(2)}`);
  if (same < 0.999 * rows.length) process.exit(1);
}
