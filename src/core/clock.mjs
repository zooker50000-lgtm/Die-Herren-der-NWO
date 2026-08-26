/** Spielzeit in Minuten. Jeder Vorlauf treibt Ticks und Tagesphasen. */

export const PHASES = [
  { id: 'nacht', label: 'Nacht', from: 0, to: 5 },
  { id: 'morgen', label: 'Morgen', from: 5, to: 11 },
  { id: 'tag', label: 'Tag', from: 11, to: 17 },
  { id: 'abend', label: 'Abend', from: 17, to: 22 },
  { id: 'nacht', label: 'Nacht', from: 22, to: 24 }
];

export class Clock {
  constructor(store, bus) {
    this.store = store;
    this.bus = bus;
  }

  get minutes() { return this.store.s.world.minutes; }
  get day() { return this.store.s.world.day; }

  get hour() { return Math.floor(this.minutes / 60) % 24; }

  get phase() {
    const h = this.hour;
    return PHASES.find((p) => h >= p.from && h < p.to)?.id ?? 'tag';
  }

  format() {
    const h = String(this.hour).padStart(2, '0');
    const m = String(this.minutes % 60).padStart(2, '0');
    return `Tag ${this.day}, ${h}:${m}`;
  }

  /** Zeit vorspulen. Feuert clock.tick je angefangener Stunde und clock.phase bei Wechsel. */
  advance(minutes) {
    if (minutes <= 0) return;
    const world = this.store.s.world;
    const phaseBefore = this.phase;

    for (let left = minutes; left > 0; ) {
      const step = Math.min(left, 60);
      world.minutes += step;
      left -= step;
      while (world.minutes >= 24 * 60) { world.minutes -= 24 * 60; world.day += 1; this.bus.emit('clock.day', { day: world.day }); }
      this.store.s.meta.playedMinutes += step;
      this.bus.emit('clock.tick', { minutes: step, total: world.minutes, day: world.day, phase: this.phase });
    }

    this.store.touch('world');
    const phaseAfter = this.phase;
    if (phaseAfter !== phaseBefore) this.bus.emit('clock.phase', { phase: phaseAfter, previous: phaseBefore });
  }
}
