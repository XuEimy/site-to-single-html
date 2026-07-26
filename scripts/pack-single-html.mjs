#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

const mimeByExtension = {
  '.avif': 'image/avif', '.css': 'text/css', '.gif': 'image/gif', '.html': 'text/html',
  '.ico': 'image/x-icon', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.js': 'text/javascript',
  '.json': 'application/json', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4',
  '.ogg': 'audio/ogg', '.otf': 'font/otf', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf', '.webm': 'video/webm', '.webp': 'image/webp', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.xml': 'application/xml',
};

function mimeFor(url, responseType) {
  const cleanType = responseType?.split(';')[0]?.trim();
  if (cleanType) return cleanType;
  try {
    return mimeByExtension[extname(new URL(url).pathname).toLowerCase()] || 'application/octet-stream';
  } catch {
    return mimeByExtension[extname(url).toLowerCase()] || 'application/octet-stream';
  }
}

function isSkippable(value) {
  return !value || /^(?:data:|blob:|javascript:|mailto:|tel:|#)/i.test(value);
}

function escapeScriptEnd(source) {
  return source.replaceAll('</script', '<\\/script');
}

async function loadResource(url, allowNetwork) {
  if (url.protocol === 'file:') {
    const data = await readFile(fileURLToPath(url));
    return { data, contentType: mimeFor(url.href) };
  }
  if (!/^https?:$/.test(url.protocol)) throw new Error(`不支持的资源协议: ${url.protocol}`);
  if (!allowNetwork) throw new Error(`发现远程资源 ${url.href}；如已获授权，请添加 --allow-network`);
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`资源读取失败 ${url.href}: HTTP ${response.status}`);
  return {
    data: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') || mimeFor(response.url),
    finalUrl: new URL(response.url),
  };
}

function resolveReference(reference, baseUrl) {
  return new URL(reference, baseUrl);
}

function dataUri(data, contentType) {
  return `data:${contentType};base64,${data.toString('base64')}`;
}

async function replaceAsync(source, pattern, replacer) {
  const matches = [...source.matchAll(pattern)];
  if (!matches.length) return source;
  let output = '';
  let cursor = 0;
  for (const match of matches) {
    output += source.slice(cursor, match.index);
    output += await replacer(match);
    cursor = match.index + match[0].length;
  }
  return output + source.slice(cursor);
}

async function inlineCss(source, baseUrl, context, seen = new Set()) {
  source = await replaceAsync(
    source,
    /@import\s+(?:url\(\s*)?["']?([^"')\s;]+)["']?\s*\)?\s*;/gi,
    async (match) => {
      const target = resolveReference(match[1], baseUrl);
      if (seen.has(target.href)) return '';
      seen.add(target.href);
      const resource = await loadResource(target, context.allowNetwork);
      context.inlined.add(target.href);
      return inlineCss(resource.data.toString('utf8'), resource.finalUrl || target, context, seen);
    },
  );
  return replaceAsync(source, /url\(\s*(["']?)([^"')]+)\1\s*\)/gi, async (match) => {
    const reference = match[2].trim();
    if (isSkippable(reference)) return match[0];
    const target = resolveReference(reference, baseUrl);
    const resource = await loadResource(target, context.allowNetwork);
    context.inlined.add(target.href);
    return `url("${dataUri(resource.data, mimeFor(target.href, resource.contentType))}")`;
  });
}

async function inlineStylesheets(html, baseUrl, context) {
  return replaceAsync(
    html,
    /<link\b([^>]*\brel\s*=\s*["']stylesheet["'][^>]*)>/gi,
    async (match) => {
      const href = match[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
      if (!href) return match[0];
      const target = resolveReference(href, baseUrl);
      const resource = await loadResource(target, context.allowNetwork);
      context.inlined.add(target.href);
      const css = await inlineCss(resource.data.toString('utf8'), resource.finalUrl || target, context);
      return `<style data-inlined-from="${target.href.replaceAll('"', '&quot;')}">${css}</style>`;
    },
  );
}

function hasUnresolvedImports(source) {
  return /\bimport\s+(?:[^"'()]+?\s+from\s+)?["'][^"']+["']|\bimport\s*\(\s*["'][^"']+["']\s*\)/.test(source);
}

async function inlineScripts(html, baseUrl, context) {
  return replaceAsync(
    html,
    /<script\b([^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*)>\s*<\/script>/gi,
    async (match) => {
      const target = resolveReference(match[2], baseUrl);
      const resource = await loadResource(target, context.allowNetwork);
      const source = resource.data.toString('utf8');
      if (hasUnresolvedImports(source)) {
        throw new Error(`脚本仍包含模块或动态导入，先将其构建为单 bundle: ${target.href}`);
      }
      context.inlined.add(target.href);
      const type = /\btype\s*=\s*["']module["']/i.test(match[1]) ? ' type="module"' : '';
      return `<script${type} data-inlined-from="${target.href.replaceAll('"', '&quot;')}">${escapeScriptEnd(source)}<\/script>`;
    },
  );
}

async function inlineTagAssets(html, baseUrl, context) {
  const tagPattern = /<(img|source|video|audio|input)\b([^>]*?)>/gi;
  return replaceAsync(html, tagPattern, async (match) => {
    let attributes = match[2];
    attributes = await replaceAsync(attributes, /\b(src|poster)\s*=\s*(["'])([^"']+)\2/gi, async (assetMatch) => {
      const reference = assetMatch[3];
      if (isSkippable(reference)) return assetMatch[0];
      const target = resolveReference(reference, baseUrl);
      const resource = await loadResource(target, context.allowNetwork);
      context.inlined.add(target.href);
      return `${assetMatch[1]}=${assetMatch[2]}${dataUri(resource.data, mimeFor(target.href, resource.contentType))}${assetMatch[2]}`;
    });
    attributes = await replaceAsync(attributes, /\bsrcset\s*=\s*(["'])([^"']+)\1/gi, async (assetMatch) => {
      const candidates = await Promise.all(assetMatch[2].split(',').map(async (candidate) => {
        const [reference, ...descriptor] = candidate.trim().split(/\s+/);
        if (isSkippable(reference)) return candidate.trim();
        const target = resolveReference(reference, baseUrl);
        const resource = await loadResource(target, context.allowNetwork);
        context.inlined.add(target.href);
        return [dataUri(resource.data, mimeFor(target.href, resource.contentType)), ...descriptor].join(' ');
      }));
      return `srcset=${assetMatch[1]}${candidates.join(', ')}${assetMatch[1]}`;
    });
    return `<${match[1]}${attributes}>`;
  });
}

async function inlineLinkAssets(html, baseUrl, context) {
  return replaceAsync(
    html,
    /<link\b([^>]*\brel\s*=\s*["'](?:icon|shortcut icon|apple-touch-icon|manifest)["'][^>]*)>/gi,
    async (match) => {
      const href = match[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
      if (!href || isSkippable(href)) return match[0];
      const target = resolveReference(href, baseUrl);
      const resource = await loadResource(target, context.allowNetwork);
      context.inlined.add(target.href);
      const uri = dataUri(resource.data, mimeFor(target.href, resource.contentType));
      return match[0].replace(href, uri).replace(/\s+integrity\s*=\s*["'][^"']+["']/i, '');
    },
  );
}

function unresolvedRuntimeResources(html) {
  const found = [];
  const patterns = [
    /\b(?:src|poster)\s*=\s*["']([^"']+)["']/gi,
    /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi,
    /url\(\s*["']?([^"')]+)["']?\s*\)/gi,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      if (!isSkippable(match[1])) found.push(match[1]);
    }
  }
  return [...new Set(found)];
}

const args = parseArgs(process.argv.slice(2));
if (!args.input || !args.output) {
  throw new Error('用法: pack-single-html.mjs --input <url-or-index.html> --output <file.html> [--allow-network] [--allow-external]');
}

const inputIsRemote = /^https?:\/\//i.test(args.input);
if (inputIsRemote && !args['allow-network']) throw new Error('打包远程网站时必须显式使用 --allow-network');
const inputUrl = inputIsRemote ? new URL(args.input) : pathToFileURL(resolve(args.input));
const entry = await loadResource(inputUrl, args['allow-network']);
let html = entry.data.toString('utf8');
const baseUrl = entry.finalUrl || inputUrl;
const context = { allowNetwork: !!args['allow-network'], inlined: new Set() };

html = await inlineStylesheets(html, baseUrl, context);
html = await inlineScripts(html, baseUrl, context);
html = await inlineTagAssets(html, baseUrl, context);
html = await inlineLinkAssets(html, baseUrl, context);
html = await replaceAsync(html, /<style\b([^>]*)>([\s\S]*?)<\/style>/gi, async (match) => (
  `<style${match[1]}>${await inlineCss(match[2], baseUrl, context)}</style>`
));

const unresolved = unresolvedRuntimeResources(html);
if (unresolved.length && !args['allow-external']) {
  throw new Error(`仍有未内联运行时资源:\n${unresolved.map((item) => `- ${item}`).join('\n')}`);
}

const marker = '<meta name="single-html-packaged" content="site-to-single-html">';
html = /<head\b[^>]*>/i.test(html)
  ? html.replace(/<head\b([^>]*)>/i, `<head$1>\n${marker}`)
  : `${marker}\n${html}`;
await writeFile(resolve(args.output), html);
process.stdout.write(`${JSON.stringify({
  output: resolve(args.output),
  bytes: Buffer.byteLength(html),
  inlinedResources: context.inlined.size,
  unresolvedResources: unresolved,
}, null, 2)}\n`);
