/**
 * Akte und Enden.
 *
 * Der Akt schreitet fort, wenn die Welt weit genug ist — gemessen an
 * abgeschlossenen Quests, Flags und Einfluss. Kein Akt wird übersprungen,
 * aber mehrere können in Folge fallen, wenn der Spieler weit vorgelaufen ist.
 */
import { meets } from '../core/conditions.mjs';

export const ACT_GATES = {
  2: { quests: { completed: ['der_erste_heeter'] } },
  3: { quests: { completed: ['die_nwo_sieht_alles'] } },
  4: { stats: { nwoInfluence: { min: 30 } }, quests: { completed: ['die_nwo_sieht_alles'] } },
  5: { stats: { nwoInfluence: { min: 40 } } },
  6: { quests: { completed: ['das_magische_tagebuch'] } },
  7: { quests: { completed: ['alchemimon_03'] } },
  8: { quests: { completed: ['alchemimon_06'] } },
  9: { quests: { completed: ['das_nwo_labor'] } },
  10: { quests: { completed: ['operation_hades'] } },
  11: { quests: { completed: ['islamimon_15'] } },
  12: { quests: { completed: ['rechtsextremimon_12'] } },
  13: { quests: { completed: ['baphomimon_friedensverhandlung'] } },
  14: { flags: ['pressesprecher_entschieden'] },
  15: { quests: { completed: ['fenster_quest'] } }
};

export class Progression {
  constructor(ctx) {
    this.ctx = ctx;
    this.ctx.bus.on('quest.completed', () => this.check());
    this.ctx.bus.on('flag.set', () => this.check());
    this.ctx.bus.on('nwo.influence', () => this.check());
  }

  get act() { return this.ctx.store.s.player.act; }

  check() {
    let advanced = false;
    while (this.act < 15) {
      const gate = ACT_GATES[this.act + 1];
      if (!gate || !meets(this.ctx.store.s, gate)) break;
      this.advance();
      advanced = true;
    }
    if (advanced) this.ctx.quests.autoStart();
    return advanced;
  }

  advance() {
    const store = this.ctx.store;
    store.s.player.act += 1;
    store.s.player.chapter = `chapter_${Math.min(4, Math.ceil(store.s.player.act / 4))}`;
    store.touch('player');
    const act = this.ctx.registry.acts.get(`akt_${store.s.player.act}`);
    store.addLog(`AKT ${store.s.player.act}: ${act?.title ?? ''}`, 'akt');
    this.ctx.bus.emit('act.changed', { act: store.s.player.act, title: act?.title, summary: act?.summary });
    this.ctx.codex.unlockByProgress();
  }

  /** Nach dem letzten Mimonolog: welches Ende greift? */
  resolveEnding() {
    const state = this.ctx.store.s;
    for (const ending of this.ctx.registry.data.endings.endings) {
      const requires = { ...ending.requires };
      const pages = requires.tagebuchPages;
      delete requires.tagebuchPages;
      if (!meets(state, requires)) continue;
      if (pages != null && state.tagebuch.pages.length < pages) continue;
      state.ending = ending.id;
      this.ctx.store.touch('*');
      this.ctx.bus.emit('ending.reached', { ending: ending.id, code: ending.code, title: ending.title });
      return ending;
    }
    return null;
  }

  actInfo() {
    const act = this.ctx.registry.acts.get(`akt_${this.act}`);
    const next = ACT_GATES[this.act + 1];
    return {
      n: this.act,
      title: act?.title ?? '',
      summary: act?.summary ?? '',
      nextGate: next ?? null,
      nextReady: next ? meets(this.ctx.store.s, next) : false
    };
  }
}
