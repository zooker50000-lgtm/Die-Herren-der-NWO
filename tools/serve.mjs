#!/usr/bin/env node
/** Winziger statischer Dev-Server ohne Abhängigkeiten. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const PORT = Number(process.env.PORT ?? 5173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2'
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let path = decodeURIComponent(url.pathname);
    if (path === '/') path = '/index.html';

    // web/ ist die Wurzel des Clients; /src und /data kommen aus dem Projekt,
    // damit Browser und Node dieselben Dateien laden.
    const safe = normalize(path).replace(/^(\.\.[/\\])+/, '');
    const base = /^[/\\](src|data|assets|docs)[/\\]/.test(safe) ? ROOT : join(ROOT, 'web');
    const target = join(base, safe);
    if (!target.startsWith(ROOT)) { res.writeHead(403).end('Verboten'); return; }

    const info = await stat(target).catch(() => null);
    const file = info?.isDirectory() ? join(target, 'index.html') : target;
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Nicht gefunden');
  }
});

server.listen(PORT, async () => {
  const adresse = `http://localhost:${PORT}`;
  console.log(`\n  MIMON BARAKA UNIVERSE`);
  console.log(`  läuft auf ${adresse}`);
  console.log(`  Zum Beenden: Strg+C\n`);

  // Mit --open den Browser gleich mit oeffnen (macht start.bat so).
  if (process.argv.includes('--open')) {
    const { exec } = await import('node:child_process');
    const befehl = process.platform === 'win32' ? `start "" "${adresse}"`
      : process.platform === 'darwin' ? `open "${adresse}"`
      : `xdg-open "${adresse}"`;
    exec(befehl, () => { /* kein Browser gefunden - die Adresse steht oben */ });
  }
});
