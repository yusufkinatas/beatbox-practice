// The phone export must open with plain unzip (scripts/import.sh).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zip } from './zip.ts';

test('zip opens with unzip and keeps paths and bytes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'zip-')), wav = Uint8Array.from({ length: 5000 }, (_, i) => (i * 7) & 255);
  writeFileSync(join(dir, 'x.zip'), zip([{ name: 'bad/B-vowel/phone-1.wav', data: wav }, { name: 'bad/B-vowel/phone-1.json', data: new TextEncoder().encode('{"a":1}') }]));
  execFileSync('unzip', ['-tq', 'x.zip'], { cwd: dir });
  execFileSync('unzip', ['-q', 'x.zip', '-d', 'out'], { cwd: dir });
  assert.deepEqual(new Uint8Array(readFileSync(join(dir, 'out/bad/B-vowel/phone-1.wav'))), wav);
  assert.equal(readFileSync(join(dir, 'out/bad/B-vowel/phone-1.json'), 'utf8'), '{"a":1}');
});
