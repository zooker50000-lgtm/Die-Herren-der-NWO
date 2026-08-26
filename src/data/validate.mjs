/**
 * Konsistenzprüfung der Content-Datenbank.
 * Wird von `npm run validate` und von den Tests benutzt.
 */

export const LAYERS = ['SOURCE_BASED_LORE', 'IN_UNIVERSE_AUDIO_LORE', 'MEME_LORE', 'FICTIONAL_GAME_CONTENT'];

export function validateData(data) {
  const errors = [];
  const warnings = [];
  const err = (msg) => errors.push(msg);
  const warn = (msg) => warnings.push(msg);

  const characterIds = new Set(data.characters.characters.map((c) => c.id));
  const itemIds = new Set(data.items.items.map((i) => i.id));
  const questIds = new Set(data.quests.quests.map((q) => q.id));
  const loreIds = new Set(data.lore.entries.map((l) => l.id));
  const locationIds = new Set(data.locations.locations.map((l) => l.id));
  const dialogueIds = new Set(Object.keys(data.dialogue.dialogues));
  const achievementIds = new Set(data.endings.achievements.map((a) => a.id));
  const factionIds = new Set(data.nwo.factions.map((f) => f.id));
  const topicIds = new Set(Object.keys(data.vocabulary.topics));

  // --- Layer-Pflicht ----------------------------------------------------
  const layered = [
    ['characters', data.characters.characters],
    ['items', data.items.items],
    ['lore', data.lore.entries],
    ['quests', data.quests.quests],
    ['events', data.events.events],
    ['locations', data.locations.locations],
    ['lexicon', data.vocabulary.lexicon],
    ['catchphrases', data.vocabulary.catchphrases],
    ['series', data.series.series],
    ['endings', data.endings.endings],
    ['achievements', data.endings.achievements],
    ['recipes', data.alchemy.recipes]
  ];
  for (const [group, list] of layered) {
    for (const entry of list) {
      if (!entry.layer) err(`${group}/${entry.id}: Feld "layer" fehlt`);
      else if (!LAYERS.includes(entry.layer)) err(`${group}/${entry.id}: unbekannter layer "${entry.layer}"`);
    }
  }

  // --- ids eindeutig und snake_case -------------------------------------
  for (const [group, list] of layered) {
    const seen = new Set();
    for (const entry of list) {
      if (seen.has(entry.id)) err(`${group}: doppelte id "${entry.id}"`);
      seen.add(entry.id);
      if (entry.id && !/^[a-z0-9_]+$/.test(entry.id)) warn(`${group}/${entry.id}: id ist nicht snake_case`);
    }
  }

  // --- derivedFrom zeigt nicht ins Leere --------------------------------
  const knownSources = new Set([...loreIds, ...characterIds, ...data.series.series.map((s) => s.id)]);
  const walkDerived = (list, group) => {
    for (const entry of list) {
      if (entry.derivedFrom && !knownSources.has(entry.derivedFrom)) {
        err(`${group}/${entry.id}: derivedFrom "${entry.derivedFrom}" existiert nicht`);
      }
    }
  };
  walkDerived(data.lore.entries, 'lore');
  walkDerived(data.quests.quests, 'quests');
  for (const series of data.series.series) walkDerived(series.episodes.map((e) => ({ id: `${series.id}#${e.n}`, derivedFrom: e.derivedFrom })), 'series');

  // --- Lexikon: keine Allerwelts-Kontexte -------------------------------
  for (const entry of data.vocabulary.lexicon) {
    if (!entry.contexts?.length) err(`lexicon/${entry.id}: contexts fehlt`);
    else if (entry.contexts.includes('*')) err(`lexicon/${entry.id}: contexts "*" ist nicht erlaubt (siehe CONTENT_GUIDE)`);
  }

  // --- Figuren: Stimme und Fraktion -------------------------------------
  for (const c of data.characters.characters) {
    if (!c.voice) err(`characters/${c.id}: voice fehlt`);
    if (c.faction && !factionIds.has(c.faction)) err(`characters/${c.id}: unbekannte faction "${c.faction}"`);
    if (c.home && !locationIds.has(c.home)) err(`characters/${c.id}: unbekannter home-Ort "${c.home}"`);
  }

  // --- Quests -----------------------------------------------------------
  for (const q of data.quests.quests) {
    if (q.giver && q.giver !== 'self' && !characterIds.has(q.giver)) err(`quests/${q.id}: unbekannter giver "${q.giver}"`);
    if (!q.objectives?.length) err(`quests/${q.id}: keine objectives`);
    for (const target of q.requires?.quests?.completed ?? []) if (!questIds.has(target)) err(`quests/${q.id}: requires unbekannte Quest "${target}"`);
    checkEffects(q.rewards, `quests/${q.id}.rewards`);
    checkEffects(q.onStart, `quests/${q.id}.onStart`);
  }

  // --- Dialoge ----------------------------------------------------------
  for (const [id, dlg] of Object.entries(data.dialogue.dialogues)) {
    if (dlg.npc && !characterIds.has(dlg.npc)) err(`dialogue/${id}: unbekannter npc "${dlg.npc}"`);
    if (!dlg.nodes?.[dlg.start]) err(`dialogue/${id}: start-Knoten "${dlg.start}" fehlt`);
    for (const [nodeId, node] of Object.entries(dlg.nodes ?? {})) {
      const where = `dialogue/${id}/${nodeId}`;
      if (node.speaker && node.speaker !== 'mimon' && node.speaker !== 'narrator' && !characterIds.has(node.speaker)) {
        err(`${where}: unbekannter speaker "${node.speaker}"`);
      }
      if (node.monolog?.topic && !topicIds.has(node.monolog.topic)) err(`${where}: unbekanntes Monolog-Thema "${node.monolog.topic}"`);
      if (node.next && node.next !== 'END' && !dlg.nodes[node.next]) err(`${where}: next "${node.next}" existiert nicht`);
      checkEffects(node.effects, where);
      for (const [i, choice] of (node.choices ?? []).entries()) {
        const cwhere = `${where}/choice[${i}]`;
        if (choice.next && choice.next !== 'END' && !dlg.nodes[choice.next]) err(`${cwhere}: next "${choice.next}" existiert nicht`);
        checkEffects(choice.effects, cwhere);
      }
      if (!node.choices?.length && !node.next) err(`${where}: weder choices noch next`);
    }
  }

  // --- Orte -------------------------------------------------------------
  for (const loc of data.locations.locations) {
    for (const conn of loc.connections ?? []) if (!locationIds.has(conn)) err(`locations/${loc.id}: Verbindung "${conn}" existiert nicht`);
    for (const npc of loc.npcs ?? []) if (!characterIds.has(npc)) err(`locations/${loc.id}: unbekannter npc "${npc}"`);
    for (const it of loc.interactables ?? []) {
      if (it.dialogue && !dialogueIds.has(it.dialogue)) err(`locations/${loc.id}/${it.id}: Dialog "${it.dialogue}" existiert nicht`);
      if (it.lore && !loreIds.has(it.lore)) err(`locations/${loc.id}/${it.id}: Lore "${it.lore}" existiert nicht`);
      if (it.item && !itemIds.has(it.item)) err(`locations/${loc.id}/${it.id}: Item "${it.item}" existiert nicht`);
      if (it.shop && !data.locations.shops[it.shop]) err(`locations/${loc.id}/${it.id}: Shop "${it.shop}" existiert nicht`);
    }
  }
  for (const [shopId, shop] of Object.entries(data.locations.shops)) {
    for (const item of shop.stock) if (!itemIds.has(item)) err(`shops/${shopId}: unbekanntes Item "${item}"`);
  }

  // --- Serien -----------------------------------------------------------
  for (const s of data.series.series) {
    if (s.episodeCount !== s.episodes.length) err(`series/${s.id}: episodeCount ${s.episodeCount} != ${s.episodes.length} gelistete Episoden`);
    for (const ep of s.episodes) if (ep.quest && !questIds.has(ep.quest)) err(`series/${s.id}#${ep.n}: Quest "${ep.quest}" existiert nicht`);
  }

  // --- Alchemie ---------------------------------------------------------
  for (const r of data.alchemy.recipes) {
    for (const ing of r.ingredients) if (!itemIds.has(ing)) err(`alchemy/${r.id}: unbekannte Zutat "${ing}"`);
    checkEffects(r.effects, `alchemy/${r.id}`);
  }
  for (const b of data.alchemy.books) {
    if (!itemIds.has(b.id)) err(`alchemy/books: "${b.id}" ist kein Item`);
    for (const rec of b.unlocksRecipes) if (!data.alchemy.recipes.some((r) => r.id === rec)) err(`alchemy/books/${b.id}: Rezept "${rec}" existiert nicht`);
  }

  // --- Events -----------------------------------------------------------
  for (const ev of data.events.events) {
    checkEffects(ev.effects, `events/${ev.id}`);
    for (const [i, c] of (ev.choices ?? []).entries()) checkEffects(c.effects, `events/${ev.id}/choice[${i}]`);
    for (const loc of ev.requires?.location ?? []) if (!locationIds.has(loc)) err(`events/${ev.id}: unbekannter Ort "${loc}"`);
  }

  // --- Heet-Mehls -------------------------------------------------------
  const heeterIds = new Set(data.emails.heeters.map((h) => h.id));
  for (const mail of data.emails.pool) {
    if (!heeterIds.has(mail.from)) err(`emails/${mail.id}: unbekannter Absender "${mail.from}"`);
  }
  for (const h of data.emails.heeters) {
    if (h.character && !characterIds.has(h.character)) err(`emails/heeters/${h.id}: unbekannte Figur "${h.character}"`);
    if (!data.emails.templates[h.tactic]) err(`emails/heeters/${h.id}: keine Templates für Taktik "${h.tactic}"`);
  }
  for (const action of data.emails.actions) checkEffects(action.effects, `emails/actions/${action.id}`);

  // --- Enden ------------------------------------------------------------
  for (const e of data.endings.endings) {
    for (const a of e.requires?.achievements ?? []) if (!achievementIds.has(a)) err(`endings/${e.id}: unbekanntes Achievement "${a}"`);
  }

  function checkEffects(effects, where) {
    if (!effects) return;
    for (const item of effects.items ?? []) if (!itemIds.has(item)) err(`${where}: unbekanntes Item "${item}"`);
    for (const item of effects.removeItems ?? []) if (!itemIds.has(item)) err(`${where}: unbekanntes Item "${item}"`);
    for (const lore of effects.lore ?? []) if (!loreIds.has(lore)) err(`${where}: unbekannte Lore "${lore}"`);
    for (const ach of effects.achievements ?? []) if (!achievementIds.has(ach)) err(`${where}: unbekanntes Achievement "${ach}"`);
    for (const quest of effects.quests?.start ?? []) if (!questIds.has(quest)) err(`${where}: unbekannte Quest "${quest}"`);
    for (const npc of Object.keys(effects.trust ?? {})) if (!characterIds.has(npc)) err(`${where}: unbekannte Figur "${npc}"`);
    if (effects.monolog?.topic && !topicIds.has(effects.monolog.topic)) err(`${where}: unbekanntes Monolog-Thema "${effects.monolog.topic}"`);
  }

  return { ok: errors.length === 0, errors, warnings };
}
