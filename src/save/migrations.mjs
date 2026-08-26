/**
 * Save-Migrationen. Jede Migration hebt einen Stand um genau eine Version.
 * Fehlende Felder werden ergänzt, nie überschrieben.
 */
import { SAVE_VERSION, createInitialState } from '../core/state.mjs';

const MIGRATIONS = {
  // v1 -> v2: Medien- und Heeter-Zustand wurden aus losen Feldern zusammengeführt.
  1: (payload) => {
    const s = payload.state;
    s.media ??= { published: s.fideos ?? [], watched: [], comments: [] };
    delete s.fideos;
    s.heeters ??= {};
    payload.version = 2;
    return payload;
  },
  // v2 -> v3: Zähler, Unlocks und Ehdzhusten-Statistik kamen dazu.
  2: (payload) => {
    const s = payload.state;
    s.counters ??= {};
    s.unlocks ??= [];
    s.world.windowScenes ??= [];
    s.world.labAreas ??= [];
    payload.version = 3;
    return payload;
  },
  // v3 -> v4: gespielte Dialoge werden mitgeschrieben, damit einmalige
  // Gespraeche nicht erneut angeboten werden.
  3: (payload) => {
    payload.state.dialogue ??= { played: [] };
    payload.version = 4;
    return payload;
  }
};

export function migrate(payload) {
  if (!payload?.state) return { ok: false, reason: 'Archiv ohne Spielstand.' };
  let current = payload;
  let guard = 0;

  while ((current.version ?? 1) < SAVE_VERSION) {
    const step = MIGRATIONS[current.version ?? 1];
    if (!step) return { ok: false, reason: `Kein Migrationspfad von Version ${current.version}.` };
    current = step(current);
    if (++guard > 20) return { ok: false, reason: 'Migration hängt.' };
  }

  if (current.version > SAVE_VERSION) {
    return { ok: false, reason: 'Archiv stammt aus einer neueren Version des Spiels.' };
  }

  current.state = fillDefaults(current.state);
  return { ok: true, payload: current };
}

/** Neue Felder aus dem Startzustand ergänzen, vorhandene beibehalten. */
export function fillDefaults(state) {
  const base = createInitialState(state.meta?.seed ?? 1);
  return deepDefault(state, base);
}

function deepDefault(target, defaults) {
  if (Array.isArray(defaults)) return Array.isArray(target) ? target : defaults;
  if (defaults && typeof defaults === 'object') {
    const out = { ...defaults, ...(target ?? {}) };
    for (const key of Object.keys(defaults)) {
      out[key] = deepDefault(target?.[key], defaults[key]);
    }
    return out;
  }
  return target === undefined ? defaults : target;
}
