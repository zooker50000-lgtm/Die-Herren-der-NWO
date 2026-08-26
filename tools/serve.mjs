#!/usr/bin/env node
/** Winziger statischer Dev-Server ohne Abhängigkeiten. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath statt .pathname: unter Windows liefert .pathname "/C:/Users/..."
// mit fuehrendem Schraegstrich vor dem Laufwerksbuchstaben, und resolve() macht
// daraus einen Pfad, unter dem nichts liegt. Ausserdem dekodiert es Leerzeichen
// im Pfad (%20) richtig.
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
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
    // Mit Trennzeichen vergleichen, sonst wuerde ein Nachbarordner mit
    // gleichem Praefix (…/spiel-alt neben …/spiel) ebenfalls durchgehen.
    if (target !== ROOT && !target.startsWith(ROOT + sep)) { res.writeHead(403).end('Verboten'); return; }

    const info = await stat(target).catch(() => null);
    const file = info?.isDirectory() ? join(target, 'index.html') : target;
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Nicht gefunden');
  }
});

/** Browser oeffnen, plattformabhaengig. */
async function oeffneBrowser(adresse) {
  const { exec } = await import('node:child_process');
  const befehl = process.platform === 'win32' ? `start "" "${adresse}"`
    : process.platform === 'darwin' ? `open "${adresse}"`
    : `xdg-open "${adresse}"`;
  exec(befehl, () => { /* kein Browser gefunden - die Adresse steht oben */ });
}

/**
 * Ist der Port belegt, wird der naechste genommen. Das passiert staendig:
 * ein Fenster von vorhin laeuft noch. Frueher ist der Server dabei mit einem
 * Stapelspeicherauszug abgestuerzt, mit dem niemand etwas anfangen kann.
 */
const MAX_VERSUCHE = 20;
let port = PORT;
let versuche = 0;

server.on('error', (fehler) => {
  if (fehler.code !== 'EADDRINUSE') {
    console.error(`\n  Der Server konnte nicht starten: ${fehler.message}\n`);
    process.exit(1);
  }
  if (++versuche > MAX_VERSUCHE) {
    console.error(`\n  Die Ports ${PORT} bis ${port} sind alle belegt.`);
    console.error('  Schliesse die anderen Fenster oder starte den Rechner neu.\n');
    process.exit(1);
  }
  port++;
  server.listen(port);
});

server.on('listening', async () => {
  const adresse = `http://localhost:${port}`;
  console.log(`\n  MIMON BARAKA UNIVERSE`);
  if (port !== PORT) {
    console.log(`  (Port ${PORT} war belegt - vermutlich laeuft noch ein Fenster von vorhin.)`);
  }
  console.log(`  laeuft auf ${adresse}`);
  console.log(`  Zum Beenden: Strg+C\n`);

  // Mit --open den Browser gleich mit oeffnen (macht start.bat so).
  if (process.argv.includes('--open')) await oeffneBrowser(adresse);
});

server.listen(port);
