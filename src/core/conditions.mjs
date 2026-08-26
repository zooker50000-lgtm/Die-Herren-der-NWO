/**
 * Einheitliche Bedingungsprüfung. Jedes System benutzt dieselbe Funktion,
 * damit `requires` überall dasselbe bedeutet.
 *
 * Unterstützt: flags, notFlags, quests{active,completed,notCompleted},
 * stats{key:{min,max}}, trust{npc:{min,max}}, items, notItems, act{min,max},
 * chapter, location, notLocation, phase, tagebuchPages, achievements.
 */
export function meets(state, requires) {
  if (!requires || typeof requires !== 'object') return true;

  const q = requires.quests ?? {};
  const checks = [
    () => (requires.flags ?? []).every((f) => Boolean(state.flags[f])),
    () => (requires.notFlags ?? []).every((f) => !state.flags[f]),
    () => (q.completed ?? []).every((id) => state.quests.completed.includes(id)),
    () => (q.notCompleted ?? []).every((id) => !state.quests.completed.includes(id)),
    () => (q.active ?? []).every((id) => Boolean(state.quests.active[id])),
    () => (requires.items ?? []).every((id) => (state.inventory[id] ?? 0) > 0),
    () => (requires.notItems ?? []).every((id) => !(state.inventory[id] > 0)),
    () => (requires.achievements ?? []).every((id) => state.achievements.includes(id)),
    () => inRange(state.player.act, requires.act),
    () => !requires.chapter || state.player.chapter === requires.chapter,
    () => !requires.location || asList(requires.location).includes(state.player.location),
    () => !requires.notLocation || !asList(requires.notLocation).includes(state.player.location),
    () => requires.tagebuchPages == null || state.tagebuch.pages.length >= requires.tagebuchPages,
    () => Object.entries(requires.stats ?? {}).every(([key, range]) => inRange(state.stats[key] ?? 0, range)),
    () => Object.entries(requires.trust ?? {}).every(([npc, range]) => inRange(state.trust[npc] ?? 50, range))
  ];

  return checks.every((check) => check());
}

/** `phase` wird gesondert geprüft, weil dafür die Uhr gebraucht wird. */
export function meetsWithClock(state, requires, clock) {
  if (!meets(state, requires)) return false;
  if (requires?.phase && !asList(requires.phase).includes(clock.phase)) return false;
  return true;
}

export function inRange(value, range) {
  if (range == null) return true;
  if (typeof range === 'number') return value >= range;
  if (range.min != null && value < range.min) return false;
  if (range.max != null && value > range.max) return false;
  return true;
}

function asList(value) { return Array.isArray(value) ? value : [value]; }

/** Erklärt, welche Teilbedingung fehlt — für Tooltips und die Questliste. */
export function explain(state, requires) {
  if (!requires) return [];
  const missing = [];
  for (const f of requires.flags ?? []) if (!state.flags[f]) missing.push(`Voraussetzung fehlt: ${f}`);
  for (const id of requires.quests?.completed ?? []) if (!state.quests.completed.includes(id)) missing.push(`Quest offen: ${id}`);
  for (const id of requires.items ?? []) if (!(state.inventory[id] > 0)) missing.push(`Gegenstand fehlt: ${id}`);
  if (!inRange(state.player.act, requires.act)) missing.push(`Erst ab Akt ${requires.act?.min ?? requires.act}`);
  for (const [key, range] of Object.entries(requires.stats ?? {})) {
    if (!inRange(state.stats[key] ?? 0, range)) missing.push(`${key} muss ${range.min != null ? `>= ${range.min}` : `<= ${range.max}`} sein`);
  }
  for (const [npc, range] of Object.entries(requires.trust ?? {})) {
    if (!inRange(state.trust[npc] ?? 50, range)) missing.push(`Vertrauen zu ${npc} zu niedrig`);
  }
  return missing;
}
