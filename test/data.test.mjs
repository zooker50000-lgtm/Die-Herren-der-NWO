import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../src/data/loader.mjs';
import { validateData, LAYERS } from '../src/data/validate.mjs';

const data = await loadData();

test('Content-Datenbank ist konsistent', () => {
  const result = validateData(data);
  assert.deepEqual(result.errors, [], result.errors.join('\n'));
});

test('jeder Lore-Eintrag hat einen gültigen Layer', () => {
  for (const entry of data.lore.entries) {
    assert.ok(LAYERS.includes(entry.layer), `${entry.id}: ${entry.layer}`);
  }
});

test('die vier Serien haben die dokumentierten Episodenzahlen', () => {
  const counts = Object.fromEntries(data.series.series.map((s) => [s.id, s.episodeCount]));
  assert.deepEqual(counts, { alchemimon: 21, islamimon: 15, rechtsextremimon: 12, baphomimon: 3 });
  for (const s of data.series.series) assert.equal(s.episodes.length, s.episodeCount);
});

test('erfundene Serieninhalte sind nicht als Quellenlore markiert', () => {
  for (const series of data.series.series) {
    for (const ep of series.episodes) {
      if (ep.layer === 'SOURCE_BASED_LORE') {
        // Nur BAPHOMIMON hat dokumentierte Episodentitel.
        assert.equal(series.id, 'baphomimon', `${series.id}#${ep.n} darf nicht SOURCE_BASED_LORE sein`);
      } else {
        assert.equal(ep.derivedFrom, series.id, `${series.id}#${ep.n} braucht derivedFrom`);
      }
    }
  }
});

test('kein Lexikoneintrag passt in jeden Kontext', () => {
  for (const entry of data.vocabulary.lexicon) {
    assert.ok(entry.contexts.length > 0 && !entry.contexts.includes('*'), entry.id);
  }
});

test('jede Figur hat ein eigenes Sprachprofil', () => {
  const seen = new Map();
  for (const c of data.characters.characters) {
    assert.ok(c.voice, `${c.id} ohne voice`);
    const fingerprint = `${c.voice.register}|${(c.voice.tics ?? []).join(',')}`;
    assert.ok(!seen.has(fingerprint), `${c.id} klingt wie ${seen.get(fingerprint)}`);
    seen.set(fingerprint, c.id);
  }
});

test('die Alchemie enthält keine realen Verfahrensangaben', () => {
  const verboten = /\b(gramm|milliliter|°c|grad celsius|erhitzen auf|mischverhältnis|schwefelsäure|salpeter)\b/i;
  for (const recipe of data.alchemy.recipes) {
    const text = JSON.stringify(recipe);
    assert.ok(!verboten.test(text), `${recipe.id} enthält eine Verfahrensangabe`);
  }
});
