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

test('jede Episode hat eine eigene Quest', () => {
  for (const serie of data.series.series) {
    const questIds = new Set(data.quests.quests.map((q) => q.id));
    for (const ep of serie.episodes) {
      assert.ok(ep.quest, `${serie.id}#${ep.n}: keine Quest`);
      assert.ok(questIds.has(ep.quest), `${serie.id}#${ep.n}: Quest "${ep.quest}" existiert nicht`);
    }
  }
});

test('die Episodenketten sind lückenlos verdrahtet', () => {
  // Episode N+1 muss auf N warten, sonst laufen Arcs durcheinander oder
  // spaete Episoden starten nie.
  const byId = new Map(data.quests.quests.map((q) => [q.id, q]));
  for (const serie of data.series.series) {
    const folge = [...serie.episodes].sort((a, b) => a.n - b.n).map((ep) => byId.get(ep.quest));
    for (const [i, quest] of folge.entries()) {
      if (i === 0) {
        assert.ok(quest.requires?.act?.min, `${quest.id}: erste Episode braucht ein Akt-Tor`);
        continue;
      }
      const vorher = folge[i - 1].id;
      assert.deepEqual(quest.requires?.quests?.completed, [vorher], `${quest.id} muss auf ${vorher} warten`);
      assert.deepEqual(
        folge[i - 1].rewards?.quests?.start, [quest.id],
        `${vorher} muss ${quest.id} starten`
      );
    }
    assert.ok(!folge.at(-1).rewards?.quests?.start, `${folge.at(-1).id}: letzte Episode darf nichts nachladen`);
  }
});

test('die Manipulations-Arcs geben keine Ideologie wieder', () => {
  // Content-Regel aus docs/CONTENT_GUIDE.md: gezeigt wird die Methode,
  // nicht die Position. Die Figuren bleiben inhaltsleer.
  for (const serie of data.series.series.filter((s) => s.contentNote)) {
    const quests = data.quests.quests.filter((q) => q.series === serie.id);
    assert.ok(quests.length, `${serie.id}: keine Quests`);
    const text = JSON.stringify(quests) + JSON.stringify(serie.episodes);
    assert.ok(!/\b(parole|slogan|manifest|programm)\b/i.test(text), `${serie.id}: klingt nach Programm statt Methode`);
  }
  const stumm = ['nwo_reichsschaender', 'der_freundliche_anrufer'];
  for (const id of stumm) {
    const figur = data.characters.characters.find((c) => c.id === id);
    assert.ok(figur.voice.avoids.includes('ideologie_ausformuliert'), `${id}: Sprachprofil ohne Inhaltsgrenze`);
  }
});

test('jede Region ist erreichbar und bewohnt', () => {
  const orte = data.locations.locations;
  for (const region of data.locations.regions) {
    const inRegion = orte.filter((l) => l.region === region.id);
    // Entweder mehrere Orte oder ein Ort mit Bereichen: der Untergrund ist
    // bewusst ein einziger tiefer Ort (U-7) und kein Bezirk.
    const substanz = inRegion.length >= 2 || inRegion.some((l) => (l.areas ?? []).length >= 3);
    assert.ok(substanz, `${region.id}: zu duenn (${inRegion.length} Ort(e), keine Bereiche)`);

    // Mindestens eine Verbindung nach draussen, sonst ist die Region abgeschnitten.
    const nachAussen = inRegion.some((l) =>
      (l.connections ?? []).some((z) => orte.find((o) => o.id === z)?.region !== region.id) ||
      orte.some((o) => o.region !== region.id && (o.connections ?? []).includes(l.id))
    );
    assert.ok(nachAussen, `${region.id}: keine Verbindung zu einer anderen Region`);

    // Und mindestens eine Figur, sonst ist es Kulisse.
    const mitFiguren = inRegion.some((l) => (l.npcs ?? []).length);
    assert.ok(mitFiguren, `${region.id}: keine einzige Figur`);
  }
});

test('jeder Ort mit Figuren hat auch etwas zu tun', () => {
  for (const loc of data.locations.locations) {
    if (!(loc.npcs ?? []).length) continue;
    assert.ok((loc.interactables ?? []).length || loc.areas?.length,
      `${loc.id}: Figuren, aber keine Interaktion`);
  }
});

test('jede Region hat eigene Ereignisse', () => {
  // Sonst fuehlt sich ein Bezirk an wie eine Kulisse mit fremden Geraeuschen.
  const regionVonOrt = new Map(data.locations.locations.map((l) => [l.id, l.region]));
  const regionen = new Set();
  for (const ev of data.events.events) {
    for (const ort of ev.requires?.location ?? []) regionen.add(regionVonOrt.get(ort));
  }
  for (const region of ['berlin', 'hamburg']) {
    assert.ok(regionen.has(region), `${region}: keine ortsgebundenen Ereignisse`);
  }
});

test('ortsgebundene Ereignisse spielen nur dort, wo sie hingehören', () => {
  // "Aus dem anderen Zimmer: Simon?" darf nicht in Hamburg kommen.
  const zuhause = ['ev_mamer_ruft', 'ev_internet_ausfall', 'ev_unbekannter_besucher'];
  const wohnorte = new Set(['mimons_wohnung', 'mamer_bereich']);
  for (const id of zuhause) {
    const ev = data.events.events.find((e) => e.id === id);
    const orte = ev.requires?.location ?? [];
    assert.ok(orte.length, `${id}: an keinen Ort gebunden`);
    for (const ort of orte) assert.ok(wohnorte.has(ort), `${id}: spielt auch in ${ort}`);
  }
});
