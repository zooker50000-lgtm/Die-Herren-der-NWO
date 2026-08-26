/**
 * Zentraler, vollständig serialisierbarer Spielzustand.
 * Alles, was ein Savegame ausmacht, steht hier — und nur hier.
 */

export const SAVE_VERSION = 4;

/**
 * Gueltige Grenzen je Wert. Sie stehen hier, damit kein Aufrufer sie vergessen
 * kann - ein Crashout von 102 wuerde sonst durch jedes Stufenraster fallen.
 */
export const STAT_BOUNDS = {
  crashout: { min: 0, max: 100 },
  authenticity: { min: 0, max: 100 },
  nwoInfluence: { min: 0, max: 100 },
  nwoReputation: { min: 0, max: 100 },
  heeterAggro: { min: 0, max: 100 },
  mimonolog: { min: 0, max: 100 },
  alchemy: { min: 1, max: 100 },
  crashoutResist: { min: -50, max: 50 },
  mett: { min: 0, max: Infinity },
  subscribers: { min: 0, max: Infinity },
  alchemyXp: { min: 0, max: Infinity }
};

/** Werte mit eigenem Ereignisnamen - siehe docs/ARCHITECTURE.md. */
const STAT_EVENTS = {
  crashout: 'crashout.changed',
  authenticity: 'authenticity.changed',
  mett: 'mett.changed',
  nwoInfluence: 'nwo.influence',
  subscribers: 'subscribers.changed',
  alchemyXp: 'alchemy.xp'
};

export function createInitialState(seed = Date.now() >>> 0) {
  return {
    meta: {
      version: SAVE_VERSION,
      seed,
      createdAt: null,
      playedMinutes: 0
    },
    player: {
      name: 'Mimon Baraka',
      act: 1,
      chapter: 'chapter_1',
      location: 'mimons_wohnung',
      labArea: null,
      outfit: { oberkoerper: 'lederjacke', beine: 'jeans', hals: null }
    },
    stats: {
      authenticity: 50,
      crashout: 10,
      crashoutResist: 0,
      mett: 120,
      nwoInfluence: 5,
      nwoReputation: 30,
      heeterAggro: 10,
      subscribers: 1400,
      alchemy: 1,
      alchemyXp: 0,
      mimonolog: 20
    },
    flags: {},
    trust: {},
    inventory: {},
    tagebuch: { pages: [] },
    quests: { active: {}, completed: [], failed: [] },
    dialogue: { played: [] },
    lore: { unlocked: [] },
    achievements: [],
    emails: { inbox: [], handled: [], nextId: 1 },
    media: { published: [], watched: [], comments: [] },
    heeters: {},
    world: { minutes: 8 * 60, day: 1, visited: ['mimons_wohnung'], labAreas: [], windowScenes: [] },
    events: { cooldowns: {}, lastId: null },
    counters: {
      monologs: 0,
      calmMonologs: 0,
      ehdzhusten: 0,
      windowObserved: 0,
      emailsHandled: 0,
      fideosPublished: 0,
      crashoutsMaximum: 0,
      kelchninjaSightings: 0
    },
    unlocks: [],
    log: [],
    ending: null
  };
}

/**
 * Dünner Wrapper um den Zustandsbaum. Kein Proxy, keine Magie:
 * Systeme mutieren den Baum direkt und melden Änderungen über `touch`,
 * damit die Clients wissen, wann neu gezeichnet werden muss.
 */
export class Store {
  constructor(state, bus) {
    this.state = state;
    this.bus = bus;
    this.dirty = new Set();
  }

  get s() { return this.state; }

  touch(section, detail = {}) {
    this.dirty.add(section);
    this.bus?.emit('state.patched', { section, detail });
  }

  flushDirty() { const out = [...this.dirty]; this.dirty.clear(); return out; }

  // --- Statistiken -------------------------------------------------------

  stat(key) { return this.state.stats[key] ?? 0; }

  setStat(key, value, bounds) {
    const { min = 0, max = Infinity } = bounds ?? STAT_BOUNDS[key] ?? {};
    const clamped = Math.max(min, Math.min(max, value));
    const before = this.state.stats[key] ?? 0;
    if (before === clamped) return { key, before, after: clamped, delta: 0 };
    this.state.stats[key] = clamped;
    this.touch('stats', { key });

    // Statusänderungen werden ausschließlich hier gemeldet - egal ob sie aus
    // einem Effekt, aus dem Zeitverfall oder direkt aus einem System kommen.
    const result = { key, before, after: clamped, delta: clamped - before };
    this.bus?.emit('stat.changed', result);
    const named = STAT_EVENTS[key];
    if (named) this.bus?.emit(named, result);
    return result;
  }

  addStat(key, delta, bounds) { return this.setStat(key, (this.state.stats[key] ?? 0) + delta, bounds); }

  // --- Flags -------------------------------------------------------------

  flag(id) { return Boolean(this.state.flags[id]); }
  setFlag(id, value = true) {
    if (Boolean(this.state.flags[id]) === Boolean(value)) return false;
    if (value) this.state.flags[id] = true; else delete this.state.flags[id];
    this.touch('flags', { id, value });
    return true;
  }

  // --- Vertrauen ---------------------------------------------------------

  trust(npcId, fallback = 50) {
    return this.state.trust[npcId] ?? fallback;
  }
  addTrust(npcId, delta, fallback = 50) {
    const before = this.trust(npcId, fallback);
    const after = Math.max(0, Math.min(100, before + delta));
    this.state.trust[npcId] = after;
    this.touch('trust', { npcId });
    return { npcId, before, after, delta: after - before };
  }

  // --- Inventar ----------------------------------------------------------

  has(itemId, count = 1) { return (this.state.inventory[itemId] ?? 0) >= count; }
  addItem(itemId, count = 1) {
    this.state.inventory[itemId] = (this.state.inventory[itemId] ?? 0) + count;
    this.touch('inventory', { itemId });
    return this.state.inventory[itemId];
  }
  removeItem(itemId, count = 1) {
    const have = this.state.inventory[itemId] ?? 0;
    if (have <= count) delete this.state.inventory[itemId];
    else this.state.inventory[itemId] = have - count;
    this.touch('inventory', { itemId });
    return Math.min(have, count);
  }

  // --- Zähler & Log ------------------------------------------------------

  count(key, delta = 1) {
    this.state.counters[key] = (this.state.counters[key] ?? 0) + delta;
    this.touch('counters', { key });
    return this.state.counters[key];
  }

  addLog(text, kind = 'info') {
    if (!text) return;
    this.state.log.push({ text, kind, at: this.state.world.minutes, day: this.state.world.day });
    if (this.state.log.length > 300) this.state.log.shift();
    this.touch('log');
    this.bus?.emit('log.added', { text, kind });
  }

  serialize() { return JSON.parse(JSON.stringify(this.state)); }
}
