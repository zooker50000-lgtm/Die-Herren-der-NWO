import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Startet den Dev-Server wirklich und ruft die Dateien ab, die der Browser
 * beim Spielstart braucht. Genau das fehlte: der Server fand unter Windows
 * seine eigenen Dateien nicht und antwortete auf alles mit 404 — unter Linux
 * war davon nichts zu sehen.
 */
const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5199;
const basis = `http://127.0.0.1:${PORT}`;
let server;

before(async () => {
  server = spawn(process.execPath, ['tools/serve.mjs'], {
    cwd: wurzel, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore'
  });
  // Warten, bis er antwortet — hoechstens fuenf Sekunden.
  for (let versuch = 0; versuch < 50; versuch++) {
    try { await fetch(basis); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('Server ist nicht hochgekommen');
});

after(() => server?.kill());

test('der Server liefert alles aus, was das Spiel zum Start braucht', async () => {
  const pflicht = [
    ['/', 'text/html'],
    ['/styles/main.css', 'text/css'],
    ['/main.mjs', 'text/javascript'],
    ['/src/game.mjs', 'text/javascript'],
    ['/data/lore.json', 'application/json'],
    ['/data/vocabulary.json', 'application/json']
  ];
  for (const [pfad, typ] of pflicht) {
    const antwort = await fetch(basis + pfad);
    assert.equal(antwort.status, 200, `${pfad} antwortet mit ${antwort.status}`);
    assert.ok(antwort.headers.get('content-type').startsWith(typ), `${pfad}: falscher Typ`);
  }
});

test('die Startseite enthält den Startknopf', async () => {
  const html = await (await fetch(basis)).text();
  assert.match(html, /id="boot-start"/);
  assert.match(html, /main\.mjs/);
});

test('der Server gibt nichts oberhalb des Projektordners heraus', async () => {
  for (const pfad of ['/../../etc/passwd', '/..%2f..%2fetc/passwd', '/src/../../../etc/passwd']) {
    const antwort = await fetch(basis + pfad);
    assert.ok(antwort.status >= 400, `${pfad} wurde ausgeliefert (${antwort.status})`);
  }
});

test('unbekannte Pfade antworten mit 404', async () => {
  assert.equal((await fetch(basis + '/gibtesnicht.html')).status, 404);
});
