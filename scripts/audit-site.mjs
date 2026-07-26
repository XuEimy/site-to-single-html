#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = argv[index + 1];
    args[key] = next && !next.startsWith('--') ? (index += 1, next) : true;
  }
  return args;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function collect(pattern, source, group = 1) {
  return [...source.matchAll(pattern)].map((match) => match[group]?.trim()).filter(Boolean);
}

function classify(reference, baseUrl) {
  if (/^(?:data:|blob:|javascript:|mailto:|tel:|#)/i.test(reference)) return 'embedded-or-action';
  try {
    const url = new URL(reference, baseUrl);
    if (url.protocol === 'file:') return 'local-file';
    if (url.origin === baseUrl.origin) return 'same-origin';
    return 'external';
  } catch {
    return 'invalid';
  }
}

async function loadInput(input, allowNetwork) {
  if (/^https?:\/\//i.test(input)) {
    if (!allowNetwork) throw new Error('审计远程网站时必须显式使用 --allow-network');
    const response = await fetch(input, { redirect: 'follow' });
    if (!response.ok) throw new Error(`无法读取 ${input}: HTTP ${response.status}`);
    return { source: await response.text(), baseUrl: new URL(response.url) };
  }
  const path = resolve(input);
  return { source: await readFile(path, 'utf8'), baseUrl: pathToFileURL(path) };
}

const args = parseArgs(process.argv.slice(2));
if (!args.input) throw new Error('用法: audit-site.mjs --input <url-or-html> [--allow-network] [--json report.json]');

const { source, baseUrl } = await loadInput(args.input, args['allow-network']);
const attributeRefs = collect(/\b(?:src|href|poster|action)\s*=\s*["']([^"']+)["']/gi, source);
const srcsetRefs = collect(/\bsrcset\s*=\s*["']([^"']+)["']/gi, source)
  .flatMap((value) => value.split(',').map((candidate) => candidate.trim().split(/\s+/)[0]));
const cssRefs = collect(/url\(\s*["']?([^"')]+)["']?\s*\)/gi, source);
const moduleImports = [
  ...collect(/\bimport\s+(?:[^"'()]+?\s+from\s+)?["']([^"']+)["']/g, source),
  ...collect(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g, source),
];
const requests = [
  ...collect(/\bfetch\s*\(\s*["']([^"']+)["']/g, source),
  ...collect(/\bnew\s+(?:WebSocket|EventSource)\s*\(\s*["']([^"']+)["']/g, source),
  ...collect(/\bopen\s*\(\s*["'][A-Z]+["']\s*,\s*["']([^"']+)["']/g, source),
];
const routes = unique(collect(/\bhref\s*=\s*["']([^"']+)["']/gi, source)
  .filter((value) => !/^(?:https?:|data:|blob:|javascript:|mailto:|tel:)/i.test(value)));
const references = unique([...attributeRefs, ...srcsetRefs, ...cssRefs, ...moduleImports]);
const byKind = references.reduce((groups, reference) => {
  const kind = classify(reference, baseUrl);
  (groups[kind] ||= []).push(reference);
  return groups;
}, {});
const report = {
  input: args.input,
  resolvedBase: baseUrl.href,
  totals: {
    references: references.length,
    routes: routes.length,
    moduleImports: unique(moduleImports).length,
    runtimeRequests: unique(requests).length,
  },
  references: byKind,
  routes,
  moduleImports: unique(moduleImports),
  runtimeRequests: unique(requests),
  flags: {
    serviceWorker: /serviceWorker\s*\.\s*register|navigator\s*\.\s*serviceWorker/i.test(source),
    inlineFrames: /<iframe\b/i.test(source),
    forms: /<form\b/i.test(source),
    historyRouting: /\b(?:pushState|replaceState)\s*\(/.test(source),
    hashRouting: /(?:location|window\.location)\s*\.\s*hash|hashchange/.test(source),
  },
};

const json = `${JSON.stringify(report, null, 2)}\n`;
if (args.json) await writeFile(resolve(args.json), json);
else process.stdout.write(json);
