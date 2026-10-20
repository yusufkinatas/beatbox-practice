// Scores the judge against the go bar (PLAN.md decision 20) and runs the rule audit (decision 9). Writes testset/report.md.
// Usage: node scripts/report.ts [--provisional] [--json]
//   --provisional  use every pro candidate the owner has not rejected (before any are approved); the audit is then not saved
//   --json         print the scores as JSON, for the tuning loop
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { decodeWav } from '../src/judge/dsp.ts';
import { judge, type Audit, type Config, type Model, type Sound, type Verdict } from '../src/judge/judge.ts';

const ROOT = join(dirname(new URL(import.meta.url).pathname), '..'), T = join(ROOT, 'testset');
const json = (p: string, fallback?: unknown) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback);
const cfg: Config = json(join(ROOT, 'src/judge/config.json')), model: Model = json(join(ROOT, 'src/judge/model.json'));
const args = process.argv.slice(2), provisional = args.includes('--provisional'), asJson = args.includes('--json');
const walk = (d: string): string[] => (existsSync(d) ? readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; }) : []);
const wavs = (d: string) => walk(join(T, d)).filter(f => f.endsWith('.wav')).sort();
const load = (f: string) => decodeWav(readFileSync(f));
const run = (f: string, target: Sound | null, audit: Audit, level = 3) => { const { x, sr } = load(f); return judge(x, sr, { model, cfg, audit, target, level }); };
const rel = (f: string) => relative(T, f);
const pct = (a: number, b: number) => (b ? Math.round(100 * a / b) : 0);
const fails = (v: Verdict) => v.checks.filter(c => c.active && !c.pass).map(c => c.id);

/* Pro clips: the "good" set. */
type Clip = { file: string; sound: Sound; source: string; time: number };
const CAND = join(T, 'pro/candidates');
const manifest: Clip[] = json(join(CAND, 'manifest.json'), []), review: Record<string, string> = json(join(T, 'pro/review.json'), {});
const pro = manifest.filter(c => (provisional ? review[c.file] !== 'rejected' : review[c.file] === 'approved'));

/* Rule audit: with every rule on, any rule that fails even one pro clip is switched off (decision 9). */
const blame: Record<string, string[]> = {};
for (const c of pro) {
  const v = run(join(CAND, c.file), c.sound, { disabled: {} });
  const ids = [...fails(v), ...v.vetoes.filter(x => x.hit && x.sound === c.sound).map(x => x.id), ...(v.noneReason === 'Too long for one hit.' ? ['none.length'] : [])];
  for (const id of ids) (blame[id] ??= []).push(c.file);
}
const audit: Audit = { disabled: Object.fromEntries(Object.entries(blame).map(([id, f]) => [id, `fails ${f.length} pro clip${f.length > 1 ? 's' : ''}: ${f.slice(0, 3).join(', ')}${f.length > 3 ? ', …' : ''}`])) };
const saveAudit = pro.length > 0 && !provisional;
if (saveAudit) writeFileSync(join(ROOT, 'src/judge/audit.json'), JSON.stringify(audit, null, 2) + '\n');

/* Score everything with the audited rules. */
const proRes = pro.map(c => ({ c, v: run(join(CAND, c.file), c.sound, audit) }));
const proFail = proRes.filter(r => r.v.result !== 'pass');

const MISTAKE: Record<string, string[]> = { vowel: ['vowel'], air: ['air'], voice: ['voice'], weak: ['low', 'punch'], quiet: ['loud'] };
const bad = wavs('bad').map(f => {
  const [sound, mistake] = basename(dirname(f)).split('-') as [Sound, string], v = run(f, sound, audit);
  // Right only if the user sees the tip: a failing check shows its tip on a 'fail' verdict; a weak kick may also be the B veto.
  const right = (v.result === 'fail' && fails(v).some(id => MISTAKE[mistake]?.includes(id.split('.')[0]))) || (mistake === 'weak' && v.vetoed === 'B' && v.result === 'wrong');
  return { f, label: `${sound}-${mistake}`, v, right };
});
const off = wavs('off').map(f => ({ f, kind: basename(dirname(f)), v: run(f, null, audit) })).map(r => ({ ...r, rejected: r.v.heard === 'none' }));
const unl = wavs('unlabelled').map(f => {
  const meta = json(f.replace(/\.wav$/, '.json'), {});
  return { f, meta, v: run(f, meta.target ?? null, audit, meta.level ?? 3) };
});
const intended = [...proRes.map(r => r.v), ...bad.map(r => r.v), ...unl.map(r => r.v)];
const unsure = intended.filter(v => v.result === 'unsure').length;

const s = {
  pro: { n: pro.length, pass: pro.length - proFail.length, provisional },
  bad: { n: bad.length, flagged: bad.filter(r => r.right).length },
  off: { n: off.length, rejected: off.filter(r => r.rejected).length },
  unsure: { n: intended.length, unsure },
  thumbs: { up: unl.filter(r => r.meta.thumb === 'up').length, down: unl.filter(r => r.meta.thumb === 'down').length },
  disabled: Object.keys(audit.disabled),
};
const bar = (a: number, n: number, min: number) => (n === 0 ? 'no data' : 100 * a / n >= min ? 'pass' : 100 * a / n >= 70 ? 'look at the failing rule' : 'FAIL');
const go = {
  pro: s.pro.n === 0 ? 'no data' : s.pro.pass === s.pro.n ? 'pass' : 'FAIL',
  bad: bar(s.bad.flagged, s.bad.n, 80),
  off: bar(s.off.rejected, s.off.n, 80),
  unsure: s.unsure.n === 0 ? 'no data' : 100 * unsure / s.unsure.n <= 10 ? 'pass' : 'FAIL',
};
const passes = Object.values(go).every(g => g === 'pass');
if (asJson) { console.log(JSON.stringify({ passes, go, ...s })); process.exit(0); }

/* report.md */
const r1 = (n: number) => Math.round(n * 10) / 10;
const why = (v: Verdict) => `${v.result}: ${v.title}${fails(v).length ? ` [${fails(v).join(', ')}]` : ''} · B ${pct(v.probs.B, 1)} t ${pct(v.probs.t, 1)} K ${pct(v.probs.K, 1)} · dist ${r1(v.dist)}`;
const group = <T,>(xs: T[], key: (x: T) => string) => xs.reduce((m, x) => ((m[key(x)] ??= []).push(x), m), {} as Record<string, T[]>);
const L: string[] = [];
L.push(`# Judge report`, '', `${new Date().toISOString().slice(0, 16).replace('T', ' ')} · model: ${model.info?.kind ?? 'model.json'} · config: src/judge/config.json`, '');
L.push(`## Go bar: ${passes ? 'PASS' : 'not yet'}`, '', '| Criterion | Score | Bar | Status |', '|---|---|---|---|');
L.push(`| Pro clips pass${provisional ? ' (provisional: unreviewed candidates)' : ''} | ${s.pro.pass} / ${s.pro.n} (${pct(s.pro.pass, s.pro.n)}%) | 100% | ${go.pro} |`);
L.push(`| Mistakes flagged with the right tip | ${s.bad.flagged} / ${s.bad.n} (${pct(s.bad.flagged, s.bad.n)}%) | ≥ 80% | ${go.bad} |`);
L.push(`| Off-target noises rejected | ${s.off.rejected} / ${s.off.n} (${pct(s.off.rejected, s.off.n)}%) | ≥ 80% | ${go.off} |`);
L.push(`| "Couldn't tell" | ${unsure} / ${s.unsure.n} (${pct(unsure, s.unsure.n)}%) | ≤ 10% | ${go.unsure} |`, '');
L.push(`## Rule audit`, '');
L.push(s.disabled.length ? s.disabled.map(id => `- **${id}** switched off: ${audit.disabled[id]}`).join('\n') : '- Every rule passes every pro clip.');
L.push('', saveAudit ? 'Saved to src/judge/audit.json (the app skips these rules until they are fixed).' : 'Not saved: no approved pro clips yet, or --provisional.', '');
if (bad.length) {
  L.push('## Mistakes by label', '', '| Label | Takes | Flagged right | Verdicts |', '|---|---|---|---|');
  for (const [k, rs] of Object.entries(group(bad, r => r.label))) {
    const res = Object.entries(group(rs, r => r.v.result)).map(([x, a]) => `${x} ${a.length}`).join(', ');
    L.push(`| ${k} | ${rs.length} | ${rs.filter(r => r.right).length} (${pct(rs.filter(r => r.right).length, rs.length)}%) | ${res} |`);
  }
  L.push('');
}
if (off.length) {
  L.push('## Off-target by kind', '', '| Noise | Takes | Rejected | Heard as |', '|---|---|---|---|');
  for (const [k, rs] of Object.entries(group(off, r => r.kind))) {
    const heard = Object.entries(group(rs, r => r.v.heard)).map(([x, a]) => `${x} ${a.length}`).join(', ');
    L.push(`| ${k} | ${rs.length} | ${rs.filter(r => r.rejected).length} | ${heard} |`);
  }
  L.push('');
}
const list = (title: string, rows: string[]) => { if (rows.length) L.push(`## ${title}`, '', ...rows.map(r => `- ${r}`), ''); };
list('Pro clips that fail', proFail.map(r => `${r.c.file} (${r.c.source} ${r.c.time} s): ${why(r.v)}`));
list('Mistakes not flagged right', bad.filter(r => !r.right).map(r => `${rel(r.f)}: ${why(r.v)}`));
list('Off-target noises accepted', off.filter(r => !r.rejected).map(r => `${rel(r.f)}: ${why(r.v)}`));
list('Thumbs down (review against the rule)', unl.filter(r => r.meta.thumb === 'down').map(r =>
  `${rel(r.f)}: then "${r.meta.verdict?.title}", now ${why(r.v)}`));
if (s.thumbs.up + s.thumbs.down) L.push(`Thumbs: ${s.thumbs.up} up, ${s.thumbs.down} down.`, '');
mkdirSync(T, { recursive: true });
writeFileSync(join(T, 'report.md'), L.join('\n'));
console.log(L.slice(0, 12).join('\n') + `\n\nFull report: testset/report.md`);
