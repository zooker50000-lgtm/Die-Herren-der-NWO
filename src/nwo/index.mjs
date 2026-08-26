/**
 * Die NWO: Einfluss, Überwachung und das Terminal.
 * Einfluss wächst nicht nur durch Quests, sondern durch alles, was
 * Aufmerksamkeit erzeugt — die Organisation reagiert auf Sichtbarkeit.
 */
import { meets } from '../core/conditions.mjs';

export class NwoSystem {
  constructor(ctx) {
    this.ctx = ctx;
    this.data = ctx.registry.data.nwo;
    this.wire();
  }

  get influence() { return this.ctx.store.stat('nwoInfluence'); }
  get tier() { return this.ctx.registry.influenceTier(this.influence); }

  wire() {
    const { bus, store } = this.ctx;
    // Wer gesehen wird, wird erfasst.
    bus.on('fideo.published', ({ nwoRelated, reach }) => {
      const gain = (nwoRelated ? 3 : 1) + Math.min(4, reach / 12000);
      store.addStat('nwoInfluence', gain, { min: 0, max: 100 });
    });
    bus.on('crashout.maximum', () => store.addStat('nwoInfluence', 4, { min: 0, max: 100 }));
    bus.on('nwo.sees_all', () => {
      store.setFlag('nwo_sieht_alles');
      this.ctx.bus.emit('achievement.request', { achievement: 'ach_sieht_alles' });
    });
  }

  /** Wie viele Agenten stehen aktuell in der Welt? */
  agentCount() { return this.tier.agents; }

  /** Terminalzugang: erst ab der Strukturstufe. */
  terminalAvailable() {
    return this.influence >= (this.data.terminal.sections[0]?.requiresInfluence ?? 40)
      || this.ctx.store.s.unlocks.includes('nwo_terminal');
  }

  sections() {
    return this.data.terminal.sections.map((s) => ({
      ...s,
      unlocked: this.influence >= s.requiresInfluence
    }));
  }

  /** Akten einer Sektion, gefiltert nach Freischaltung. */
  files(sectionId) {
    return this.data.terminal.files
      .filter((f) => f.section === sectionId)
      .map((f) => ({ ...f, unlocked: this.influence >= f.requiresInfluence }));
  }

  openTerminal() {
    this.ctx.bus.emit('nwo.terminal', { action: 'open' });
    this.ctx.bus.emit('audio.sfx', { id: 'nwo_sting' });
    this.ctx.store.addLog(this.data.terminal.greeting, 'nwo');
    return { greeting: this.data.terminal.greeting, sections: this.sections() };
  }

  readFile(fileId) {
    const file = this.ctx.registry.nwoFiles.get(fileId);
    if (!file) return null;
    if (this.influence < file.requiresInfluence) {
      return { locked: true, requiresInfluence: file.requiresInfluence };
    }
    this.ctx.bus.emit('nwo.terminal', { action: 'read', file: fileId, section: file.section });
    this.ctx.store.addStat('nwoInfluence', 1, { min: 0, max: 100 });
    return file;
  }

  /** Struktur der Organisation, so weit sie bekannt ist. */
  knownStructure() {
    const walk = (node) => {
      const character = this.ctx.registry.character(node.id);
      const faction = this.ctx.registry.factions.get(node.id);
      const known = character
        ? Boolean(this.ctx.store.s.trust[node.id]) || character.available
        : this.influence >= 40;
      return {
        id: node.id,
        name: character?.name ?? faction?.name ?? node.name ?? node.id,
        known: node.hidden ? this.influence >= 80 : known,
        children: (node.children ?? []).map(walk)
      };
    };
    return walk(this.data.structure);
  }

  /** NWO-Mail, die bei aktuellem Einfluss zugestellt werden darf. */
  pendingMail() {
    return this.ctx.registry.data.emails.nwoMail.filter((m) =>
      this.influence >= m.requiresInfluence &&
      !this.ctx.store.s.emails.handled.includes(m.id) &&
      !this.ctx.store.s.emails.inbox.some((e) => e.templateId === m.id)
    );
  }

  /** Orte/Features, die die aktuelle Stufe freischaltet. */
  unlocked(id) {
    return this.ctx.store.s.unlocks.includes(id) || meets(this.ctx.store.s, { stats: { nwoInfluence: { min: 100 } } });
  }
}
