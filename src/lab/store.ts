/* Where takes go. Dev server: straight into testset/. Deployed app: the browser's IndexedDB until exported as a zip (PLAN.md decisions 23, 24). */
import { zip } from './zip.ts';

export type Store = {
  where: 'testset' | 'browser';
  save(path: string, data: Uint8Array<ArrayBuffer>): Promise<void>;
  list(): Promise<string[]>;
  remove(path: string): Promise<void>;
};

const api = (path: string) => '/api/testset/' + path.split('/').map(encodeURIComponent).join('/');

const dev: Store = {
  where: 'testset',
  async save(path, data) {
    const r = await fetch(api(path), { method: 'PUT', body: data });
    if (!r.ok) throw new Error(`save failed: ${r.status}`);
  },
  async list() {
    const r = await fetch(api(''));
    return r.ok ? r.json() : [];
  },
  async remove(path) { await fetch(api(path), { method: 'DELETE' }); },
};

type Row = { path: string; data: ArrayBuffer; exported: boolean };
let dbp: Promise<IDBDatabase> | null = null;
const db = () => dbp ??= new Promise((ok, no) => {
  const r = indexedDB.open('bbp-judge', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('takes', { keyPath: 'path' });
  r.onsuccess = () => ok(r.result);
  r.onerror = () => no(r.error);
});
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const s = (await db()).transaction('takes', mode).objectStore('takes');
  return new Promise((ok, no) => { const r = fn(s); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
}

export const browser = {
  where: 'browser' as const,
  save: (path: string, data: Uint8Array<ArrayBuffer>) => tx('readwrite', s => s.put({ path, data: data.slice().buffer, exported: false } satisfies Row)).then(() => {}),
  list: () => tx('readonly', s => s.getAllKeys()).then(k => k as string[]),
  remove: (path: string) => tx('readwrite', s => s.delete(path)).then(() => {}),
  all: () => tx('readonly', s => s.getAll()) as Promise<Row[]>,
  /** Every take in one zip, paths relative to testset/ so scripts/import.sh can unzip it in place. */
  async exportZip(): Promise<{ zip: Uint8Array<ArrayBuffer>; paths: string[] }> {
    const rows = await browser.all();
    return { zip: zip(rows.map(r => ({ name: r.path, data: new Uint8Array(r.data) }))), paths: rows.map(r => r.path) };
  },
  async markExported(paths: string[]) {
    for (const r of await browser.all()) if (paths.includes(r.path)) await tx('readwrite', s => s.put({ ...r, exported: true }));
  },
  async removeExported() {
    for (const r of await browser.all()) if (r.exported) await browser.remove(r.path);
  },
};

export const store: Store = import.meta.env.DEV ? dev : browser;
