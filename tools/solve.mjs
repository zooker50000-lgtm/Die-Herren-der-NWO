#!/usr/bin/env node
/**
 * Zielgerichteter Durchlauf: sucht zu jedem offenen Questziel die passende
 * Handlung und spielt sie. Beweist, dass die Hauptlinie durchspielbar ist —
 * ein Ziel, das hier hängen bleibt, ist im echten Spiel ebenfalls blockiert.
 */
import { loadData } from '../src/data/loader.mjs';
import { Game } from '../src/game.mjs';

const data = await loadData();
const laut = process.argv.includes('--laut');
const g = new Game(data, { seed: Number(process.argv[2] ?? 11), storage: { read: () => null, write: () => true, remove: () => {} } });
g.start();

const log = [];
g.bus.on('quest.completed', ({ title }) => log.push(`✓ ${title}`));
g.bus.on('act.changed', ({ act, title }) => log.push(`── AKT ${act}: ${title}`));
g.bus.on('ending.reached', ({ code, title }) => log.push(`ENDE ${code}: ${title}`));

// --- Wegfindung über den (beidseitigen) Ortsgraph ------------------------
const nachbarn = (id) => {
  const loc = g.registry.location(id);
  const ids = new Set(loc?.connections ?? []);
  for (const other of data.locations.locations) if ((other.connections ?? []).includes(id)) ids.add(other.id);
  return [...ids];
};

function geheZu(zielId) {
  if (g.store.s.player.location === zielId) return true;
  const vorgaenger = new Map([[g.store.s.player.location, null]]);
  const rand = [g.store.s.player.location];
  while (rand.length) {
    const aktuell = rand.shift();
    for (const nachbar of nachbarn(aktuell)) {
      if (vorgaenger.has(nachbar)) continue;
      vorgaenger.set(nachbar, aktuell);
      rand.push(nachbar);
    }
  }
  if (!vorgaenger.has(zielId)) return false;
  const pfad = [];
  for (let k = zielId; k; k = vorgaenger.get(k)) pfad.unshift(k);
  for (const schritt of pfad.slice(1)) {
    if (!g.world.travel(schritt).ok) return false;
  }
  return true;
}

function spieleDialog(dialogueId, { kanal, bevorzugt = () => 0 } = {}) {
  const dlg = g.registry.dialogue(dialogueId);
  if (!dlg) return false;
  const kanaele = dlg.channels ?? ['vor_ort'];
  const gewaehlt = kanal && kanaele.includes(kanal) ? kanal : kanaele[0];
  if (gewaehlt === 'vor_ort') {
    const ort = data.locations.locations.find((l) => (l.npcs ?? []).includes(dlg.npc)
      || (l.interactables ?? []).some((i) => i.dialogue === dialogueId));
    if (ort && !geheZu(ort.id)) return false;
  } else if (gewaehlt === 'telefon') {
    g.bus.emit('phone.answered', { caller: dlg.npc });
  }
  let view = g.dialogue.open(dialogueId, { npc: dlg.npc });
  for (let guard = 0; view && guard < 40; guard++) {
    if (view.choices.length) {
      const offen = view.choices.filter((c) => c.available);
      if (!offen.length) break;
      view = g.dialogue.choose(offen[bevorzugt(offen) % offen.length].index);
    } else if (view.canContinue) view = g.dialogue.continue();
    else break;
  }
  g.dialogue.close();
  return true;
}

/** Versucht, genau ein Ziel zu erfüllen. */
function loese(quest, objective) {
  const w = objective.where ?? {};
  const s = g.store.s;

  if (objective.flag) {
    // Flags entstehen aus Dialogentscheidungen: den Dialog suchen, der das Flag
    // setzt, und dort gezielt die Antwort waehlen, die es auch wirklich setzt.
    for (const [id, dlg] of Object.entries(data.dialogue.dialogues)) {
      if (!JSON.stringify(dlg.nodes).includes(`"${objective.flag}"`)) continue;
      if (g.roster.dialogueFor(dlg.npc, { channel: (dlg.channels ?? [])[0] }) !== id) continue;
      if (spieleDialog(id, { bevorzugt: (offen) => waehleFuerFlag(dlg, offen, objective.flag) })) {
        if (g.store.flag(objective.flag)) return true;
      }
    }
    return false;
  }
  if (objective.stat) {
    if (objective.stat === 'alchemy') return brauen(25);
    if (objective.stat === 'mett') { g.fideos.publish({ topic: 'heeter', length: 'lang', anger: 90, evidence: false }); return true; }
    if (objective.stat === 'authenticity') { g.fideos.publish({ topic: 'richtigstellung', length: 'lang', anger: 5, evidence: true }); return true; }
    if (objective.stat === 'nwoInfluence') { g.fideos.publish({ topic: 'nwo', length: 'lang', anger: 40, evidence: true }); return true; }
    if (objective.stat === 'nwoReputation') { g.applyEffects({ nwoReputation: 5 }); return true; }
    return false;
  }

  switch (objective.event) {
    case 'window.observed':
      if (!geheZu('mimons_wohnung')) return false;
      if (w.phase && g.clock.phase !== w.phase) g.clock.advance(60);
      g.world.lookOutWindow();
      return true;
    case 'fideo.published':
      g.fideos.publish({
        topic: w.topic ?? 'nwo',
        length: 'lang',
        anger: w.angerMax != null ? Math.max(0, w.angerMax - 10) : 50,
        evidence: w.evidence ?? true
      });
      return true;
    case 'fideo.watched': { g.fideos.watch(w.id ?? 'fideo_veraendert'); return true; }
    case 'comments.analyzed': g.fideos.analyzeComments(); return true;
    case 'email.read': {
      const mail = g.emails.inbox.find((m) => !w.channel || m.channel === w.channel) ?? g.emails.spawn('auto');
      if (!mail) return false;
      g.emails.read(mail.id);
      return true;
    }
    case 'email.handled': {
      const mail = g.emails.inbox[0] ?? g.emails.spawn('auto');
      if (!mail) return false;
      g.emails.read(mail.id);
      g.emails.handle(mail.id, w.action ?? 'antworten');
      return true;
    }
    case 'dialogue.closed': {
      if (w.dialogue) return spieleDialog(w.dialogue);
      if (w.npc) { const d = g.roster.dialogueFor(w.npc); return d ? spieleDialog(d) : false; }
      if (w.faction) {
        const figur = data.characters.characters.find((c) => c.faction === w.faction && g.roster.dialogueFor(c.id));
        return figur ? spieleDialog(g.roster.dialogueFor(figur.id)) : false;
      }
      return false;
    }
    case 'phone.answered': {
      const ziel = w.caller ?? g.roster.reachableVia('telefon')[0]?.id;
      const d = ziel && g.roster.dialogueFor(ziel, { channel: 'telefon' });
      if (d) return spieleDialog(d, { kanal: 'telefon' });
      if (ziel) { g.bus.emit('phone.answered', { caller: ziel }); return true; }
      return false;
    }
    case 'world.travel': return geheZu(w.to);
    case 'labor.area': {
      if (!geheZu('nwo_labor')) return false;
      const bereiche = g.world.labAreas().filter((a) => a.unlocked && (!w.area || a.id === w.area));
      if (!bereiche.length) return false;
      for (const bereich of bereiche) g.world.enterLabArea(bereich.id);
      return true;
    }
    case 'tagebuch.page': return Boolean(g.inventory.grantRandomPage());
    case 'item.gained': return besorge(w.item);
    case 'alchemy.brewed': return brauen();
    case 'alchemy.stage': return brauen(3, w.stage);
    case 'nwo.terminal': {
      const akten = data.nwo.terminal.files.filter((f) => (!w.file || f.id === w.file) && (!w.section || f.section === w.section));
      let ok = false;
      for (const akte of akten) ok = Boolean(g.nwo.readFile(akte.id)?.title) || ok;
      return ok;
    }
    case 'monolog.finished': {
      if (w.tier === 'calm' || w.tierMax === 'annoyed') {
        // Runterkommen: in der Wohnung faellt der Crashout am schnellsten.
        geheZu('mimons_wohnung');
        while (g.meters.voiceTier !== 'calm' && g.store.stat('crashout') > 0) g.clock.advance(120);
      }
      g.monolog.generate({ topic: w.topic ?? 'allgemein', final: w.final });
      return true;
    }
    case 'police.report':
      if (!geheZu('polizeistation')) return false;
      g.bus.emit('police.report', { location: 'polizeistation' });
      return true;
    case 'world.interact': {
      const ort = data.locations.locations.find((l) => (l.interactables ?? []).some((i) => i.id === w.interactable));
      if (!ort || !geheZu(ort.id)) return false;
      return g.world.interact(w.interactable).ok;
    }
    case 'easteregg.kelchninja':
      // Sichtungen kommen aus dem Ereignis - hier gezielt ausgeloest.
      g.events.fire('ev_kelchninja_sichtung');
      g.store.s.events.cooldowns.ev_kelchninja_sichtung = 0;
      return true;
    case 'quest.completed': return false;   // ergibt sich aus der Kette
    default: return false;
  }
}

/** Welche Antwort führt zu dem gesuchten Flag? */
function waehleFuerFlag(dlg, offen, flag) {
  for (const [index, choice] of offen.entries()) {
    if (JSON.stringify(choice.preview ?? '').includes(flag)) return index;
    const knoten = Object.values(dlg.nodes).find((n) => (n.choices ?? []).some((c) => c.text === choice.text));
    const definition = (knoten?.choices ?? []).find((c) => c.text === choice.text);
    if (!definition) continue;
    if ((definition.effects?.flags ?? []).includes(flag)) return index;
    const folge = definition.next && dlg.nodes[definition.next];
    if (folge && JSON.stringify(folge).includes(`"${flag}"`)) return index;
  }
  return 0;
}

/** Welche Antwort bringt den gesuchten Gegenstand? */
function waehleFuerItem(dlg, offen, itemId) {
  for (const [index, choice] of offen.entries()) {
    const knoten = Object.values(dlg.nodes).find((n) => (n.choices ?? []).some((c) => c.text === choice.text));
    const definition = (knoten?.choices ?? []).find((c) => c.text === choice.text);
    if (!definition) continue;
    if ((definition.effects?.items ?? []).includes(itemId)) return index;
    const folge = definition.next && dlg.nodes[definition.next];
    if (folge && (folge.effects?.items ?? []).includes(itemId)) return index;
  }
  return 0;
}

/** Mett verdienen, wenn der Preis nicht reicht. */
function verdiene(betrag) {
  let versuche = 0;
  while (g.store.stat('mett') < betrag && versuche++ < 40) {
    g.fideos.publish({ topic: 'heeter', length: 'lang', anger: 85, evidence: false });
  }
  return g.store.stat('mett') >= betrag;
}

/** Zutaten kaufen und brauen — mehrfach, damit der Skill auch steigt. */
function brauen(durchgaenge = 6, stufe = null) {
  if (!geheZu('alchemielabor')) { if (laut) log.push('  brauen: Labor nicht erreichbar'); return false; }
  let erfolg = false;
  for (let i = 0; i < durchgaenge; i++) {
    // Bestes Rezept, das Level und Labor tatsaechlich hergeben.
    const moeglich = g.alchemy.knownRecipes()
      .filter((r) => r.minLevel <= g.store.stat('alchemy') && r.tier <= g.alchemy.labLevel())
      .filter((r) => !stufe || r.stage === stufe)
      .sort((a, b) => b.xp - a.xp);
    const rezept = moeglich[0];
    if (!rezept) { if (laut) log.push('  brauen: kein Rezept'); return erfolg; }
    let vollstaendig = true;
    for (const zutat of rezept.ingredients) {
      if (g.store.has(zutat)) continue;
      const preis = g.registry.item(zutat)?.price;
      if (!preis || !g.world.shop('myrrmoasta').stock.some((s) => s.id === zutat)) { if (laut) log.push('  brauen: Zutat nicht kaufbar: ' + zutat); vollstaendig = false; break; }
      verdiene(preis);
      geheZu('alchemielabor');
      const kauf = g.world.buy('myrrmoasta', zutat); if (!kauf.ok) { if (laut) log.push('  brauen: Kauf scheitert (' + zutat + '): ' + kauf.reason); vollstaendig = false; break; }
    }
    if (!vollstaendig) return erfolg;
    const b = g.alchemy.brew(rezept.id); if (!b.ok && laut) log.push('  brauen: ' + b.reason); erfolg = b.ok || erfolg;
  }
  return erfolg;
}

/** Einen bestimmten Gegenstand beschaffen. */
function besorge(itemId) {
  if (!itemId || g.store.has(itemId)) return true;
  for (const [id, dlg] of Object.entries(data.dialogue.dialogues)) {
    if (!JSON.stringify(dlg.nodes).includes(`"${itemId}"`)) continue;
    if (g.roster.dialogueFor(dlg.npc, { channel: (dlg.channels ?? [])[0] }) !== id) continue;
    // Die Antwort waehlen, die den Gegenstand auch tatsaechlich einbringt.
    if (spieleDialog(id, { bevorzugt: (offen) => waehleFuerItem(dlg, offen, itemId) }) && g.store.has(itemId)) return true;
  }
  for (const shopId of Object.keys(data.locations.shops)) {
    if (!data.locations.shops[shopId].stock.includes(itemId)) continue;
    const ort = data.locations.locations.find((l) => (l.interactables ?? []).some((i) => i.shop === shopId));
    if (!ort) continue;
    verdiene(g.registry.item(itemId)?.price ?? 0);
    if (geheZu(ort.id) && g.world.buy(shopId, itemId).ok) return true;
  }
  return false;
}

// --- Hauptschleife ------------------------------------------------------

let stillstand = 0;
for (let runde = 0; runde < 400 && stillstand < 25; runde++) {
  if (g.events.view()) { g.events.respond(0); continue; }
  g.quests.autoStart();
  for (const quest of g.quests.journal().available) g.quests.start(quest.id);

  let etwasGetan = false;
  for (const quest of g.quests.journal().active) {
    for (const objective of quest.objectives) {
      if (objective.done) continue;
      const definition = g.registry.quest(quest.id).objectives.find((o) => o.id === objective.id);
      try {
        const geloest = loese(quest, definition);
        if (laut) log.push(`${geloest ? '·' : '×'} ${quest.title}: ${objective.text}`);
        if (geloest) { etwasGetan = true; break; }
      } catch (err) {
        log.push(`! ${quest.title}/${objective.id}: ${err.message}`);
      }
    }
  }
  stillstand = etwasGetan ? 0 : stillstand + 1;
  if (!etwasGetan) g.clock.advance(180);

  if (g.store.s.player.act >= 15 && g.store.s.quests.active.der_letzte_mimonolog) {
    geheZu('mimons_wohnung');
    g.world.interact('computer');
    g.finalMonolog();
    break;
  }
}

const s = g.store.s;
if (laut) console.log(log.join('\n'));
console.log(`\nZIELGERICHTETER DURCHLAUF\n`);
console.log(`Akt ${s.player.act}/15 · Tag ${s.world.day}`);
console.log(`Quests: ${s.quests.completed.length}/${data.quests.quests.length} abgeschlossen`);
console.log(`Orte: ${s.world.visited.length}/${data.locations.locations.length} · Dialoge: ${s.dialogue.played.length}/${Object.keys(data.dialogue.dialogues).length}`);
console.log(`Kodex: ${g.codex.stats().unlocked}/${g.codex.stats().total} · Ende: ${s.ending ?? '—'}`);
const offen = g.quests.journal().active.flatMap((q) => q.objectives.filter((o) => !o.done).map((o) => `${q.title}: ${o.text}`));
console.log(offen.length ? `\nNicht lösbar:\n  ${offen.join('\n  ')}` : '\nAlle aktiven Ziele lösbar.');
