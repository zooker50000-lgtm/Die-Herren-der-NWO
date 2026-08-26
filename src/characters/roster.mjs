import { meets } from '../core/conditions.mjs';

/** Ueber welche Kanaele laeuft dieser Dialog? */
export function channelsOf(dialogue) {
  return dialogue.channels ?? [dialogue.channel ?? 'vor_ort'];
}

/**
 * Figurenverwaltung: Vertrauen, Verfügbarkeit, Beziehungsübersicht — und die
 * Vermittlung, welches Gespräch eine Figur gerade führt.
 */
export class Roster {
  constructor(ctx) { this.ctx = ctx; }

  /**
   * Der passende Dialog einer Figur: der mit der höchsten Priorität, dessen
   * Voraussetzungen erfüllt sind und der nicht schon geführt wurde.
   * Ohne diese Vermittlung wäre immer nur das erste Gespräch einer Figur
   * erreichbar — alle späteren Szenen blieben tot.
   */
  dialogueFor(npcId, { channel } = {}) {
    const played = this.ctx.store.s.dialogue?.played ?? [];
    const candidates = Object.entries(this.ctx.registry.dialogues)
      .filter(([id, dlg]) => {
        if (dlg.npc !== npcId) return false;
        if (channel && !channelsOf(dlg).includes(channel)) return false;
        if (!dlg.repeatable && played.includes(id)) return false;
        return meets(this.ctx.store.s, dlg.requires);
      })
      .sort((a, b) => (b[1].priority ?? 0) - (a[1].priority ?? 0));
    return candidates[0]?.[0] ?? null;
  }

  /** Alle Figuren, die über diesen Kanal gerade ansprechbar sind. */
  reachableVia(channel) {
    return this.ctx.registry.data.characters.characters
      .filter((c) => c.role !== 'player' && this.available(c) && this.dialogueFor(c.id, { channel }))
      .map((c) => ({ id: c.id, name: c.name, color: c.color, trust: this.ctx.store.trust(c.id, c.trust ?? 50) }));
  }

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
