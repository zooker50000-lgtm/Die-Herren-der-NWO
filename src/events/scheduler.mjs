/**
 * Dynamischer Ereignis-Scheduler.
 *
 * Bei jedem Zeittick wird gewürfelt, ob die Welt etwas tut. Die Gewichte
 * skalieren mit NWO-Einfluss, Mett, Crashout und Heeter-Aggro — je sichtbarer
 * Mimon ist, desto lebendiger (und unangenehmer) wird die Welt.
 */
import { meetsWithClock } from '../core/conditions.mjs';

export class EventScheduler {
  constructor(ctx) {
    this.ctx = ctx;
    this.data = ctx.registry.data.events;
    this.pending = null;
    this.baseChance = 0.22;
    this.ctx.bus.on('clock.tick', () => this.tick());
  }

  get hasPending() { return Boolean(this.pending); }

  tick() {
    if (this.pending) return;
    if (this.ctx.dialogue?.isOpen) return;

    const pressure = this.ctx.meters.surveillancePressure() / 100;
    const chance = this.baseChance + pressure * 0.25;
    if (!this.ctx.rng.chance(chance)) return;
    this.fire();
  }

  candidates() {
    const state = this.ctx.store.s;
    const now = state.world.day * 1440 + state.world.minutes;
    return this.data.events.filter((ev) => {
      const last = state.events.cooldowns[ev.id];
      if (last != null && now - last < (ev.cooldown ?? 60)) return false;
      if (ev.requires?.notLocation?.includes(state.player.location)) return false;
      return meetsWithClock(state, ev.requires, this.ctx.clock);
    });
  }

  weightOf(ev) {
    let weight = ev.weight ?? 1;
    for (const [key, factor] of Object.entries(ev.scale ?? {})) {
      const scaling = this.data.scaling[key];
      if (!scaling) continue;
      const value = this.ctx.store.stat(scaling.field) ?? 0;
      weight *= 1 + (value / scaling.max) * (factor - 1) * 2;
    }
    return weight;
  }

  /** Ein Ereignis auslösen. Ereignisse mit Auswahl warten auf den Spieler. */
  fire(forcedId = null) {
    const state = this.ctx.store.s;
    const event = forcedId
      ? this.ctx.registry.events.get(forcedId)
      : this.ctx.rng.weighted(this.candidates(), (e) => this.weightOf(e));
    if (!event) return null;

    state.events.cooldowns[event.id] = state.world.day * 1440 + state.world.minutes;
    state.events.lastId = event.id;
    this.ctx.store.touch('events');
    this.ctx.store.addLog(event.text, 'event');
    this.ctx.bus.emit('event.fired', { event: event.id, title: event.title, text: event.text, hasChoices: Boolean(event.choices) });

    if (event.effects) this.ctx.applyEffects(event.effects, { event: event.id });
    if (event.emits) this.ctx.bus.emit(event.emits, { event: event.id });

    if (event.choices?.length) {
      this.pending = event;
      return { event, needsChoice: true };
    }
    return { event, needsChoice: false };
  }

  /** Auf ein wartendes Ereignis reagieren. */
  respond(index) {
    if (!this.pending) return null;
    const event = this.pending;
    const choice = event.choices[index];
    this.pending = null;
    if (!choice) return null;

    this.ctx.applyEffects(choice.effects, { event: event.id, tone: choice.tone });
    this.ctx.bus.emit('event.resolved', { event: event.id, choice: index, tone: choice.tone });
    this.ctx.clock.advance(8);
    return { event, choice };
  }

  view() {
    if (!this.pending) return null;
    return {
      id: this.pending.id,
      title: this.pending.title,
      text: this.pending.text,
      layer: this.pending.layer,
      choices: this.pending.choices.map((c, index) => ({ index, text: c.text, tone: c.tone }))
    };
  }
}
