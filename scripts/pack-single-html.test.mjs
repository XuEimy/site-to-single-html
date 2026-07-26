import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

test('packs linked assets into one HTML file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'single-html-skill-'));
  const entry = join(directory, 'index.html');
  const output = join(directory, 'packed.html');
  await writeFile(join(directory, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="5" r="5"/></svg>');
  await writeFile(join(directory, 'style.css'), 'body{background:url("./icon.svg")}');
  await writeFile(join(directory, 'app.js'), 'document.body.dataset.ready="true";');
  await writeFile(entry, `<!doctype html><html><head><link rel="stylesheet" href="./style.css"></head><body><img src="./icon.svg"><a href="#/next">Next</a><script src="./app.js"></script></body></html>`);

  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./pack-single-html.mjs', import.meta.url)), '--input', entry, '--output', output], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const packed = await readFile(output, 'utf8');
  assert.match(packed, /single-html-packaged/);
  assert.match(packed, /data:image\/svg\+xml;base64/);
  assert.match(packed, /document\.body\.dataset\.ready/);
  assert.match(packed, /href="#\/next"/);
  assert.doesNotMatch(packed, /src="\.\/icon\.svg"/);
  assert.doesNotMatch(packed, /href="\.\/style\.css"/);
  assert.doesNotMatch(packed, /src="\.\/app\.js"/);
});
