#!/usr/bin/env node
/**
 * Automatischer Durchlauf: spielt das Spiel zufällig, aber zielgerichtet, und
 * meldet, wie weit die Geschichte kommt. Dient als Regressionstest für die
 * Erreichbarkeit von Inhalten — wenn ein Akt nie erreicht wird, fehlt ein Weg.
 */
import { loadData } from '../src/data/loader.mjs';
import { Game } from '../src/game.mjs';

const seed = Number(process.argv[2] ?? 2024);
const steps = Number(process.argv[3] ?? 4000);
const data = await loadData();
const g = new Game(data, { seed, storage: { read: () => null, write: () => true, remove: () => {} } });
g.start();

const errors = [];
const acts = [];
g.bus.on('bus.error', (e) => errors.push(`${e.type}: ${e.error.message}`));
g.bus.on('act.changed', (p) => acts.push(`${p.act} ${p.title}`));

const rng = g.rng;
const spielDialog = (dialogueId, npc) => {
  let view = g.dialogue.open(dialogueId, { npc });
  for (let guard = 0; view && guard < 30; guard++) {
    if (view.choices.length) {
      const offen = view.choices.filter((c) => c.available);
      view = g.dialogue.choose(rng.pick(offen.length ? offen : view.choices).index);
    } else if (view.canContinue) view = g.dialogue.continue();
    else break;
  }
  g.dialogue.close();
};

/** Bildet die Interaktionen nach, die beide Clients anbieten. */
function benutzeInteraktion(it) {
  const ergebnis = g.world.interact(it.id);
  if (!ergebnis.ok) return;
  switch (it.type) {
    case 'window': g.world.lookOutWindow(); break;
    case 'dialogue': spielDialog(it.dialogue); break;
    case 'investigate': if (rng.chance(0.5)) g.inventory.grantRandomPage(); break;
    case 'consume': g.store.addItem(it.item, 1); g.inventory.use(it.item); break;
    case 'police_report': g.bus.emit('police.report', { location: g.store.s.player.location }); break;
    case 'lore': g.codex.unlock(it.lore); break;
    case 'sleep': g.clock.advance(480); break;
    case 'rest': g.clock.advance(60); break;
    case 'series': case 'archive': break;
    case 'event': g.events.fire(it.event); break;
    default: break;
  }
}

for (let i = 0; i < steps; i++) {
  try {
    if (g.events.view()) { g.events.respond(rng.int(0, g.events.view().choices.length - 1)); continue; }

    switch (rng.int(1, 16)) {
      case 1: g.world.lookOutWindow(); break;
      case 2: { const ziel = rng.pick(g.world.exits().filter((e) => e.unlocked)); if (ziel) g.world.travel(ziel.id); break; }
      case 3: g.fideos.publish({ topic: rng.pick(['nwo', 'heeter', 'alchemie', 'richtigstellung']), length: rng.pick(['kurz', 'mittel', 'lang']), anger: rng.int(0, 100), evidence: rng.chance(0.5) }); break;
      case 4: { const m = rng.pick(g.emails.inbox); if (m) { g.emails.read(m.id); g.emails.handle(m.id, rng.pick(['ignorieren', 'antworten', 'vorlesen', 'polizei', 'nwo'])); } break; }
      case 5: { const npc = rng.pick(g.world.npcsHere()); const d = npc && g.roster.dialogueFor(npc.id, { channel: 'vor_ort' }); if (d) spielDialog(d, npc.id); break; }
      case 6: { const kontakt = rng.pick(g.roster.reachableVia('telefon')); if (kontakt) { g.bus.emit('phone.answered', { caller: kontakt.id }); spielDialog(g.roster.dialogueFor(kontakt.id, { channel: 'telefon' }), kontakt.id); } break; }
      case 7: { const gegner = rng.pick(g.roster.reachableVia('online')); if (gegner) spielDialog(g.roster.dialogueFor(gegner.id, { channel: 'online' }), gegner.id); break; }
      case 8: g.monolog.generate({ topic: rng.pick(Object.keys(g.registry.topics)) }); break;
      case 9: g.fideos.analyzeComments(); break;
      case 10: { const f = rng.pick(g.fideos.library()); if (f) g.fideos.watch(f.id); break; }
      case 11: { const r = rng.pick(g.alchemy.knownRecipes()); if (r) g.alchemy.brew(r.id); else g.inventory.grantRandomPage(); break; }
      case 12: { if (g.nwo.terminalAvailable()) g.nwo.readFile(rng.pick(g.registry.data.nwo.terminal.files).id); break; }
      case 13: { const bereich = rng.pick(g.world.labAreas().filter((a) => a.unlocked)); if (g.store.s.player.location === 'nwo_labor' && bereich) g.world.enterLabArea(bereich.id); else g.clock.advance(60); break; }
      case 14: { const shop = g.world.here?.interactables?.find((it) => it.type === 'shop'); if (shop) { const laden = g.world.shop(shop.shop); g.world.buy(shop.shop, rng.pick(laden.stock).id); } break; }
      case 15: { const it = rng.pick(g.world.interactables()); if (it) benutzeInteraktion(it); break; }
      case 16: { const offen = g.quests.journal().available; if (offen.length) g.quests.start(rng.pick(offen).id); break; }
    }
  } catch (err) {
    errors.push(`Schritt ${i}: ${err.message} @ ${(err.stack ?? '').split('\n')[1]?.trim()}`);
  }
}

const s = g.store.s;
console.log(`\nDURCHLAUF  seed=${seed}  schritte=${steps}\n`);
console.log(`Akt ${s.player.act} · Tag ${s.world.day} · ${g.clock.format()}`);
console.log(`Akte erreicht: ${acts.join(' | ') || '—'}`);
console.log(`Quests: ${s.quests.completed.length} abgeschlossen, ${Object.keys(s.quests.active).length} aktiv`);
console.log(`Kodex: ${g.codex.stats().unlocked}/${g.codex.stats().total} · Achievements: ${s.achievements.length}`);
console.log(`Orte besucht: ${s.world.visited.length}/${data.locations.locations.length} · Dialoge gespielt: ${s.dialogue.played.length}/${Object.keys(data.dialogue.dialogues).length}`);
console.log(`Meter: REAL-AUTH ${Math.round(s.stats.authenticity)} · CRASHOUT ${Math.round(s.stats.crashout)} · NWO ${Math.round(s.stats.nwoInfluence)} · METT ${Math.round(s.stats.mett)} · Alchemie ${s.stats.alchemy}`);
console.log(`Monologe: ${s.counters.monologs} · Ehdzhusten: ${s.counters.ehdzhusten} · Fideos: ${s.counters.fideosPublished}`);
const journal = g.quests.journal();
console.log('\nOFFEN:');
for (const q of journal.active) {
  const fehlt = q.objectives.filter((o) => !o.done).map((o) => `${o.text} (${o.count}/${o.needed})`);
  console.log(`  ${q.title}: ${fehlt.join(' · ') || 'erfüllt'}`);
}
console.log('VERFÜGBAR: ' + (journal.available.map((q) => q.title).join(', ') || '—'));

console.log(errors.length ? `\nFEHLER (${errors.length}):\n${[...new Set(errors)].slice(0, 10).join('\n')}` : '\nKeine Fehler.');
process.exit(errors.length ? 1 : 0);
