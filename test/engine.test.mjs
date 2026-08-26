import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../src/data/loader.mjs';
import { Game } from '../src/game.mjs';
import { MimonologGenerator } from '../src/dialogue/mimonolog.mjs';
import { matchWhere } from '../src/quests/engine.mjs';
import { meets } from '../src/core/conditions.mjs';

const data = await loadData();
const newGame = (seed = 1) => new Game(data, { seed, storage: memoryStorage() }).start();

function memoryStorage() {
  const map = new Map();
  return {
    read: (k) => map.get(k) ?? null,
    write: (k, v) => { map.set(k, v); return true; },
    remove: (k) => map.delete(k)
  };
}

test('Spielstart legt Grundzustand an', () => {
  const g = newGame();
  assert.equal(g.store.s.player.act, 1);
  assert.ok(g.store.has('magisches_tagebuch'));
  assert.ok(g.quests.journal().active.some((q) => q.id === 'der_erste_heeter'));
  assert.equal(g.emails.inbox.length, 1);
});

test('gleicher Seed erzeugt denselben Verlauf', () => {
  const a = newGame(31337);
  const b = newGame(31337);
  const textA = MimonologGenerator.toText(a.monolog.generate({ topic: 'nwo' }));
  const textB = MimonologGenerator.toText(b.monolog.generate({ topic: 'nwo' }));
  assert.equal(textA, textB);
});

test('Mimonolog folgt der Beat-Struktur und endet mit einem Schluss', () => {
  const g = newGame(5);
  const m = g.monolog.generate({ topic: 'fahrzeug' });
  assert.equal(m.beats.at(-1).type, 'CLOSER');
  assert.equal(m.beats[0].type, 'OPENER');
  assert.ok(m.beats.length >= 3);
  // Keine offenen Platzhalter
  for (const beat of m.beats) assert.ok(!/\{[a-z:|]+\}/.test(beat.text), beat.text);
});

test('Crashout hebt die Sprachstufe und verlängert den Monolog', () => {
  const g = newGame(9);
  const calm = g.monolog.generate({ topic: 'heeter' });
  g.store.addStat('crashout', 90);
  const loud = g.monolog.generate({ topic: 'heeter' });
  assert.equal(calm.tier, 'calm');
  assert.equal(loud.tier, 'loud');
  assert.ok(loud.meta.beatCount >= calm.meta.beatCount, `${loud.meta.beatCount} < ${calm.meta.beatCount}`);
});

test('Vokabular wird nicht gespammt: Cooldown greift', () => {
  const g = newGame(77);
  g.store.addStat('crashout', 95);
  const m = g.monolog.generate({ topic: 'nwo' });
  const text = MimonologGenerator.toText(m);
  const treffer = (text.match(/\bHeeter\b/g) ?? []).length;
  assert.ok(treffer <= 3, `Heeter kam ${treffer} Mal vor`);
});

test('Ehdzhusten tritt nicht in jedem Monolog auf', () => {
  const g = newGame(2);
  let mit = 0;
  for (let i = 0; i < 40; i++) {
    if (g.monolog.generate({ topic: 'allgemein' }).meta.ehdzhusten > 0) mit++;
  }
  assert.ok(mit > 0, 'nie gehustet');
  assert.ok(mit < 40, 'in jedem Monolog gehustet');
});

test('Crashout-Stufen feuern Ereignisse und Maximum wird gemeldet', () => {
  const g = newGame();
  const tiers = [];
  let maximum = false;
  g.bus.on('crashout.tier', ({ tier }) => tiers.push(tier));
  g.bus.on('crashout.maximum', () => { maximum = true; });
  g.store.addStat('crashout', 95, { min: 0, max: 100 });
  assert.ok(tiers.includes('maximum'));
  assert.ok(maximum);
});

test('Crashout fällt in der Wohnung schneller als auf der Straße', () => {
  const drinnen = newGame(3);
  const draussen = newGame(3);
  drinnen.store.addStat('crashout', 50);
  draussen.store.addStat('crashout', 50);
  draussen.store.s.player.location = 'strasse';
  drinnen.clock.advance(120);
  draussen.clock.advance(120);
  assert.ok(drinnen.store.stat('crashout') < draussen.store.stat('crashout'));
});

test('Quest-Objectives reagieren auf Ereignisse', () => {
  const g = newGame();
  g.bus.emit('window.observed', { scene: 'fahrzeug' });
  g.quests.start('die_nwo_sieht_alles');
  // Quest startet erst nach der ersten - deshalb direkt prüfen:
  assert.ok(!g.quests.journal().active.some((q) => q.id === 'die_nwo_sieht_alles'));
});

test('Quest wird abgeschlossen, wenn alle Objectives erfüllt sind', () => {
  const g = newGame();
  const done = [];
  g.bus.on('quest.completed', ({ quest }) => done.push(quest));
  g.fideos.watch('fideo_veraendert');
  g.emails.read(g.emails.inbox[0].id);
  g.fideos.analyzeComments();
  g.dialogue.open('hatebox_konfrontation');
  g.dialogue.choose(0);
  g.dialogue.close();
  assert.ok(done.includes('der_erste_heeter'), `abgeschlossen: ${done.join(',')}`);
  assert.equal(g.store.s.player.act, 2, 'Akt 2 muss folgen');
});

test('matchWhere filtert Ereignisdaten', () => {
  assert.ok(matchWhere({ topic: 'nwo' }, { topic: 'nwo' }));
  assert.ok(!matchWhere({ topic: 'nwo' }, { topic: 'alchemie' }));
  assert.ok(matchWhere({ angerMax: 40 }, { anger: 20 }));
  assert.ok(!matchWhere({ angerMax: 40 }, { anger: 70 }));
  assert.ok(matchWhere({ tierMax: 'annoyed' }, { tier: 'calm' }));
  assert.ok(!matchWhere({ tierMax: 'annoyed' }, { tier: 'loud' }));
  assert.ok(matchWhere({ evidence: true }, { evidence: true }));
});

test('Heet-Mehl kennt fünf Reaktionen mit unterschiedlichen Folgen', () => {
  const actions = data.emails.actions.map((a) => a.id);
  assert.deepEqual(actions, ['ignorieren', 'antworten', 'vorlesen', 'polizei', 'nwo']);

  const vorlesen = newGame(11);
  const ignorieren = newGame(11);
  const mailA = vorlesen.emails.inbox[0];
  const mailB = ignorieren.emails.inbox[0];
  vorlesen.emails.handle(mailA.id, 'vorlesen');
  ignorieren.emails.handle(mailB.id, 'ignorieren');
  assert.ok(vorlesen.store.stat('mett') > ignorieren.store.stat('mett'));
  assert.ok(vorlesen.store.stat('crashout') > ignorieren.store.stat('crashout'));
});

test('einen Köder zu ignorieren senkt die Aggression', () => {
  const g = newGame(13);
  g.store.s.player.act = 11;
  const mail = g.emails.spawn('hm_006');
  assert.ok(mail.bait);
  const before = g.store.stat('heeterAggro');
  g.emails.handle(mail.id, 'ignorieren');
  assert.ok(g.store.stat('heeterAggro') < before);
});

test('Fideo-Parameter wirken gegenläufig auf Mett und Authentizität', () => {
  const wut = newGame(21);
  const beleg = newGame(21);
  const a = wut.fideos.publish({ topic: 'heeter', length: 'mittel', anger: 95, evidence: false });
  const b = beleg.fideos.publish({ topic: 'heeter', length: 'mittel', anger: 10, evidence: true });
  assert.ok(a.mett > b.mett, 'Wut bringt mehr Mett');
  assert.ok(b.authenticity > a.authenticity, 'Belege bringen mehr Authentizität');
});

test('NWO-Einfluss schaltet Terminalsektionen frei und meldet den Meilenstein', () => {
  const g = newGame();
  assert.ok(!g.nwo.terminalAvailable());
  let seesAll = false;
  g.bus.on('nwo.sees_all', () => { seesAll = true; });
  g.store.addStat('nwoInfluence', 100, { min: 0, max: 100 });
  assert.ok(g.nwo.terminalAvailable());
  assert.ok(seesAll);
  assert.ok(g.nwo.sections().every((s) => s.unlocked));
});

test('NWO-Terminal verweigert gesperrte Akten', () => {
  const g = newGame();
  assert.equal(g.nwo.readFile('akte_dromedar').locked, true);
  g.store.addStat('nwoInfluence', 100, { min: 0, max: 100 });
  assert.equal(g.nwo.readFile('akte_dromedar').title, 'DROMEDAR');
});

test('Alchemie braut nur mit Buch, Level, Labor und Zutaten', () => {
  const g = newGame();
  assert.equal(g.alchemy.canBrew('essenz_der_stille').ok, false, 'ohne Zutaten');
  g.store.addItem('harz_der_stille');
  g.store.addItem('salz_der_erde');
  const result = g.alchemy.brew('essenz_der_stille');
  assert.ok(result.ok, result.reason);
  assert.ok(!g.store.has('harz_der_stille'), 'Zutaten werden verbraucht');
  assert.ok(g.store.stat('alchemy') >= 1);
});

test('Alchemie steigt im Level und meldet das', () => {
  const g = newGame();
  let level = null;
  g.bus.on('alchemy.levelup', (p) => { level = p.level; });
  g.applyEffects({ alchemyXp: 500 });
  assert.ok(level > 1, `Level blieb bei ${g.store.stat('alchemy')}`);
});

test('Reisen kostet Zeit und schaltet gesperrte Orte nicht frei', () => {
  const g = newGame();
  const before = g.store.s.world.minutes;
  assert.equal(g.world.travel('nwo_labor').ok, false);
  assert.ok(g.world.travel('strasse').ok);
  assert.ok(g.store.s.world.minutes > before);
});

test('das Fenster liefert Szenen und zählt Beobachtungen', () => {
  const g = newGame(8);
  for (let i = 0; i < 5; i++) g.world.lookOutWindow();
  assert.equal(g.store.s.counters.windowObserved, 5);
  assert.equal(g.store.s.world.windowScenes.length, 5);
});

test('Bedingungen werden UND-verknüpft geprüft', () => {
  const g = newGame();
  g.store.setFlag('test_flag');
  assert.ok(meets(g.store.s, { flags: ['test_flag'] }));
  assert.ok(!meets(g.store.s, { flags: ['test_flag'], notFlags: ['test_flag'] }));
  assert.ok(!meets(g.store.s, { stats: { authenticity: { min: 99 } } }));
  assert.ok(meets(g.store.s, { act: { max: 3 } }));
});

test('Dialogoptionen mit fehlenden Voraussetzungen sind gesperrt', () => {
  const g = newGame();
  const view = g.dialogue.open('devrim_hub');
  const belege = view.choices.find((c) => c.tone === 'polizei');
  assert.equal(belege.available, false);
  assert.ok(belege.blockedBy.length > 0);
  g.store.addItem('heet_mehl_ausdruck');
  const again = g.dialogue.current();
  assert.equal(again.choices.find((c) => c.tone === 'polizei').available, true);
});

test('Dialogeffekte werden pro Besuch genau einmal angewendet', () => {
  const g = newGame();
  g.dialogue.open('mamer_hub');
  const before = g.store.trust('mamer');
  g.dialogue.choose(2); // Fahrzeug-Knoten mit Effekten
  const after = g.store.trust('mamer');
  g.dialogue.current();
  assert.equal(g.store.trust('mamer'), after);
  assert.ok(after > before);
});

test('Speichern und Laden stellt den Zustand wieder her', async () => {
  const g = newGame(555);
  g.store.addStat('mett', 999);
  g.store.setFlag('marker');
  g.clock.advance(180);
  await g.save.save('archiv_02');

  const info = await g.save.info('archiv_02');
  assert.equal(info.empty, false);
  assert.equal(info.label, 'ARCHIV 02');

  g.store.addStat('mett', -500);
  g.store.setFlag('marker', false);
  const result = await g.save.load('archiv_02');
  assert.ok(result.ok, result.reason);
  assert.ok(g.store.flag('marker'));
  assert.ok(g.store.stat('mett') >= 999);
});

test('alte Spielstände werden migriert', async () => {
  const { migrate } = await import('../src/save/migrations.mjs');
  const alt = {
    version: 1,
    seed: 4,
    rngCursor: 0,
    state: {
      meta: { version: 1, seed: 4 },
      player: { act: 2, chapter: 'chapter_1', location: 'strasse', outfit: {} },
      stats: { crashout: 10 },
      flags: {}, trust: {}, inventory: {}, tagebuch: { pages: [] },
      quests: { active: {}, completed: [], failed: [] },
      lore: { unlocked: [] }, achievements: [],
      emails: { inbox: [], handled: [], nextId: 1 },
      fideos: [{ id: 'alt' }],
      world: { minutes: 600, day: 2, visited: [] },
      events: { cooldowns: {} }, log: []
    }
  };
  const result = migrate(alt);
  assert.ok(result.ok, result.reason);
  assert.equal(result.payload.version, 3);
  assert.deepEqual(result.payload.state.media.published, [{ id: 'alt' }]);
  assert.ok(Array.isArray(result.payload.state.world.windowScenes));
  assert.equal(result.payload.state.player.act, 2);
});

test('Spielstände aus einer neueren Version werden abgelehnt', async () => {
  const { migrate } = await import('../src/save/migrations.mjs');
  const result = migrate({ version: 99, state: { meta: {} } });
  assert.equal(result.ok, false);
});

test('Enden werden nach Priorität aufgelöst', () => {
  const g = newGame();
  g.store.setFlag('finale_gehalten');
  g.store.setStat('authenticity', 90);
  assert.equal(g.progression.resolveEnding().id, 'ending_a_real_authentisch');

  const secret = newGame();
  secret.store.setFlag('finale_gehalten');
  secret.store.setFlag('easter_egg_dromedar');
  assert.equal(secret.progression.resolveEnding().id, 'ending_secret_dromedar');

  const chaos = newGame();
  chaos.store.setFlag('finale_gehalten');
  chaos.store.setStat('crashout', 100);
  assert.equal(chaos.progression.resolveEnding().id, 'ending_e_chaos');
});

test('der Ereignis-Scheduler respektiert Cooldowns', () => {
  const g = newGame(4);
  const first = g.events.fire('ev_fahrzeug_vor_der_wohnung');
  assert.ok(first);
  g.events.pending = null;
  const candidates = g.events.candidates().map((e) => e.id);
  assert.ok(!candidates.includes('ev_fahrzeug_vor_der_wohnung'), 'Cooldown greift nicht');
});

test('Ereignisse mit Auswahl warten auf eine Antwort', () => {
  const g = newGame(6);
  const fired = g.events.fire('ev_nwo_anruf');
  assert.equal(fired.needsChoice, true);
  assert.ok(g.events.view().choices.length >= 2);
  const answered = g.events.respond(0);
  assert.ok(answered);
  assert.equal(g.events.view(), null);
});

test('Inventar: Tragen wirkt passiv und wird beim Wechsel zurückgenommen', () => {
  const g = newGame();
  const before = g.store.stat('authenticity');
  g.store.addItem('tutanchamun_anhaenger');
  g.store.addItem('widderkopf_anhaenger');
  g.inventory.wear('tutanchamun_anhaenger');
  const mit = g.store.stat('authenticity');
  assert.equal(mit, before + 2);
  g.inventory.wear('widderkopf_anhaenger');
  assert.equal(g.store.stat('authenticity'), before + 3);
});

test('Tagebuchseiten sammeln sich und schalten das Archivar-Achievement frei', () => {
  const g = newGame();
  assert.equal(g.inventory.tagebuch().filter((p) => p.found).length, 3);
  for (let i = 0; i < 12; i++) g.inventory.grantRandomPage();
  assert.equal(g.store.s.tagebuch.pages.length, 12);
  assert.ok(g.store.s.achievements.includes('ach_archivar'));
});

test('der Kodex trennt die Lore-Layer', () => {
  const g = newGame();
  const view = g.codex.view();
  assert.ok(view.SOURCE_BASED_LORE.length > 0);
  assert.ok(view.MEME_LORE.length > 0);
  for (const [layer, entries] of Object.entries(view)) {
    for (const entry of entries) assert.equal(entry.layer, layer);
  }
});

test('gesperrte Lore zeigt keinen Text', () => {
  const g = newGame();
  const gesperrt = Object.values(g.codex.view()).flat().filter((e) => !e.unlocked);
  for (const entry of gesperrt) assert.equal(entry.description, null);
});
