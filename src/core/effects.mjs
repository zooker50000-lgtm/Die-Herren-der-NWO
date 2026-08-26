/**
 * Der eine Effekt-Applikator. Dialogoptionen, Quest-Rewards, Events,
 * Heet-Mehl-Reaktionen und Item-Nutzung benutzen dasselbe Format.
 * Siehe docs/ARCHITECTURE.md, Abschnitt "Das Effekt-Format".
 */

import { STAT_BOUNDS } from './state.mjs';

/** Werte, die ein Effekt direkt veraendern darf (alchemy selbst nur ueber XP). */
const STAT_KEYS = Object.fromEntries(
  Object.entries(STAT_BOUNDS).filter(([key]) => key !== 'alchemy')
);

/**
 * @param {object} ctx  { store, bus, registry, rng }
 * @param {object} effects
 * @returns {Array<{kind:string,label:string,value?:number}>} was tatsächlich passiert ist
 */
export function applyEffects(ctx, effects, source = {}) {
  if (!effects) return [];
  const { store, bus } = ctx;
  const applied = [];

  for (const [key, bounds] of Object.entries(STAT_KEYS)) {
    if (typeof effects[key] !== 'number') continue;
    // Das Ereignis feuert der Store selbst - hier wird nur gesammelt, was zu sehen ist.
    const result = store.addStat(key, effects[key], bounds);
    if (result.delta !== 0) applied.push({ kind: 'stat', key, label: statLabel(key), value: result.delta });
  }

  for (const [npcId, delta] of Object.entries(effects.trust ?? {})) {
    const result = store.addTrust(npcId, delta);
    applied.push({ kind: 'trust', key: npcId, label: `Vertrauen ${npcId}`, value: result.delta });
    bus.emit('trust.changed', { ...result, source });
  }

  for (const flag of effects.flags ?? []) {
    if (store.setFlag(flag, true)) {
      applied.push({ kind: 'flag', key: flag, label: flag });
      bus.emit('flag.set', { flag, source });
    }
  }
  for (const flag of effects.unflags ?? []) {
    if (store.setFlag(flag, false)) bus.emit('flag.cleared', { flag, source });
  }

  for (const itemId of effects.items ?? []) {
    store.addItem(itemId, 1);
    applied.push({ kind: 'item', key: itemId, label: ctx.registry?.itemName(itemId) ?? itemId });
    bus.emit('item.gained', { item: itemId, source });
  }
  for (const itemId of effects.removeItems ?? []) {
    store.removeItem(itemId, 1);
    bus.emit('item.lost', { item: itemId, source });
  }

  for (const loreId of effects.lore ?? []) {
    if (!store.s.lore.unlocked.includes(loreId)) {
      store.s.lore.unlocked.push(loreId);
      store.touch('lore');
      applied.push({ kind: 'lore', key: loreId, label: ctx.registry?.loreTitle(loreId) ?? loreId });
      bus.emit('lore.unlocked', { lore: loreId, source });
    }
  }

  for (const id of effects.achievements ?? []) {
    if (!store.s.achievements.includes(id)) {
      store.s.achievements.push(id);
      store.touch('achievements');
      applied.push({ kind: 'achievement', key: id, label: ctx.registry?.achievementTitle(id) ?? id });
      bus.emit('achievement.unlocked', { achievement: id, source });
    }
  }

  for (const questId of effects.quests?.start ?? []) bus.emit('quest.request_start', { quest: questId, source });
  for (const token of effects.quests?.advance ?? []) {
    const [quest, objective] = String(token).split(':');
    bus.emit('quest.request_advance', { quest, objective, source });
  }

  if (effects.spawnHeeter) bus.emit('heeter.request_spawn', { count: effects.spawnHeeter, source });
  if (effects.spawnEmail) bus.emit('email.request_spawn', { spec: effects.spawnEmail, source });
  if (effects.spawnComment) bus.emit('fideo.request_comment', { count: effects.spawnComment, source });
  if (effects.monolog) bus.emit('monolog.request', { ...effects.monolog, source });
  for (const sfx of effects.sfx ?? []) bus.emit('audio.sfx', { id: sfx });
  if (effects.emits) bus.emit(effects.emits, { source });

  if (effects.log) store.addLog(effects.log, 'effect');
  if (effects.time) ctx.clock?.advance(effects.time);

  if (applied.length) bus.emit('effects.applied', { applied, source });
  return applied;
}

function statLabel(key) {
  return {
    crashout: 'CRASHOUT',
    authenticity: 'REAL-AUTHENTISCH',
    mett: 'METT',
    nwoInfluence: 'NWO INFLUENCE',
    nwoReputation: 'NWO-REPUTATION',
    heeterAggro: 'HEETER-AGGRO',
    subscribers: 'ABONNENTEN',
    alchemyXp: 'ALCHEMIE',
    crashoutResist: 'GELASSENHEIT',
    mimonolog: 'MIMONOLOG'
  }[key] ?? key;
}

/** Effekte zusammenfassen (z. B. für Vorschau-Tooltips in der UI). */
export function describeEffects(effects, registry) {
  if (!effects) return [];
  const out = [];
  for (const key of Object.keys(STAT_KEYS)) {
    if (typeof effects[key] === 'number' && effects[key] !== 0) {
      out.push(`${effects[key] > 0 ? '+' : ''}${effects[key]} ${statLabel(key)}`);
    }
  }
  for (const [npc, delta] of Object.entries(effects.trust ?? {})) {
    out.push(`${delta > 0 ? '+' : ''}${delta} Vertrauen (${registry?.characterName(npc) ?? npc})`);
  }
  for (const item of effects.items ?? []) out.push(`Erhalten: ${registry?.itemName(item) ?? item}`);
  return out;
}
