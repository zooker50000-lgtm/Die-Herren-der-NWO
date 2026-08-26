/**
 * MIMON-ARCHIV — das Speichersystem.
 *
 * Ein Savegame ist { version, seed, rngCursor, state }. Ältere Stände
 * werden von den Migrationen angehoben, damit Archive nicht brechen,
 * wenn neue Systeme dazukommen.
 */
import { SAVE_VERSION } from '../core/state.mjs';
import { migrate } from './migrations.mjs';

export const SLOTS = ['archiv_01', 'archiv_02', 'archiv_03', 'autosave'];
export const SLOT_LABELS = {
  archiv_01: 'ARCHIV 01',
  archiv_02: 'ARCHIV 02',
  archiv_03: 'ARCHIV 03',
  autosave: 'FIDEO ARCHIVIERT'
};

/** localStorage im Browser, Datei-Ablage in Node. */
export function createStorage() {
  if (typeof localStorage !== 'undefined') {
    return {
      read: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
      write: (key, value) => { try { localStorage.setItem(key, value); return true; } catch { return false; } },
      remove: (key) => { try { localStorage.removeItem(key); } catch { /* egal */ } }
    };
  }
  const dir = 'saves';
  const fsp = () => import('node:fs');
  return {
    async read(key) {
      const fs = await fsp();
      try { return fs.readFileSync(`${dir}/${key}.json`, 'utf8'); } catch { return null; }
    },
    async write(key, value) {
      const fs = await fsp();
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(`${dir}/${key}.json`, value, 'utf8');
      return true;
    },
    async remove(key) {
      const fs = await fsp();
      try { fs.unlinkSync(`${dir}/${key}.json`); } catch { /* egal */ }
    }
  };
}

export class SaveSystem {
  constructor(ctx, storage = createStorage()) {
    this.ctx = ctx;
    this.storage = storage;
    this.prefix = 'mimon_archiv_';
  }

  key(slot) { return `${this.prefix}${slot}`; }

  async save(slot = 'archiv_01') {
    const payload = {
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      seed: this.ctx.rng.seed,
      rngCursor: this.ctx.rng.cursor,
      state: this.ctx.store.serialize()
    };
    const ok = await this.storage.write(this.key(slot), JSON.stringify(payload));
    if (ok !== false) {
      this.ctx.bus.emit('save.written', { slot, label: SLOT_LABELS[slot] });
      if (slot !== 'autosave') this.ctx.store.addLog(`Gespeichert: ${SLOT_LABELS[slot]}`, 'system');
    }
    return ok !== false;
  }

  async load(slot = 'archiv_01') {
    const raw = await this.storage.read(this.key(slot));
    if (!raw) return { ok: false, reason: 'Archiv ist leer.' };
    let payload;
    try { payload = JSON.parse(raw); } catch { return { ok: false, reason: 'Archiv beschädigt.' }; }

    const migrated = migrate(payload);
    if (!migrated.ok) return migrated;

    this.ctx.store.state = migrated.payload.state;
    this.ctx.rng.seed = migrated.payload.seed >>> 0;
    this.ctx.rng.cursor = migrated.payload.rngCursor >>> 0;
    this.ctx.rng.state = (this.ctx.rng.seed + this.ctx.rng.cursor * 0x6d2b79f5) >>> 0;
    this.ctx.store.touch('*');
    this.ctx.bus.emit('save.loaded', { slot, version: migrated.payload.version });
    return { ok: true, slot };
  }

  async info(slot) {
    const raw = await this.storage.read(this.key(slot));
    if (!raw) return { slot, label: SLOT_LABELS[slot], empty: true };
    try {
      const payload = JSON.parse(raw);
      const s = payload.state;
      return {
        slot,
        label: SLOT_LABELS[slot],
        empty: false,
        version: payload.version,
        savedAt: payload.savedAt,
        act: s.player.act,
        location: s.player.location,
        day: s.world.day,
        authenticity: Math.round(s.stats.authenticity),
        nwoInfluence: Math.round(s.stats.nwoInfluence),
        subscribers: s.stats.subscribers,
        quests: s.quests.completed.length
      };
    } catch {
      return { slot, label: SLOT_LABELS[slot], empty: false, corrupt: true };
    }
  }

  async list() { return Promise.all(SLOTS.map((slot) => this.info(slot))); }

  async remove(slot) { await this.storage.remove(this.key(slot)); }

  /** Autosave nach jedem veröffentlichten Fideo: "FIDEO ARCHIVIERT". */
  enableAutosave() {
    this.ctx.bus.on('fideo.published', () => this.save('autosave'));
    this.ctx.bus.on('quest.completed', () => this.save('autosave'));
    this.ctx.bus.on('act.changed', () => this.save('autosave'));
  }
}
