/* Judge prototype (PLAN.md build order step 2): live judging with the "Why?" view and thumbs, record-and-label,
   pro clip approval, and the phone export. A bare page on purpose: no designed screens yet. */
import cfgJson from '../judge/config.json';
import modelJson from '../judge/model.json';
import auditJson from '../judge/audit.json';
import { judge, NAME, SOUNDS, type Audit, type Config, type Model, type Sound, type Verdict } from '../judge/judge.ts';
import { HitDetector } from '../judge/detector.ts';
import { decodeWav, encodeWav } from '../judge/dsp.ts';
import { audio, ensureCtx, ensureMic, play } from './audio.ts';
import { browser, store } from './store.ts';

const cfg = structuredClone(cfgJson) as Config, model = modelJson as unknown as Model, audit = auditJson as Audit;
const DEV = import.meta.env.DEV;
type Mode = 'judge' | 'record' | 'pro' | 'takes';
type Take = { id: number; x: Float32Array; sr: number; v: Verdict; level: number; batch?: number; path?: string; thumb?: 'up' | 'down'; saving?: boolean };
type ProClip = { file: string; sound: Sound; source: string; url: string; time: number; x?: Float32Array; sr?: number; v?: Verdict };

const MISTAKES: Record<string, { label: string; sounds: Sound[] }> = {
  vowel: { label: 'Vowel tail ("buh")', sounds: ['B', 't', 'K'] },
  air: { label: 'Too much air', sounds: ['B', 't', 'K'] },
  voice: { label: 'Voiced', sounds: ['t', 'K'] },
  weak: { label: 'Weak kick', sounds: ['B'] },
  quiet: { label: 'Too quiet', sounds: ['B', 't', 'K'] },
};
const OFF = ['clap', 'cough', 'uh', 'click', 'speech', 'other'];

let saved: { trigger?: number; device?: string } = {};
try { saved = JSON.parse(localStorage.getItem('bbp.judge.v1') || '{}'); } catch { /* storage blocked */ }
if (Number.isFinite(saved.trigger)) cfg.detector.triggerDb = saved.trigger!;

const S = {
  mode: 'judge' as Mode,
  listening: false,
  target: null as Sound | null,
  level: 3,
  device: (saved.device ?? (matchMedia('(pointer: coarse)').matches ? 'phone' : 'laptop')) as 'phone' | 'laptop',
  hits: [] as Take[],
  rec: { role: 'bad' as 'bad' | 'off', sound: 'B' as Sound, mistake: 'vowel', kind: 'clap', count: 5, done: 0, batch: 0, takes: [] as Take[] },
  files: [] as string[],
  pro: [] as ProClip[],
  review: {} as Record<string, 'approved' | 'rejected'>,
  exp: null as null | { zip: Uint8Array<ArrayBuffer>; paths: string[]; url: string; name: string },
  msg: '',
};
const persist = () => { try { localStorage.setItem('bbp.judge.v1', JSON.stringify({ trigger: cfg.detector.triggerDb, device: S.device })); } catch { /* ignore */ } };

/* ---------- audio ---------- */
let det: HitDetector | null = null, nextId = 1, level = 0;
audio.onState = () => render();
audio.onChunk = x => {
  let p = 0;
  for (let i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i]));
  level = Math.max(p, level * 0.8);
  if (!S.listening || performance.now() < audio.mutedUntil) { det = null; return; }
  det ??= new HitDetector(audio.sr, cfg.detector);
  for (const h of det.push(x)) onHit(h.x, h.sr);
};
async function listen(on: boolean) {
  if (on && !(await ensureMic())) return;
  S.listening = on; det = null; render();
}

function onHit(x: Float32Array, sr: number) {
  const rec = S.mode === 'record';
  const target = rec ? (S.rec.role === 'bad' ? S.rec.sound : null) : S.target;
  const level = rec ? 3 : S.level, t: Take = { id: nextId++, x, sr, level, batch: S.rec.batch, v: judge(x, sr, { model, cfg, audit, target, level }) };
  if (!rec) { S.hits.unshift(t); S.hits.length = Math.min(S.hits.length, 30); render(); return; }
  const r = S.rec, label = r.role === 'bad' ? `${r.sound}-${r.mistake}` : r.kind;
  t.path = `${r.role}/${label}/${S.device}-${stamp()}.wav`;
  r.takes.unshift(t); r.done++;
  if (r.done >= r.count) S.listening = false;
  saveTake(t, { role: r.role, sound: r.role === 'bad' ? r.sound : null, label, mistake: r.role === 'bad' ? r.mistake : null });
}

const stamp = () => new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + '-' + Math.random().toString(36).slice(2, 6);
const summary = (v: Verdict) => ({
  result: v.result, heard: v.heard, target: v.target, title: v.title, tips: v.tips, model: v.model, probs: v.probs, dist: v.dist, vetoed: v.vetoed, noneReason: v.noneReason,
  checks: v.checks.map(c => ({ id: c.id, value: c.value, op: c.op, limit: c.limit, pass: c.pass, active: c.active })), m: v.m,
});
async function saveTake(t: Take, meta: object) {
  t.saving = true; render();
  try {
    await store.save(t.path!, encodeWav(t.x, t.sr));
    const json = { ...meta, device: S.device, sr: t.sr, preMs: cfg.detector.preMs, recordedAt: new Date().toISOString(), verdict: summary(t.v), ua: navigator.userAgent };
    await store.save(t.path!.replace(/\.wav$/, '.json'), new TextEncoder().encode(JSON.stringify(json, null, 1)));
    S.files = await store.list();
  } catch (e) { S.msg = `Could not save: ${e}`; }
  t.saving = false; render();
}
async function deleteTake(t: Take) {
  await store.remove(t.path!); await store.remove(t.path!.replace(/\.wav$/, '.json'));
  S.rec.takes = S.rec.takes.filter(x => x !== t);
  if (t.batch === S.rec.batch) S.rec.done = Math.max(0, S.rec.done - 1);
  S.files = await store.list(); render();
}
function thumb(t: Take, which: 'up' | 'down') {
  if (t.thumb) return;
  t.thumb = which;
  t.path = `unlabelled/${t.v.target ?? 'free'}/${S.device}-${stamp()}.wav`;
  saveTake(t, { role: 'unlabelled', target: t.v.target, level: t.level, thumb: which });
}

/* ---------- pro clips (dev server only: they live in testset/, never deployed) ---------- */
async function loadPro() {
  if (!DEV) return;
  const get = (p: string) => fetch('/api/testset/' + p).then(r => (r.ok ? r.json() : null)).catch(() => null);
  S.pro = (await get('pro/candidates/manifest.json')) ?? [];
  S.review = (await get('pro/review.json')) ?? {};
  render();
  for (const c of S.pro) {
    const r = await fetch('/api/testset/pro/candidates/' + c.file);
    if (!r.ok) continue;
    const { x, sr } = decodeWav(new Uint8Array(await r.arrayBuffer()));
    c.x = x; c.sr = sr; c.v = judge(x, sr, { model, cfg, audit, target: c.sound, level: 3 });
  }
  render();
}
async function setReview(file: string, v: 'approved' | 'rejected') {
  S.review[file] = v;
  await store.save('pro/review.json', new TextEncoder().encode(JSON.stringify(S.review, null, 1)));
  render();
}
function playPro(s: Sound) {
  const ok = S.pro.filter(c => c.sound === s && c.x && S.review[c.file] === 'approved');
  const c = ok[Math.floor(Math.random() * ok.length)];
  if (c) play(c.x!, c.sr!);
}

/* ---------- export (deployed app) ---------- */
async function prepareExport() {
  const { zip, paths } = await browser.exportZip();
  if (S.exp) URL.revokeObjectURL(S.exp.url);
  S.exp = { zip, paths, url: URL.createObjectURL(new Blob([zip], { type: 'application/zip' })), name: `beatbox-takes-${stamp()}.zip` };
  render();
}
async function share() {
  const e = S.exp!, file = new File([e.zip], e.name, { type: 'application/zip' });
  try {
    if (!navigator.canShare?.({ files: [file] })) throw new Error('no file sharing');
    await navigator.share({ files: [file], title: 'Beatbox takes' });
  } catch (err) {
    if ((err as Error).name === 'AbortError') return;
    const a = document.createElement('a'); a.href = e.url; a.download = e.name; a.click();
  }
  await browser.markExported(e.paths);
  S.msg = `Exported ${e.paths.length} files. Delete them here once they are on the computer.`;
  render();
}

/* ---------- render ---------- */
const esc = (s: unknown) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const r1 = (n: number) => (Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10);
const ICON: Record<string, string> = { pass: '✓', fail: '✗', wrong: '✗', none: '∅', unsure: '?' };
const btn = (act: string, label: string, on = false, extra = '') => `<button type="button" data-act="${act}"${on ? ' aria-pressed="true"' : ''} ${extra}>${label}</button>`;

function why(v: Verdict): string {
  const rows = v.checks.map(c => {
    const st = c.off ? `off: ${esc(c.off)}` : !c.active ? `level ${c.level}` : c.pass ? '✓' : '✗';
    return `<tr class="${c.active ? (c.pass ? 'ok' : 'bad') : 'na'}"><td>${c.label}</td><td>${r1(c.value)} ${c.unit}</td><td>${c.op === '>=' ? '≥' : '≤'} ${c.limit}</td><td>${st}</td></tr>`;
  }).join('');
  const pc = (p: Record<Sound, number>) => SOUNDS.map(s => `${s} ${Math.round(p[s] * 100)}%`).join(' · ');
  const probs = pc(v.model) + (v.vetoes.some(x => x.hit) ? ` → after vetoes ${pc(v.probs)}` : '');
  const vetoes = v.vetoes.map(x => `<li class="${x.hit ? 'bad' : ''}">${x.sound}: ${x.measure} ${r1(x.value)} (needs ${x.op === '>=' ? '≥' : '≤'} ${x.limit})${x.off ? ` off: ${esc(x.off)}` : x.hit ? ' <b>fired</b>' : ''}</li>`).join('');
  return `<div class="why"><h4>Why?</h4>
    ${rows ? `<table><tr><th>Check</th><th>Value</th><th>Limit</th><th></th></tr>${rows}</table>` : ''}
    <p>Model: ${probs} · unsure below ${Math.round(cfg.identity.unsureProb * 100)}%</p>
    <p>Distance ${r1(v.dist)} (none above ${r1(model.noneDist * cfg.identity.noneScale)})${v.noneReason ? ` · <b>${esc(v.noneReason)}</b>` : ''}</p>
    <ul class="vetoes">${vetoes}</ul>
    <p class="dim">Length ${v.m.lengthMs} ms · peak ${r1(v.m.peakDb)} dBFS · centroid ${r1(v.m.centroidKHz)} kHz</p></div>`;
}
function card(t: Take, opts: { thumbs?: boolean; del?: boolean; pro?: Sound | null }): string {
  const v = t.v, ref = opts.pro && S.pro.some(c => c.sound === opts.pro && S.review[c.file] === 'approved');
  return `<article class="hit r-${v.result}" data-id="${t.id}">
    <h3><span class="ic">${ICON[v.result]}</span> ${esc(v.title)}</h3>
    ${v.tips.length ? `<ul class="tips">${v.tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    <div class="row">${btn('play', '▶ Your hit')}${ref ? btn('pro', `▶ Pro ${NAME[opts.pro!]}`) : ''}
      ${opts.thumbs ? (t.thumb ? `<span class="dim">${t.thumb === 'up' ? '👍' : '👎'} ${t.saving ? 'saving…' : 'saved'}</span>` : btn('up', '👍', false, 'aria-label="Verdict is right"') + btn('down', '👎', false, 'aria-label="Verdict is wrong"')) : ''}
      ${opts.del ? `<span class="dim">${t.saving ? 'saving…' : esc(t.path)}</span>${btn('del', 'Delete')}` : ''}</div>
    ${why(v)}</article>`;
}

function coverage(): string {
  const n = (prefix: string, dev: string) => S.files.filter(f => f.startsWith(prefix + '/' + dev + '-') && f.endsWith('.wav')).length;
  const rows = [
    ...SOUNDS.flatMap(s => Object.entries(MISTAKES).filter(([, m]) => m.sounds.includes(s)).map(([k, m]) => [`bad/${s}-${k}`, `${s}: ${m.label}`])),
    ...OFF.map(k => [`off/${k}`, `Off-target: ${k}`]),
  ];
  return `<table class="cov"><tr><th>Label</th><th>Laptop</th><th>Phone</th></tr>${rows.map(([p, l]) => {
    const a = n(p, 'laptop'), b = n(p, 'phone');
    return `<tr><td>${esc(l)}</td><td class="${a >= 5 ? 'ok' : ''}">${a}</td><td class="${b >= 5 ? 'ok' : ''}">${b}</td></tr>`;
  }).join('')}</table><p class="dim">Goal: 5 of each mistake per sound and about 15 off-target noises, on both phone and laptop.</p>`;
}

function micRow(): string {
  return `<div class="row mic">${audio.state === 'blocked' ? '<b>Mic blocked.</b> Allow the microphone for this site, then try again.' : ''}
    <span class="dim">Trigger ${cfg.detector.triggerDb} dBFS</span>${btn('trig-', '−', false, 'aria-label="Lower trigger"')}${btn('trig+', '+', false, 'aria-label="Raise trigger"')}
    <span class="dim">Device</span>${btn('dev-laptop', 'Laptop', S.device === 'laptop')}${btn('dev-phone', 'Phone', S.device === 'phone')}</div>`;
}

function viewJudge(): string {
  return `<section class="ctl">
    <div class="row"><span class="dim">Target</span>${btn('target-free', 'Free', !S.target)}${SOUNDS.map(s => btn('target-' + s, s, S.target === s)).join('')}</div>
    <div class="row"><span class="dim">Level</span>${[1, 2, 3].map(l => btn('level-' + l, String(l), S.level === l)).join('')}</div>
    ${micRow()}
    <div class="row">${btn('listen', S.listening ? '■ Stop' : '● Listen', S.listening, 'class="big"')}
      ${S.target && S.pro.some(c => c.sound === S.target && S.review[c.file] === 'approved') ? btn('pro-target', `▶ Pro ${NAME[S.target]}`) : ''}</div>
    <p class="dim">One sound at a time. Thumbs save the hit to unlabelled/ with your rating.</p></section>
    ${S.hits.map(t => card(t, { thumbs: true, pro: S.target ?? (SOUNDS.includes(t.v.heard as Sound) ? t.v.heard as Sound : null) })).join('')}`;
}

function viewRecord(): string {
  const r = S.rec, active = S.listening;
  const what = r.role === 'bad' ? `${r.sound}, ${MISTAKES[r.mistake].label.toLowerCase()}` : `off-target: ${r.kind}`;
  return `<section class="ctl">
    <div class="row"><span class="dim">Record</span>${btn('role-bad', 'Mistake on purpose', r.role === 'bad')}${btn('role-off', 'Off-target noise', r.role === 'off')}</div>
    ${r.role === 'bad' ? `<div class="row"><span class="dim">Sound</span>${SOUNDS.map(s => btn('rsound-' + s, s, r.sound === s)).join('')}</div>
      <div class="row"><span class="dim">Mistake</span>${Object.entries(MISTAKES).filter(([, m]) => m.sounds.includes(r.sound)).map(([k, m]) => btn('mistake-' + k, esc(m.label), r.mistake === k)).join('')}</div>`
    : `<div class="row"><span class="dim">Noise</span>${OFF.map(k => btn('kind-' + k, k, r.kind === k)).join('')}</div>`}
    <div class="row"><span class="dim">Takes</span>${[1, 5, 10].map(n => btn('count-' + n, String(n), r.count === n)).join('')}</div>
    ${micRow()}
    <div class="row">${btn('rec', active ? `■ Stop (${r.done} of ${r.count})` : `● Record ${r.count} × ${esc(what)}`, active, 'class="big"')}</div>
    <p class="dim">Exaggerate the mistake. Each hit is saved as soon as it is cut. ${store.where === 'testset' ? 'Saving into testset/.' : 'Saving on this device. Export from Takes.'}</p></section>
    ${r.takes.map(t => card(t, { del: true })).join('')}
    <h2>Coverage</h2>${coverage()}`;
}

function viewPro(): string {
  if (!S.pro.length) return '<p>No candidates. Run <code>node scripts/pro-clips.ts</code> first.</p>';
  const count = (s: Sound, v?: string) => S.pro.filter(c => c.sound === s && S.review[c.file] === v).length;
  return `<p class="dim">Listen to each clip and approve only clean, isolated hits. Approved clips are the "good" set: every rule must pass all of them.</p>
    ${SOUNDS.map(s => `<h2>${s} · ${NAME[s]} <span class="dim">${count(s, 'approved')} approved, ${count(s, 'rejected')} rejected, ${count(s, undefined)} to do</span></h2>
    ${S.pro.filter(c => c.sound === s).map(c => `<article class="hit pro r-${c.v?.result ?? 'unsure'} ${S.review[c.file] ?? 'todo'}" data-file="${esc(c.file)}">
      <h3>${esc(c.source)} <a href="${esc(c.url)}" target="_blank" rel="noopener">${c.time} s</a> <span class="dim">${S.review[c.file] ?? ''}</span></h3>
      <div class="row">${btn('pplay', '▶ Play')}${btn('approve', 'Approve', S.review[c.file] === 'approved')}${btn('reject', 'Reject', S.review[c.file] === 'rejected')}
        <span class="dim">${c.v ? `${ICON[c.v.result]} ${esc(c.v.title)}` : 'judging…'}</span></div>
      ${c.v ? `<details><summary>Why?</summary>${why(c.v)}</details>` : ''}</article>`).join('')}`).join('')}`;
}

function viewTakes(): string {
  if (store.where === 'testset') return `<p>This is the dev server: takes save straight into <code>testset/</code> on this computer (${S.files.filter(f => f.endsWith('.wav')).length} WAVs).</p>${coverage()}`;
  const n = S.files.filter(f => f.endsWith('.wav')).length;
  return `<p>${n} takes saved on this device. Browser storage can be cleared, so export after each recording session.</p>
    <div class="row">${btn('prep', 'Prepare export')}${S.exp ? btn('share', `Share zip (${(S.exp.zip.length / 1e6).toFixed(1)} MB)`) + `<a href="${S.exp.url}" download="${S.exp.name}">Download</a>` : ''}</div>
    <div class="row">${btn('clear', 'Delete exported takes')}</div>
    <p class="dim">On the computer: <code>npm run import -- ~/Downloads/${S.exp?.name ?? 'beatbox-takes-….zip'}</code></p>${coverage()}`;
}

function render() {
  for (const b of document.querySelectorAll<HTMLButtonElement>('#tabs [data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === S.mode));
  const views = { judge: viewJudge, record: viewRecord, pro: viewPro, takes: viewTakes };
  document.getElementById('app')!.innerHTML = (S.msg ? `<p class="msg">${esc(S.msg)}</p>` : '') + views[S.mode]();
}

/* ---------- events ---------- */
const take = (el: Element) => {
  const id = Number(el.closest<HTMLElement>('[data-id]')?.dataset.id);
  return [...S.hits, ...S.rec.takes].find(t => t.id === id);
};
document.addEventListener('click', e => {
  const b = (e.target as Element).closest<HTMLElement>('[data-act],[data-mode]');
  if (!b) return;
  ensureCtx();
  if (b.dataset.mode) { S.mode = b.dataset.mode as Mode; S.listening = false; S.msg = ''; render(); return; }
  const a = b.dataset.act!, [k, v] = a.split('-'), t = take(b), file = b.closest<HTMLElement>('[data-file]')?.dataset.file;
  const pc = S.pro.find(c => c.file === file);
  if (a === 'listen') listen(!S.listening);
  else if (a === 'rec') { if (!S.listening) { S.rec.done = 0; S.rec.batch++; } listen(!S.listening); }
  else if (k === 'target') { S.target = v === 'free' ? null : (v as Sound); render(); }
  else if (k === 'level') { S.level = Number(v); render(); }
  else if (a === 'trig+') { cfg.detector.triggerDb += 2; det = null; persist(); render(); }
  else if (a === 'trig-') { cfg.detector.triggerDb -= 2; det = null; persist(); render(); }
  else if (k === 'dev') { S.device = v as 'phone' | 'laptop'; persist(); render(); }
  else if (k === 'role') { S.rec.role = v as 'bad' | 'off'; render(); }
  else if (k === 'rsound') { S.rec.sound = v as Sound; if (!MISTAKES[S.rec.mistake].sounds.includes(S.rec.sound)) S.rec.mistake = 'vowel'; render(); }
  else if (k === 'mistake') { S.rec.mistake = v; render(); }
  else if (k === 'kind') { S.rec.kind = v; render(); }
  else if (k === 'count') { S.rec.count = Number(v); render(); }
  else if (a === 'play' && t) play(t.x, t.sr);
  else if (a === 'pro' && t) playPro((S.target ?? t.v.heard) as Sound);
  else if (a === 'pro-target' && S.target) playPro(S.target);
  else if ((a === 'up' || a === 'down') && t) thumb(t, a);
  else if (a === 'del' && t) deleteTake(t);
  else if (a === 'pplay' && pc?.x) play(pc.x, pc.sr!);
  else if ((a === 'approve' || a === 'reject') && file) setReview(file, a === 'approve' ? 'approved' : 'rejected');
  else if (a === 'prep') prepareExport();
  else if (a === 'share' && S.exp) share();
  else if (a === 'clear') browser.removeExported().then(async () => { S.files = await store.list(); S.msg = 'Deleted exported takes.'; render(); });
});
document.addEventListener('visibilitychange', () => { if (document.hidden && S.listening) listen(false); });

/* level meter, outside render so it does not rebuild the page */
const meter = document.getElementById('meter')!;
(function frame() {
  requestAnimationFrame(frame);
  const d = 20 * Math.log10(Math.max(level, 1e-6));
  meter.style.setProperty('--lv', String(Math.max(0, Math.min(1, (d + 72) / 66))));
  meter.style.setProperty('--tr', String(Math.max(0, Math.min(1, (cfg.detector.triggerDb + 72) / 66))));
  level *= 0.97;
})();

if (!DEV) document.querySelector('[data-mode="pro"]')?.remove();
store.list().then(f => { S.files = f; render(); }).catch(() => {});
render();
loadPro();
