import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Beweist, dass das Spiel durchspielbar ist: der zielgerichtete Durchlauf
 * (tools/solve.mjs) sucht zu jedem offenen Questziel die passende Handlung.
 * Bleibt er stecken, ist die Stelle auch im echten Spiel blockiert — genau so
 * wurden die Verklemmungen um U-7, die Lagerhalle und den Kelchninja gefunden.
 */
function durchlauf(seed) {
  return execFileSync(process.execPath, ['tools/solve.mjs', String(seed)], {
    cwd: wurzel, encoding: 'utf8', timeout: 240000
  });
}

for (const seed of [7, 11, 42]) {
  test(`das Spiel ist durchspielbar (Seed ${seed})`, () => {
    const ausgabe = durchlauf(seed);
    assert.match(ausgabe, /Akt 15\/15/, ausgabe);
    assert.match(ausgabe, /Ende: ending_/, ausgabe);
    const quests = Number(ausgabe.match(/Quests: (\d+)\//)?.[1] ?? 0);
    assert.ok(quests >= 50, `nur ${quests} Quests abgeschlossen\n${ausgabe}`);
  });
}
