/**
 * Der Mimonolog-Generator.
 *
 * Ein Mimonolog ist keine Textzeile, sondern eine Beat-Folge, die von einer
 * gewichteten Zustandsmaschine erzeugt wird:
 *
 *   OPENER -> RESTATEMENT -> FRAGE -> THEORIE -> [ABSCHWEIFUNG] ->
 *   [SELBSTKORREKTUR -> RÜCKKEHR] -> BELEG -> [ANSCHULDIGUNG] ->
 *   [ESKALATION] -> SCHLUSS
 *
 * Die Übergangsgewichte, die Templates und die Ehdzhusten-Regeln stehen
 * vollständig in data/vocabulary.json — hier steht nur die Mechanik.
 */

const BEAT_CONTEXTS = {
  OPENER: ['*bestaetigung'],
  RESTATEMENT: ['*bestaetigung', 'nachdenken'],
  QUESTION: [],
  THEORY: ['verschwoerung'],
  DIGRESSION: ['erinnerung'],
  SELF_CORRECTION: [],
  RETURN: ['*bestaetigung'],
  EVIDENCE: ['beleg', 'archiv'],
  ACCUSATION: ['konflikt', 'kopie'],
  ESCALATION: ['konflikt', 'ansage'],
  CLOSER: ['abschluss']
};

const INTENSITY_TIER = { ruhig: 'calm', normal: null, hoch: 'loud', maximum: 'loud' };

export class MimonologGenerator {
  /** @param {object} ctx { store, bus, registry, rng, meters, lexicon } */
  constructor(ctx) {
    this.ctx = ctx;
    this.vocab = ctx.registry.data.vocabulary;
    this.lexicon = ctx.lexicon;
  }

  /**
   * @param {object} options { topic, intensity, enemy, final }
   * @returns {{beats:Array,tier:string,topic:object,meta:object}}
   */
  generate(options = {}) {
    const { store, bus, rng, meters } = this.ctx;
    const topic = this.ctx.registry.topic(options.topic ?? 'allgemein');
    const tier = this.resolveTier(options.intensity);
    const flow = this.vocab.flow[tier];
    const crashout = store.stat('crashout');
    const skill = store.stat('mimonolog');

    const maxBeats = Math.max(3, Math.round(flow.maxBeats * (0.75 + skill / 200)));
    const digressionChance = clamp01(flow.digressionChance + skill / 400);
    const correctionChance = clamp01(flow.correctionChance);
    const accusationChance = clamp01(flow.accusationChance + store.stat('heeterAggro') / 300);

    const enemy = options.enemy ?? this.pickEnemy();
    const ehdz = this.vocab.ehdzhusten;

    this.lexicon.reset();
    bus.emit('monolog.started', { topic: topic, tier, intensity: options.intensity ?? 'auto' });

    const beats = [];
    let current = 'OPENER';
    let ehdzCount = 0;
    let lastEhdz = -99;
    let digressions = 0;
    let corrections = 0;
    let returnedTo = null;

    for (let i = 0; i < maxBeats; i++) {
      const text = this.renderBeat(current, tier, { topic, enemy, crashout });
      const beat = { type: current, text, tier };
      beats.push(beat);
      bus.emit('monolog.beat', beat);
      this.lexicon.tick();

      if (current === 'CLOSER') break;

      // Ehdzhusten schiebt sich zwischen die Beats — bewusst nicht jedes Mal.
      if (
        ehdzCount < ehdz.maxPerMonolog &&
        i - lastEhdz >= ehdz.minBeatsBetween &&
        ehdz.afterBeats.includes(current) &&
        rng.chance(ehdz.baseChance + crashout / 500)
      ) {
        const husten = { type: 'EHDZHUSTEN', text: rng.pick(ehdz.variants), sfx: ehdz.sfx };
        beats.push(husten);
        bus.emit('monolog.ehdzhusten', husten);
        bus.emit('audio.sfx', { id: ehdz.sfx });
        store.count('ehdzhusten');
        ehdzCount++;
        lastEhdz = i;
      }

      // Sonderübergänge vor der normalen Zustandsmaschine.
      const remaining = maxBeats - i;
      let next = null;
      if (current === 'DIGRESSION') {
        next = 'RETURN';
        returnedTo = topic.short;
      } else if (current === 'SELF_CORRECTION') {
        next = 'RETURN';
      } else if (remaining <= 2) {
        next = 'CLOSER';
      } else if (corrections === 0 && i >= 2 && rng.chance(correctionChance)) {
        next = 'SELF_CORRECTION';
        corrections++;
      } else if (digressions < 2 && i >= 1 && rng.chance(digressionChance)) {
        next = 'DIGRESSION';
        digressions++;
      } else if (enemy && i >= 2 && rng.chance(accusationChance) && current !== 'ACCUSATION') {
        next = 'ACCUSATION';
      }

      current = next ?? this.step(flow, current);
    }

    if (beats[beats.length - 1]?.type !== 'CLOSER') {
      const text = this.renderBeat('CLOSER', tier, { topic, enemy, crashout });
      beats.push({ type: 'CLOSER', text, tier });
    }

    // Verbindungswörter zwischen den Beats — Rhythmus statt Blocktext.
    for (const beat of beats) {
      if (beat.type === 'EHDZHUSTEN' || beat.type === 'CLOSER') continue;
      if (rng.chance(tier === 'loud' ? 0.3 : 0.18)) beat.text += ' ' + this.lexicon.connector(tier);
    }

    const meta = {
      beatCount: beats.length,
      ehdzhusten: ehdzCount,
      digressions,
      corrections,
      returnedTo,
      enemy,
      words: beats.reduce((n, b) => n + b.text.split(/\s+/).length, 0)
    };

    store.count('monologs');
    if (tier === 'calm') store.count('calmMonologs');
    store.addStat('mimonolog', 0.6, { min: 0, max: 100 });

    const result = { beats, tier, topic: { id: options.topic ?? 'allgemein', ...topic }, meta, final: Boolean(options.final) };
    bus.emit('monolog.finished', {
      topic: options.topic ?? 'allgemein',
      tier,
      final: Boolean(options.final),
      meta
    });
    if (meters?.crashoutTier.id === 'maximum') bus.emit('audio.sfx', { id: 'crashout' });
    return result;
  }

  /** Nächster Beat aus den Übergangsgewichten. */
  step(flow, from) {
    const transitions = flow.transitions[from];
    if (!transitions) return 'CLOSER';
    return this.ctx.rng.weightedKey(transitions) ?? 'CLOSER';
  }

  resolveTier(intensity) {
    const forced = INTENSITY_TIER[intensity];
    if (forced) return forced;
    return this.ctx.meters?.voiceTier ?? 'calm';
  }

  renderBeat(beatType, tier, context) {
    const templates = this.vocab.beats[beatType]?.[tier] ?? this.vocab.beats[beatType]?.calm ?? [''];
    // Denselben Satz nicht zweimal hintereinander - RETURN und THEORIE kommen oft mehrfach vor.
    const fresh = templates.length > 1 ? templates.filter((t) => t !== this.lastTemplate?.[beatType]) : templates;
    const template = this.ctx.rng.pick(fresh);
    (this.lastTemplate ??= {})[beatType] = template;
    return this.fill(template, beatType, context);
  }

  /** Slots füllen: {topic} {topicShort} {topicQ} {enemy} {v:id} {cp} */
  fill(template, beatType, { topic, enemy, crashout }) {
    const contexts = [...(topic.tags ?? []), ...(BEAT_CONTEXTS[beatType] ?? [])];
    return template
      .replace(/\{topicShort\}/g, topic.short)
      .replace(/\{topicQ\}/g, topic.question)
      .replace(/\{topic\}/g, topic.subject)
      .replace(/\{enemy\}/g, enemy ?? 'die Heeter')
      .replace(/\{v:([a-z_]+)(\|pl)?\}/g, (_, id, plural) => this.lexicon.term(id, contexts, plural ? 'pl' : 'sg'))
      .replace(/\{cp\}/g, () => this.lexicon.catchphrase(contexts, crashout));
  }

  /** Wer wird beschuldigt? Bevorzugt aktive Heeter, sonst bekannte Gegner. */
  pickEnemy() {
    const { store, registry, rng } = this.ctx;
    const active = Object.entries(store.s.heeters)
      .filter(([, h]) => (h.aggro ?? 0) > 0)
      .map(([id]) => id);
    const pool = active.length ? active : registry.data.emails.heeters.map((h) => h.id);
    const picked = rng.pick(pool);
    if (!picked) return null;
    const heeter = registry.heeters.get(picked);
    return heeter?.character ? registry.characterName(heeter.character) : (heeter?.name ?? picked);
  }

  /** Reiner Text — für CLI, Logs und Tests. */
  static toText(monolog) {
    return monolog.beats.map((b) => b.text).join('\n');
  }
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }
