/* The judge: identity from the model plus vetoes, quality from rules. See PLAN.md decisions 3 to 9. */
import { analyze, type AnalysisCfg, type Measures } from './analyze.ts';
import type { DetectorCfg } from './detector.ts';
import { HOW, NONE, TIPS, UNSURE, VETO } from './tips.ts';

export type Sound = 'B' | 't' | 'K';
export const SOUNDS: Sound[] = ['B', 't', 'K'];
export const NAME: Record<Sound, string> = { B: 'kick', t: 'hi-hat', K: 'snare' };

export type CheckId = 'loud' | 'vowel' | 'air' | 'voice' | 'low' | 'punch';
const CHECKS: Record<CheckId, { measure: keyof Measures; label: string; short: string; unit: string }> = {
  loud: { measure: 'peakDb', label: 'Loudness', short: 'too quiet', unit: 'dBFS' },
  vowel: { measure: 'vowelMs', label: 'Vowel tail', short: 'vowel tail', unit: 'ms' },
  air: { measure: 'airMs', label: 'Air after the hit', short: 'too much air', unit: 'ms' },
  voice: { measure: 'voicedMs', label: 'Voice', short: 'voiced', unit: 'ms' },
  low: { measure: 'lowDb', label: 'Low end', short: 'weak low end', unit: 'dB' },
  punch: { measure: 'punchDb', label: 'Punch', short: 'no punch', unit: 'dB' },
};
export const CHECK_IDS = Object.keys(CHECKS) as CheckId[];

export type Limit = { level: number; min?: Partial<Record<Sound, number>>; max?: Partial<Record<Sound, number>> };
export type Config = {
  detector: DetectorCfg;
  analysis: AnalysisCfg;
  identity: { unsureProb: number; noneScale: number; maxLengthMs: number; vetoFloor: number };
  checks: Record<CheckId, Limit>;
  vetoes: Partial<Record<Sound, { measure: keyof Measures; min?: number; max?: number }>>;
};

/** Exported by scripts/train.py. A softmax MLP over standardised features (no hidden layer = logistic regression). */
export type Model = {
  classes: Sound[];
  mean: number[];
  sd: number[];
  layers: { W: number[][]; b: number[] }[];   // W[out][in], ReLU between layers
  centroids: number[][];                      // per class, standardised feature space
  spread: number[][];
  noneDist: number;                           // a hit further than this from every class is none of the sounds
  info?: Record<string, unknown>;
};

/** Rules switched off by the audit in scripts/report.ts, by rule id, with the reason. */
export type Audit = { disabled: Record<string, string> };

export type Check = {
  id: string; check: CheckId; label: string; short: string; unit: string;
  value: number; op: '>=' | '<='; limit: number; pass: boolean; level: number; active: boolean; off?: string; tip: string;
};
export type Veto = { id: string; sound: Sound; measure: keyof Measures; value: number; op: '>=' | '<='; limit: number; reason: string; off?: string; hit: boolean };
export type Result = 'pass' | 'fail' | 'wrong' | 'none' | 'unsure';
export type Verdict = {
  result: Result;
  heard: Sound | 'none' | 'unsure';
  target: Sound | null;
  title: string;
  tips: string[];
  model: Record<Sound, number>;   // the model's confidence per sound
  probs: Record<Sound, number>;   // after vetoes: vetoed sounds get 0, the rest are renormalised
  dist: number;
  vetoes: Veto[];         // every veto rule, with whether it fired
  vetoed: Sound | null;   // the sound whose veto decided the verdict: the target, or the model's pick when nothing else was left
  noneReason: string;
  checks: Check[];        // every check for the judged sound, active or not
  m: Measures;
};

export function predict(model: Model, f: number[]): { probs: Record<Sound, number>; dist: number } {
  let h = f.map((v, i) => (v - model.mean[i]) / (model.sd[i] || 1));
  const z = h;
  model.layers.forEach((L, li) => {
    const o = L.W.map((row, j) => row.reduce((a, w, i) => a + w * h[i], L.b[j]));
    h = li < model.layers.length - 1 ? o.map(v => Math.max(0, v)) : o;
  });
  const mx = Math.max(...h), e = h.map(v => Math.exp(v - mx)), s = e.reduce((a, v) => a + v, 0);
  const probs = { B: 0, t: 0, K: 0 };
  model.classes.forEach((c, i) => { probs[c] = e[i] / s; });
  const dist = Math.min(...model.centroids.map((c, k) =>
    Math.sqrt(c.reduce((a, cv, i) => a + ((z[i] - cv) / (model.spread[k][i] || 1)) ** 2, 0) / c.length)));
  return { probs, dist };
}

function vetoesFor(m: Measures, cfg: Config, audit: Audit): Veto[] {
  return SOUNDS.flatMap(s => {
    const v = cfg.vetoes[s];
    if (!v) return [];
    const id = `veto.${s}`, value = m[v.measure], op = v.min !== undefined ? '>=' : '<=', limit = (v.min ?? v.max) as number;
    const off = audit.disabled[id];
    const hit = !off && (op === '>=' ? value < limit : value > limit);
    return [{ id, sound: s, measure: v.measure, value, op, limit, reason: VETO[s], off, hit } as Veto];
  });
}

function checksFor(s: Sound, m: Measures, cfg: Config, audit: Audit, level: number): Check[] {
  return CHECK_IDS.flatMap(c => {
    const L = cfg.checks[c], lim = L.min?.[s] ?? L.max?.[s];
    if (lim === undefined) return [];
    const meta = CHECKS[c], id = `${c}.${s}`, op = L.min?.[s] !== undefined ? '>=' : '<=', value = m[meta.measure];
    const off = audit.disabled[id];
    return [{
      id, check: c, label: meta.label, short: meta.short, unit: meta.unit, value, op, limit: lim,
      pass: op === '>=' ? value >= lim : value <= lim, level: L.level, active: !off && L.level <= level, off, tip: TIPS[c][s] ?? '',
    } as Check];
  });
}

export type JudgeOpts = { model: Model; cfg: Config; audit?: Audit; target?: Sound | null; level?: number };

/** raw: a hit as the detector cuts it (onset at cfg.detector.preMs), at sample rate sr. */
export function judge(raw: Float32Array, sr: number, o: JudgeOpts): Verdict {
  const { m, features } = analyze(raw, sr, o.cfg.detector.preMs, o.cfg.analysis);
  return judgeMeasured(m, features, o);
}

export function judgeMeasured(m: Measures, features: number[], o: JudgeOpts): Verdict {
  const cfg = o.cfg, id = cfg.identity, audit = o.audit ?? { disabled: {} }, target = o.target ?? null, level = o.level ?? 3;
  const { probs: model, dist } = predict(o.model, features);
  const vetoes = vetoesFor(m, cfg, audit), out = (s: Sound) => vetoes.some(v => v.hit && v.sound === s);
  const argmax = (p: Record<Sound, number>) => SOUNDS.reduce((a, s) => (p[s] > p[a] ? s : a), 'B' as Sound);
  // A veto takes a sound away; the sounds left share what the model gave them (decision 5).
  const left = SOUNDS.filter(s => !out(s)), mass = left.reduce((a, s) => a + model[s], 0), gone = mass < id.vetoFloor;
  const probs = { B: 0, t: 0, K: 0 };
  if (!gone) for (const s of left) probs[s] = model[s] / mass;
  const top = argmax(probs);

  const far = dist > o.model.noneDist * id.noneScale ? 'Far from every sound the model knows.'
    : !audit.disabled['none.length'] && m.lengthMs > id.maxLengthMs ? 'Too long for one hit.' : '';
  const vetoed = far ? null : target ? (out(target) ? target : null) : gone ? argmax(model) : null;
  const noneReason = far || (gone ? `Vetoed: ${VETO[argmax(model)]}` : '');
  const heard: Verdict['heard'] = far || gone ? 'none' : probs[top] < id.unsureProb ? 'unsure' : top;
  const judged: Sound | null = target ?? (heard === 'none' || heard === 'unsure' ? null : heard);
  const checks = judged ? checksFor(judged, m, cfg, audit, level) : [];
  const failing = checks.filter(c => c.active && !c.pass);
  const v = { heard, target, model, probs, dist, vetoes, vetoed, noneReason, checks, m };

  if (vetoed) return { ...v, result: target ? 'wrong' : 'none', title: VETO[vetoed], tips: [target ? HOW[target] : NONE] };
  if (heard === 'none') return { ...v, result: 'none', title: 'Not any of your sounds.', tips: [target ? HOW[target] : NONE] };
  if (heard === 'unsure') return { ...v, result: 'unsure', title: "Couldn't tell, try again.", tips: [UNSURE] };
  if (target && heard !== target) return { ...v, result: 'wrong', title: `That was a ${NAME[heard]}, not a ${NAME[target]}.`, tips: [HOW[target]] };
  const s = heard;
  if (!failing.length) return { ...v, result: 'pass', title: `Clean ${NAME[s]}.`, tips: [] };
  return { ...v, result: 'fail', title: `${cap(NAME[s])}: ${failing.map(c => c.short).join(', ')}.`, tips: failing.map(c => c.tip) };
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
