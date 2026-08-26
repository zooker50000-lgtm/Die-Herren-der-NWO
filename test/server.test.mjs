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
let basis;
let server;

/** Startet den Server und liest den Port aus seiner Ausgabe. */
function starteServer(port) {
  const kind = spawn(process.execPath, ['tools/serve.mjs'], {
    cwd: wurzel, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'ignore']
  });
  const adresse = new Promise((erfuellen, ablehnen) => {
    let ausgabe = '';
    kind.stdout.on('data', (stueck) => {
      ausgabe += stueck;
      // Der Server weicht auf den naechsten Port aus, wenn einer belegt ist -
      // deshalb wird der Port gelesen und nicht angenommen.
      const treffer = ausgabe.match(/laeuft auf (http:\/\/localhost:(\d+))/);
      if (treffer) erfuellen({ adresse: treffer[1], port: Number(treffer[2]) });
    });
    setTimeout(() => ablehnen(new Error('Server ist nicht hochgekommen')), 8000);
  });
  return { kind, adresse };
}

before(async () => {
  const gestartet = starteServer(PORT);
  server = gestartet.kind;
  const { adresse } = await gestartet.adresse;
  basis = adresse.replace('localhost', '127.0.0.1');
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

test('ein belegter Port laesst den Server ausweichen statt abstuerzen', async () => {
  // Vorher endete das in einem Stapelspeicherauszug (EADDRINUSE), mit dem
  // niemand etwas anfangen kann - und genau das passiert staendig, weil noch
  // ein Fenster von vorhin laeuft.
  const zweiter = starteServer(PORT);
  try {
    const { port } = await zweiter.adresse;
    assert.ok(port > PORT, `zweiter Server blieb auf ${port}`);
    const antwort = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(antwort.status, 200, 'der ausgewichene Server liefert nichts aus');
  } finally {
    zweiter.kind.kill();
  }
});
