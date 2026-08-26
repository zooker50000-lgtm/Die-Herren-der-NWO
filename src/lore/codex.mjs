/**
 * Der Kodex: freigeschaltete Lore, nach Layern getrennt.
 * Die Trennung ist nicht kosmetisch — sie hält die Ebenen auseinander
 * (siehe docs/LORE_LAYERS.md).
 */
import { LAYERS } from '../data/validate.mjs';

export class Codex {
  constructor(ctx) {
    this.ctx = ctx;
    this.ctx.bus.on('quest.completed', ({ quest }) => this.unlockForQuest(quest));
    this.ctx.bus.on('clock.day', () => this.unlockByProgress());
  }

  get unlocked() { return this.ctx.store.s.lore.unlocked; }

  unlock(loreId) {
    if (this.unlocked.includes(loreId)) return false;
    if (!this.ctx.registry.lore.get(loreId)) return false;
    this.unlocked.push(loreId);
    this.ctx.store.touch('lore');
    this.ctx.bus.emit('lore.unlocked', { lore: loreId });
    return true;
  }

  /** Alles freischalten, dessen unlock-Bedingung inzwischen erfüllt ist. */
  unlockByProgress() {
    const act = this.ctx.store.s.player.act;
    for (const entry of this.ctx.registry.data.lore.entries) {
      if (this.unlocked.includes(entry.id)) continue;
      const u = entry.unlock;
      if (!u || u === 'start') this.unlock(entry.id);
      else if (u.startsWith('akt_') && act >= Number(u.slice(4))) this.unlock(entry.id);
      else if (u.startsWith('chapter_') && this.ctx.store.s.player.chapter === u) this.unlock(entry.id);
      else if (this.ctx.store.flag(u)) this.unlock(entry.id);
    }
  }

  unlockForQuest(questId) {
    const quest = this.ctx.registry.quest(questId);
    for (const loreId of quest?.rewards?.lore ?? []) this.unlock(loreId);
  }

  /** Kodex-Ansicht, nach Layer gruppiert. */
  view({ includeLocked = true } = {}) {
    const groups = {};
    for (const layer of LAYERS) groups[layer] = [];
    for (const entry of this.ctx.registry.data.lore.entries) {
      const isUnlocked = this.unlocked.includes(entry.id);
      if (!isUnlocked && !includeLocked) continue;
      groups[entry.layer].push({
        id: entry.id,
        title: entry.title,
        type: entry.type,
        category: entry.category,
        layer: entry.layer,
        unlocked: isUnlocked,
        description: isUnlocked ? entry.description : null,
        derivedFrom: entry.derivedFrom ?? null
      });
    }
    return groups;
  }

  stats() {
    const total = this.ctx.registry.data.lore.entries.length;
    return { unlocked: this.unlocked.length, total, percent: Math.round((this.unlocked.length / total) * 100) };
  }

  /** Serienübersicht mit Fortschritt je Episode. */
  series() {
    const completed = this.ctx.store.s.quests.completed;
    return this.ctx.registry.data.series.series.map((s) => ({
      id: s.id,
      title: s.title,
      episodeCount: s.episodeCount,
      layer: s.layer,
      logline: s.logline,
      contentNote: s.contentNote ?? null,
      done: s.episodes.filter((e) => e.quest && completed.includes(e.quest)).length,
      playable: s.episodes.filter((e) => e.quest).length,
      episodes: s.episodes.map((e) => ({
        n: e.n,
        title: e.title,
        summary: e.summary,
        layer: e.layer,
        quest: e.quest ?? null,
        done: Boolean(e.quest && completed.includes(e.quest))
      }))
    }));
  }
}
