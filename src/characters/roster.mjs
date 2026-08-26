/** Figurenverwaltung: Vertrauen, Verfügbarkeit, Beziehungsübersicht. */
export class Roster {
  constructor(ctx) { this.ctx = ctx; }

  /** Startvertrauen aus den Daten übernehmen. */
  seed() {
    for (const character of this.ctx.registry.data.characters.characters) {
      if (this.ctx.store.s.trust[character.id] == null) {
        this.ctx.store.s.trust[character.id] = character.trust ?? 50;
      }
    }
    this.ctx.store.touch('trust');
  }

  available(character) {
    if (character.available) return true;
    const store = this.ctx.store;
    const u = character.unlock;
    if (!u) return true;
    if (u.startsWith('akt_')) return store.s.player.act >= Number(u.slice(4));
    return store.flag(u) || store.s.unlocks.includes(u);
  }

  view() {
    return this.ctx.registry.data.characters.characters
      .filter((c) => c.role !== 'player')
      .map((c) => ({
        id: c.id,
        name: c.name,
        aliases: c.aliases ?? [],
        role: c.role,
        faction: c.faction,
        factionName: this.ctx.registry.factions.get(c.faction)?.name ?? c.faction,
        color: c.color,
        layer: c.layer,
        known: this.available(c),
        trust: this.ctx.store.trust(c.id, c.trust ?? 50),
        bio: this.available(c) ? c.bio : null,
        traits: this.available(c) ? c.traits ?? [] : []
      }));
  }

  /** Sprachprofil einer Figur — die UI färbt Zeilen danach ein. */
  voice(characterId) {
    return this.ctx.registry.character(characterId)?.voice ?? null;
  }

  /** Wie spricht diese Figur Mimon an? */
  addressFor(characterId) {
    return this.voice(characterId)?.addressesMimon ?? 'Mimon';
  }
}
