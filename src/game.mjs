/**
 * Kompositionswurzel.
 *
 * Baut alle Systeme, verdrahtet sie über den Bus und öffnet eine schmale
 * API für die Clients. Die Engine selbst kennt weder DOM noch Konsole —
 * `web/` und `src/cli/` benutzen dieselbe Instanz auf zwei Arten.
 */
import { Bus } from './core/bus.mjs';
import { Rng } from './core/rng.mjs';
import { Store, createInitialState } from './core/state.mjs';
import { Clock } from './core/clock.mjs';
import { Registry } from './core/registry.mjs';
import { applyEffects } from './core/effects.mjs';
import { loadData } from './data/loader.mjs';

import { Meters } from './systems/meters.mjs';
import { Progression } from './systems/progression.mjs';
import { Lexicon } from './dialogue/lexicon.mjs';
import { MimonologGenerator } from './dialogue/mimonolog.mjs';
import { DialogueEngine } from './dialogue/engine.mjs';
import { QuestEngine } from './quests/engine.mjs';
import { NwoSystem } from './nwo/index.mjs';
import { EmailSystem } from './emails/index.mjs';
import { FideoSystem } from './youtube/fideos.mjs';
import { AlchemySystem } from './alchemy/index.mjs';
import { World } from './world/index.mjs';
import { EventScheduler } from './events/scheduler.mjs';
import { Inventory } from './inventory/index.mjs';
import { Codex } from './lore/codex.mjs';
import { Roster } from './characters/roster.mjs';
import { SaveSystem } from './save/index.mjs';
import { Soundboard } from './audio/soundboard.mjs';

export class Game {
  constructor(data, { seed = Date.now() >>> 0, state = null, storage } = {}) {
    this.data = data;
    this.bus = new Bus();
    this.rng = new Rng(seed);
    this.registry = new Registry(data);
    this.store = new Store(state ?? createInitialState(seed), this.bus);
    this.clock = new Clock(this.store, this.bus);

    // Kontext, den alle Systeme teilen. Systeme greifen nur hierüber zu.
    const ctx = this;
    this.applyEffects = (effects, source) => applyEffects(ctx, effects, source);

    this.meters = new Meters(this);
    this.lexicon = new Lexicon(data.vocabulary, this.rng);
    this.monolog = new MimonologGenerator(this);
    this.dialogue = new DialogueEngine(this);
    this.quests = new QuestEngine(this);
    this.nwo = new NwoSystem(this);
    this.emails = new EmailSystem(this);
    this.fideos = new FideoSystem(this);
    this.alchemy = new AlchemySystem(this);
    this.world = new World(this);
    this.events = new EventScheduler(this);
    this.inventory = new Inventory(this);
    this.codex = new Codex(this);
    this.roster = new Roster(this);
    this.progression = new Progression(this);
    this.save = new SaveSystem(this, storage);
    this.audio = new Soundboard(this);

    this.wire();
  }

  static async create(options = {}) {
    const data = options.data ?? await loadData(options.dataOptions);
    return new Game(data, options);
  }

  wire() {
    // Monolog-Anforderungen aus Effekten laufen zentral hier zusammen.
    this.bus.on('monolog.request', (spec) => { this.lastMonolog = this.monolog.generate(spec); });
    this.bus.on('achievement.request', ({ achievement }) => this.applyEffects({ achievements: [achievement] }));

    // Ehdzhusten-Achievement
    this.bus.on('monolog.ehdzhusten', () => {
      if (this.store.s.counters.ehdzhusten >= 50) this.applyEffects({ achievements: ['ach_ehdzhusten'] });
    });
    this.bus.on('monolog.finished', ({ tier }) => {
      if (tier === 'calm' && this.store.s.counters.calmMonologs >= 10) this.applyEffects({ achievements: ['ach_ruhig'] });
    });

    // Die NWO stellt zu, sobald der Einfluss reicht.
    this.bus.on('nwo.tier', () => this.emails.deliverNwoMail());
    this.bus.on('clock.day', () => this.emails.deliverNwoMail());

    // Kelchninja-Sichtungen zählen für die versteckte Quest.
    this.bus.on('easteregg.kelchninja', () => this.store.count('kelchninjaSightings'));

    // Musikwechsel an Ort und Stimmung koppeln.
    this.bus.on('world.travel', () => this.audio.syncMusic());
    this.bus.on('crashout.tier', () => this.audio.syncMusic());
    this.bus.on('act.changed', () => this.audio.syncMusic());
  }

  /** Neues Spiel starten. */
  start() {
    this.store.s.meta.createdAt ??= new Date().toISOString();
    this.roster.seed();
    this.inventory.initTagebuch();
    for (const item of ['magisches_tagebuch', 'juhtub_kamera', 'lederjacke', 'jeans', 'alchemiebuch_i', 'basketball']) {
      if (!this.store.has(item)) this.store.addItem(item, 1);
    }
    this.inventory.applyPassive('lederjacke');
    this.inventory.applyPassive('jeans');

    this.codex.unlockByProgress();
    this.quests.start('der_erste_heeter');
    this.quests.autoStart();
    this.emails.spawn('hm_001');
    this.save.enableAutosave();
    this.audio.syncMusic();

    this.store.addLog('Der Rechner läuft. Das Fenster ist zu. Draußen steht ein Fahrzeug.', 'system');
    this.bus.emit('game.started', { act: this.store.s.player.act, seed: this.rng.seed });
    return this;
  }

  /** Nach dem Laden eines Archivs: Systeme wieder in Takt bringen. */
  resume() {
    this.roster.seed();
    this.codex.unlockByProgress();
    this.meters.lastTiers = {
      crashout: this.meters.crashoutTier.id,
      authenticity: this.meters.authenticityTier.id,
      nwo: this.meters.influenceTier.id
    };
    this.audio.syncMusic();
    this.bus.emit('game.resumed', { act: this.store.s.player.act });
    return this;
  }

  /** Der letzte Mimonolog — schließt das Spiel ab. */
  finalMonolog() {
    const monolog = this.monolog.generate({ topic: 'allgemein', final: true, intensity: this.meters.crashout >= 95 ? 'maximum' : undefined });
    const ending = this.progression.resolveEnding();
    return { monolog, ending };
  }

  /** Kompakter Zustand für HUD und CLI. */
  snapshot() {
    const s = this.store.s;
    const location = this.world.here;
    return {
      time: this.clock.format(),
      phase: this.clock.phase,
      act: this.progression.actInfo(),
      location: { id: location?.id, name: location?.name, description: location?.description, region: location?.region },
      labArea: s.player.labArea,
      meters: this.meters.snapshot(),
      unread: this.emails.unreadCount(),
      quests: Object.keys(s.quests.active).length,
      lore: this.codex.stats(),
      alchemy: { level: s.stats.alchemy, xp: s.stats.alchemyXp, next: this.alchemy.xpForLevel(s.stats.alchemy) },
      tagebuch: `${s.tagebuch.pages.length}/${this.registry.data.items.tagebuchSeiten.length}`,
      ending: s.ending,
      pendingEvent: this.events.view()
    };
  }
}

export { MimonologGenerator };
