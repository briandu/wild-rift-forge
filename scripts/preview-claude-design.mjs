#!/usr/bin/env node
/**
 * Serve a design handoff folder over HTTP (file:// blocks Claude Design runtime).
 *
 * Usage:
 *   node scripts/preview-claude-design.mjs [slug] [--port 8765]
 */

import { createServer } from 'node:http';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HANDOFFS = path.join(ROOT, 'design', 'handoffs');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
};

function resolveSlug(arg) {
  if (arg) return arg;
  const latest = path.join(HANDOFFS, 'LATEST');
  if (existsSync(latest)) return readFileSync(latest, 'utf8').trim();
  const baseline = path.join(ROOT, 'design', 'claude-baseline');
  if (existsSync(baseline)) return null;
  throw new Error('No handoff slug. Pass one, or run design:ingest first.');
}

function listDirectory(dirPath, urlPath) {
  const entries = readdirSync(dirPath);
  const links = entries
    .map((name) => {
      const href = encodeURI(path.posix.join(urlPath === '/' ? '' : urlPath, name));
      return `<li><a href="${href}">${name}</a></li>`;
    })
    .join('\n');
  return `<!doctype html><meta charset="utf-8"><title>${path.basename(dirPath)}</title><h1>${path.basename(dirPath)}</h1><ul>${links}</ul>`;
}

const args = process.argv.slice(2);
let port = 8765;
let slugArg = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port') port = Number(args[++i]);
  else if (!args[i].startsWith('-')) slugArg = args[i];
}

const slug = resolveSlug(slugArg);
const dir = path.resolve(
  slug ? path.join(HANDOFFS, slug) : path.join(ROOT, 'design', 'claude-baseline'),
);

if (!existsSync(dir)) {
  console.error(`Handoff not found: ${dir}`);
  process.exit(1);
}

const server = createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0] || '/');
  let filePath = path.resolve(dir, '.' + (urlPath === '/' ? '' : urlPath));

  if (!filePath.startsWith(dir + path.sep) && filePath !== dir) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    const indexPath = path.join(filePath, 'index.html');
    if (existsSync(indexPath)) {
      filePath = indexPath;
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(listDirectory(filePath, urlPath));
      return;
    }
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404).end('Not found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
  res.end(readFileSync(filePath));
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Serving ${path.relative(ROOT, dir)} at http://127.0.0.1:${port}/`);
});
