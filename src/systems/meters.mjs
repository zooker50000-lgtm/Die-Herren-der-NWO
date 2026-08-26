/**
 * Die vier Meter: CRASHOUT, REAL-AUTHENTISCH, METT, NWO INFLUENCE.
 * Stufenwechsel werden als eigene Ereignisse gemeldet, damit UI, Musik
 * und NPC-Verhalten darauf reagieren können.
 */

export const CRASHOUT_TIERS = [
  { id: 'ruhig', label: 'RUHIG', min: 0, max: 19, voice: 'calm', music: null },
  { id: 'genervt', label: 'GENERVT', min: 20, max: 39, voice: 'annoyed', music: null },
  { id: 'mimonolog', label: 'MIMONOLOG', min: 40, max: 59, voice: 'annoyed', music: null },
  { id: 'ansage', label: 'ANSAGE', min: 60, max: 79, voice: 'loud', music: null },
  { id: 'massiv', label: 'MASSIVER CRASHOUT', min: 80, max: 94, voice: 'loud', music: 'mus_crashout' },
  { id: 'maximum', label: 'MAXIMUM CRASHOUT', min: 95, max: 100, voice: 'loud', music: 'mus_crashout' }
];

export const AUTHENTICITY_TIERS = [
  { id: 'feker', label: 'FEKER', min: 0, max: 19 },
  { id: 'verdaechtig', label: 'VERDÄCHTIG', min: 20, max: 39 },
  { id: 'normal', label: 'NORMAL', min: 40, max: 59 },
  { id: 'authentisch', label: 'AUTHENTISCH', min: 60, max: 79 },
  { id: 'real_authentisch', label: 'REAL-AUTHENTISCH', min: 80, max: 100 }
];

export function tierOf(tiers, value) {
  return tiers.find((t) => value >= t.min && value <= t.max) ?? tiers[0];
}

export class Meters {
  constructor(ctx) {
    this.ctx = ctx;
    this.store = ctx.store;
    this.bus = ctx.bus;
    this.registry = ctx.registry;
    this.lastTiers = {
      crashout: this.crashoutTier.id,
      authenticity: this.authenticityTier.id,
      nwo: this.influenceTier.id
    };
    this.wire();
  }

  get crashout() { return this.store.stat('crashout'); }
  get crashoutTier() { return tierOf(CRASHOUT_TIERS, this.crashout); }
  get authenticityTier() { return tierOf(AUTHENTICITY_TIERS, this.store.stat('authenticity')); }
  get influenceTier() { return this.registry.influenceTier(this.store.stat('nwoInfluence')); }

  /** Sprachstufe für den Mimonolog-Generator. */
  get voiceTier() { return this.crashoutTier.voice; }

  wire() {
    this.bus.on('crashout.changed', () => this.checkTier('crashout', this.crashoutTier));
    this.bus.on('authenticity.changed', () => this.checkTier('authenticity', this.authenticityTier));
    this.bus.on('nwo.influence', () => this.checkTier('nwo', this.influenceTier));
    this.bus.on('clock.tick', ({ minutes }) => this.decay(minutes));
  }

  checkTier(key, tier) {
    if (this.lastTiers[key] === tier.id) return;
    const previous = this.lastTiers[key];
    this.lastTiers[key] = tier.id;

    if (key === 'crashout') {
      this.bus.emit('crashout.tier', { tier: tier.id, label: tier.label, previous });
      if (tier.id === 'maximum') {
        this.store.count('crashoutsMaximum');
        this.store.addLog('MAXIMUM CRASHOUT.', 'crashout');
        this.bus.emit('crashout.maximum', { value: this.crashout });
        this.bus.emit('audio.sfx', { id: 'crashout' });
      }
    }
    if (key === 'authenticity') this.bus.emit('authenticity.tier', { tier: tier.id, label: tier.label, previous });
    if (key === 'nwo') {
      this.bus.emit('nwo.tier', { tier: tier.id, label: tier.label, previous });
      for (const unlock of tier.unlocks ?? []) {
        if (!this.store.s.unlocks.includes(unlock)) {
          this.store.s.unlocks.push(unlock);
          this.bus.emit('unlock.granted', { unlock });
        }
      }
      if (tier.milestone) {
        this.store.addLog('DIE NWO SIEHT ALLES.', 'nwo');
        this.bus.emit('nwo.sees_all', {});
        this.bus.emit('audio.sfx', { id: 'nwo_sting' });
      }
    }
  }

  /** Crashout fällt über Zeit, abhängig vom Ort und von der Gelassenheit. */
  decay(minutes) {
    const location = this.registry.location(this.store.s.player.location);
    const perHour = (location?.crashoutDecay ?? 1) + this.store.stat('crashoutResist') * 0.05;
    const amount = (perHour * minutes) / 60;
    if (amount > 0 && this.crashout > 0) this.store.addStat('crashout', -amount, { min: 0, max: 100 });
  }

  /** Überwachungsdruck aus Influence, Mett und Reichweite. */
  surveillancePressure() {
    const s = this.store.s.stats;
    const mettPressure = Math.min(100, (s.mett / 3000) * 100);
    const subPressure = Math.min(100, (s.subscribers / 50000) * 100);
    return s.nwoInfluence * 0.6 + mettPressure * 0.25 + subPressure * 0.15;
  }

  surveillanceLevel() {
    const value = this.surveillancePressure();
    const levels = this.registry.data.nwo.surveillance.levels;
    return [...levels].reverse().find((l) => value >= l.min) ?? levels[0];
  }

  snapshot() {
    const s = this.store.s.stats;
    return {
      authenticity: { value: Math.round(s.authenticity), tier: this.authenticityTier },
      crashout: { value: Math.round(s.crashout), tier: this.crashoutTier },
      mett: { value: Math.round(s.mett) },
      nwo: { value: Math.round(s.nwoInfluence), tier: this.influenceTier },
      subscribers: Math.round(s.subscribers),
      heeterAggro: Math.round(s.heeterAggro),
      surveillance: this.surveillanceLevel()
    };
  }
}
