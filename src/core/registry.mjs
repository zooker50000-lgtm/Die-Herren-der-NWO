/**
 * Nachschlagetabellen über die geladenen Daten.
 * Systeme greifen nie direkt auf rohe JSON-Arrays zu, sondern hierüber.
 */
export class Registry {
  constructor(data) {
    this.data = data;
    this.characters = index(data.characters.characters);
    this.items = index(data.items.items);
    this.quests = index(data.quests.quests);
    this.lore = index(data.lore.entries);
    this.acts = index(data.lore.acts);
    this.locations = index(data.locations.locations);
    this.events = index(data.events.events);
    this.factions = index(data.nwo.factions);
    this.series = index(data.series.series);
    this.recipes = index(data.alchemy.recipes);
    this.endings = index(data.endings.endings);
    this.achievements = index(data.endings.achievements);
    this.lexicon = index(data.vocabulary.lexicon);
    this.catchphrases = index(data.vocabulary.catchphrases);
    this.heeters = index(data.emails.heeters);
    this.mailPool = index(data.emails.pool);
    this.mailActions = index(data.emails.actions);
    this.nwoFiles = index(data.nwo.terminal.files);
    this.tagebuchSeiten = index(data.items.tagebuchSeiten);
    this.fideos = index(data.media.existing);
    this.dialogues = data.dialogue.dialogues;
    this.topics = data.vocabulary.topics;
    this.shops = data.locations.shops;
  }

  character(id) { return this.characters.get(id); }
  characterName(id) { return this.characters.get(id)?.name ?? id; }
  item(id) { return this.items.get(id); }
  itemName(id) { return this.items.get(id)?.name ?? id; }
  quest(id) { return this.quests.get(id); }
  loreTitle(id) { return this.lore.get(id)?.title ?? id; }
  achievementTitle(id) { return this.achievements.get(id)?.title ?? id; }
  location(id) { return this.locations.get(id); }
  dialogue(id) { return this.dialogues[id]; }
  topic(id) { return this.topics[id] ?? this.topics.allgemein; }

  /** Alle Figuren einer Fraktion. */
  charactersOfFaction(factionId) {
    return this.data.characters.characters.filter((c) => c.faction === factionId);
  }

  /** Serie zu einer Quest, falls die Quest eine Episode ist. */
  seriesOfQuest(questId) {
    const quest = this.quest(questId);
    return quest?.series ? this.series.get(quest.series) : undefined;
  }

  /** NWO-Influence-Stufe zu einem Wert. */
  influenceTier(value) {
    const tiers = this.data.nwo.influenceTiers;
    return tiers.find((t) => value >= t.min && value <= t.max) ?? tiers[0];
  }

  /** Alle Lore-Einträge eines Layers — für Kodex und Report. */
  loreByLayer(layer) {
    return this.data.lore.entries.filter((e) => e.layer === layer);
  }
}

function index(list) {
  const map = new Map();
  for (const entry of list ?? []) map.set(entry.id, entry);
  return map;
}
