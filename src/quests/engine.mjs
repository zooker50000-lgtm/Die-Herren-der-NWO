/**
 * Quest-Engine.
 *
 * Objectives sind deklarativ und werden gegen den Event-Bus geprüft:
 *   { event, where, count }  — zählt passende Ereignisse
 *   { flag }                 — erfüllt, sobald ein Flag gesetzt ist
 *   { stat, min }            — erfüllt, sobald ein Wert erreicht ist
 * Kein Quest-Skript, keine Sonderfälle im Code.
 */
import { meets, explain } from '../core/conditions.mjs';
import { applyEffects } from '../core/effects.mjs';

export class QuestEngine {
  constructor(ctx) {
    this.ctx = ctx;
    this.wire();
  }

  get state() { return this.ctx.store.s.quests; }

  wire() {
    const { bus } = this.ctx;
    bus.on('quest.request_start', ({ quest }) => this.start(quest));
    bus.on('quest.request_advance', ({ quest, objective }) => this.forceObjective(quest, objective));
    bus.on('flag.set', () => this.checkAll());
    bus.on('stat.changed', () => this.checkAll());
    bus.on('crashout.changed', () => this.checkAll());
    bus.on('mett.changed', () => this.checkAll());
    bus.on('authenticity.changed', () => this.checkAll());
    bus.on('nwo.influence', () => this.checkAll());
    bus.on('alchemy.levelup', () => this.checkAll());
    // Wer mit einer Figur gesprochen hat, bekommt ihre offenen Auftraege.
    bus.on('dialogue.closed', ({ npc }) => this.offerFrom(npc));
    bus.on('*', (payload, type) => this.observe(type, payload));
  }

  /** Alle Quests, die jetzt startbar sind (Voraussetzungen erfüllt). */
  available() {
    return this.ctx.registry.data.quests.quests.filter((q) =>
      !this.state.active[q.id] &&
      !this.state.completed.includes(q.id) &&
      meets(this.ctx.store.s, q.requires)
    );
  }

  start(questId) {
    const quest = this.ctx.registry.quest(questId);
    if (!quest) return null;
    if (this.state.active[questId] || this.state.completed.includes(questId)) return null;
    if (!meets(this.ctx.store.s, quest.requires)) return null;

    this.state.active[questId] = {
      id: questId,
      started: this.ctx.store.s.world.minutes,
      day: this.ctx.store.s.world.day,
      // Bereits Erledigtes zaehlt sofort: wer die gesuchte Tagebuchseite schon
      // gefunden hat, bevor die Quest anlief, koennte sie sonst nie abschliessen.
      objectives: Object.fromEntries(quest.objectives.map((o) => [o.id, this.seedObjective(o)]))
    };
    this.ctx.store.touch('quests');
    if (quest.onStart) applyEffects(this.ctx, quest.onStart, { quest: questId });
    this.ctx.store.addLog(`Neue Quest: ${quest.title}`, 'quest');
    this.ctx.bus.emit('quest.started', { quest: questId, title: quest.title, type: quest.type });

    this.checkQuest(questId);
    return this.state.active[questId];
  }

  /** Startet alles, was ohne Zutun startbar ist (Story-Fortschritt). */
  autoStart() {
    for (const quest of this.available()) {
      if (quest.hidden) continue;
      if (quest.type === 'main' || quest.giver === 'self') this.start(quest.id);
    }
  }

  /**
   * Anfangsstand eines Ziels aus dem bestehenden Spielzustand.
   * Deckt die Ziele ab, die auf einen dauerhaften Zustand zeigen (Besitz,
   * besuchte Orte, gefundene Seiten) - reine Handlungsziele starten bei 0.
   */
  seedObjective(objective) {
    const s = this.ctx.store.s;
    const where = objective.where ?? {};
    const treffer = (bedingung) => (bedingung ? 1 : 0);
    let zaehler = 0;

    switch (objective.event) {
      case 'tagebuch.page':
        zaehler = where.page ? treffer(s.tagebuch.pages.includes(where.page)) : s.tagebuch.pages.length;
        break;
      case 'item.gained':
        zaehler = where.item ? treffer((s.inventory[where.item] ?? 0) > 0) : 0;
        break;
      case 'labor.area':
        zaehler = where.area ? treffer(s.world.labAreas.includes(where.area)) : s.world.labAreas.length;
        break;
      case 'world.travel':
        zaehler = where.to ? treffer(s.world.visited.includes(where.to)) : 0;
        break;
      case 'dialogue.closed':
        zaehler = where.dialogue ? treffer(s.dialogue.played.includes(where.dialogue)) : 0;
        break;
      case 'fideo.watched':
        zaehler = where.id ? treffer(s.media.watched.includes(where.id)) : 0;
        break;
      case 'quest.completed':
        zaehler = where.quest ? treffer(s.quests.completed.includes(where.quest)) : 0;
        break;
      default:
        zaehler = 0;
    }
    return Math.min(zaehler, objective.count ?? 1);
  }

  /** Auftraege, die diese Figur vergibt und die jetzt moeglich sind. */
  offerFrom(npcId) {
    if (!npcId) return [];
    const offen = this.available().filter((q) => q.giver === npcId && !q.hidden);
    for (const quest of offen) this.start(quest.id);
    return offen;
  }

  observe(type, payload) {
    if (type.startsWith('quest.')) return;
    this.discoverHidden(type, payload);
    let changed = false;
    for (const questId of Object.keys(this.state.active)) {
      const quest = this.ctx.registry.quest(questId);
      const progress = this.state.active[questId];
      if (!quest || !progress) continue;

      for (const objective of quest.objectives) {
        if (!objective.event || objective.event !== type) continue;
        if (this.isObjectiveDone(quest, progress, objective)) continue;
        if (!matchWhere(objective.where, payload)) continue;

        progress.objectives[objective.id] = (progress.objectives[objective.id] ?? 0) + 1;
        changed = true;
        this.ctx.bus.emit('quest.objective', {
          quest: questId,
          objective: objective.id,
          text: objective.text,
          count: progress.objectives[objective.id],
          needed: objective.count ?? 1,
          done: this.isObjectiveDone(quest, progress, objective)
        });
      }
    }
    if (changed) { this.ctx.store.touch('quests'); this.checkAll(); }
  }

  /**
   * Versteckte Quests werden nicht angeboten, sondern entdeckt: sobald ein
   * Ereignis auf ihr erstes Ziel passt, laufen sie an. Ohne das koennten sie
   * nie beginnen, weil sie in keiner Liste auftauchen.
   */
  discoverHidden(type, payload) {
    for (const quest of this.available()) {
      if (!quest.hidden) continue;
      const erstes = quest.objectives[0];
      if (erstes?.event !== type) continue;
      if (!matchWhere(erstes.where, payload)) continue;
      this.start(quest.id);
    }
  }

  forceObjective(questId, objectiveId) {
    const progress = this.state.active[questId];
    if (!progress || !(objectiveId in progress.objectives)) return;
    progress.objectives[objectiveId] += 1;
    this.ctx.store.touch('quests');
    this.checkQuest(questId);
  }

  isObjectiveDone(quest, progress, objective) {
    if (objective.flag) return Boolean(this.ctx.store.s.flags[objective.flag]);
    if (objective.stat) return (this.ctx.store.s.stats[objective.stat] ?? 0) >= objective.min;
    return (progress.objectives[objective.id] ?? 0) >= (objective.count ?? 1);
  }

  checkAll() {
    for (const questId of Object.keys(this.state.active)) this.checkQuest(questId);
  }

  checkQuest(questId) {
    const quest = this.ctx.registry.quest(questId);
    const progress = this.state.active[questId];
    if (!quest || !progress) return;
    const done = quest.objectives.every((o) => this.isObjectiveDone(quest, progress, o));
    if (done) this.complete(questId);
  }

  complete(questId) {
    const quest = this.ctx.registry.quest(questId);
    if (!quest || !this.state.active[questId]) return;
    delete this.state.active[questId];
    this.state.completed.push(questId);
    this.ctx.store.touch('quests');
    this.ctx.store.addLog(`Abgeschlossen: ${quest.title}`, 'quest');
    if (quest.rewards) applyEffects(this.ctx, quest.rewards, { quest: questId });
    this.ctx.bus.emit('quest.completed', { quest: questId, title: quest.title, type: quest.type, series: quest.series });
    this.ctx.bus.emit('audio.sfx', { id: 'ping' });
  }

  fail(questId, reason = '') {
    if (!this.state.active[questId]) return;
    delete this.state.active[questId];
    this.state.failed.push(questId);
    this.ctx.store.touch('quests');
    this.ctx.bus.emit('quest.failed', { quest: questId, reason });
  }

  /** Aufbereitete Liste für das Questlog. */
  journal() {
    const out = { active: [], completed: [], available: [] };
    for (const [questId, progress] of Object.entries(this.state.active)) {
      const quest = this.ctx.registry.quest(questId);
      if (!quest) continue;
      out.active.push({
        id: questId,
        title: quest.title,
        type: quest.type,
        act: quest.act,
        layer: quest.layer,
        summary: quest.summary,
        series: quest.series,
        objectives: quest.objectives.map((o) => ({
          id: o.id,
          text: o.text,
          done: this.isObjectiveDone(quest, progress, o),
          count: progress.objectives[o.id] ?? 0,
          needed: o.count ?? 1
        }))
      });
    }
    out.completed = this.state.completed.map((id) => ({ id, title: this.ctx.registry.quest(id)?.title ?? id }));
    out.available = this.available()
      .filter((q) => !q.hidden)
      .map((q) => ({ id: q.id, title: q.title, type: q.type, summary: q.summary, blockedBy: explain(this.ctx.store.s, q.requires) }));
    return out;
  }
}

/** `where` prüft ausgewählte Felder der Ereignisdaten. */
export function matchWhere(where, payload) {
  if (!where) return true;
  for (const [key, expected] of Object.entries(where)) {
    if (key.endsWith('Max')) {
      const field = key.slice(0, -3);
      if (typeof expected === 'number' && (payload[field] ?? 0) > expected) return false;
      if (typeof expected === 'string' && !tierAtMost(payload[field], expected)) return false;
      continue;
    }
    const actual = payload[key] ?? payload?.meta?.[key];
    if (Array.isArray(expected)) { if (!expected.includes(actual)) return false; continue; }
    if (typeof expected === 'boolean') { if (Boolean(actual) !== expected) return false; continue; }
    if (actual !== expected) return false;
  }
  return true;
}

const TIER_ORDER = ['calm', 'annoyed', 'loud'];
function tierAtMost(actual, max) {
  const a = TIER_ORDER.indexOf(actual);
  const m = TIER_ORDER.indexOf(max);
  return a >= 0 && m >= 0 ? a <= m : true;
}
