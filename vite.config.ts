import { defineConfig, type Plugin } from 'vite';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const TESTSET = resolve('testset');

/* Dev only: the judge prototype reads and writes testset/ (git-ignored, never deployed). GET on a folder lists it recursively. */
function testsetApi(): Plugin {
  const walk = (d: string): string[] => readdirSync(d).flatMap(n => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : [relative(TESTSET, p)];
  });
  return {
    name: 'testset-api',
    configureServer(server) {
      server.middlewares.use('/api/testset', (req, res) => {
        const file = resolve(TESTSET, decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/^\/+/, ''));
        if (file !== TESTSET && !file.startsWith(TESTSET + '/')) { res.statusCode = 400; res.end('bad path'); return; }
        try {
          if (req.method === 'GET') {
            if (statSync(file, { throwIfNoEntry: false })?.isDirectory()) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(walk(file))); }
            else res.end(readFileSync(file));
          } else if (req.method === 'PUT') {
            const parts: Buffer[] = [];
            req.on('data', (c: Buffer) => parts.push(c));
            req.on('end', () => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, Buffer.concat(parts)); res.end('ok'); });
          } else if (req.method === 'DELETE') { rmSync(file, { force: true }); res.end('ok'); }
          else { res.statusCode = 405; res.end(); }
        } catch (e) {
          res.statusCode = (e as NodeJS.ErrnoException).code === 'ENOENT' ? 404 : 500;
          res.end(String(e));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [testsetApi()],
  build: { rollupOptions: { input: { main: 'index.html', judge: 'judge/index.html' } } },
});
