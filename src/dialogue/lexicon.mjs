/**
 * Mimons Wortschatz mit Kontextbindung und Cooldown.
 *
 * Regel aus dem Content-Guide: Begriffe werden nicht gespammt. Ein Begriff
 * erscheint nur, wenn seine Kontext-Tags zum Thema passen, und ist danach
 * für `cooldown` Beats gesperrt. Dadurch entsteht Rhythmus statt Wortsalat.
 */
export class Lexicon {
  constructor(vocabulary, rng) {
    this.vocab = vocabulary;
    this.rng = rng;
    this.terms = vocabulary.lexicon;
    this.byId = new Map(this.terms.map((t) => [t.id, t]));
    this.cooldowns = new Map();
    this.usage = new Map();
  }

  /** Nach jedem Beat aufrufen: sperrt Begriffe ab und lässt sie wieder frei. */
  tick() {
    for (const [id, left] of this.cooldowns) {
      if (left <= 1) this.cooldowns.delete(id);
      else this.cooldowns.set(id, left - 1);
    }
  }

  available(term, contexts) {
    if (this.cooldowns.has(term.id)) return false;
    if (!contexts?.length) return true;
    return term.contexts.some((c) => contexts.includes(c));
  }

  /**
   * Begriff einsetzen. Es wird immer der angeforderte Begriff geliefert:
   * die Vorlage hat ihn aus grammatischen Gründen gewählt, und ein Tausch
   * ("mit meinen NWO gemacht") zerstört den Satz. Gegen Begriffs-Spam hilft
   * stattdessen die Vorlagenauswahl im Generator, die Vorlagen mit gerade
   * benutzten Begriffen zurückstellt.
   */
  term(id, contexts = [], form = 'sg') {
    const entry = this.byId.get(id);
    if (!entry) return id;
    return this.use(entry, 1, form);
  }

  /** Steht dieser Begriff gerade auf Cooldown? */
  isCoolingDown(id) { return this.cooldowns.has(id); }

  /** Passt der Begriff thematisch zu diesen Kontexten? */
  fitsContext(id, contexts = []) {
    const entry = this.byId.get(id);
    if (!entry || !contexts.length) return true;
    return entry.contexts.some((c) => contexts.includes(c));
  }

  /**
   * @param {'sg'|'pl'} form  Der Aufrufer kennt den Satzbau, nicht das Lexikon —
   *   deshalb entscheidet die Vorlage über den Numerus, nicht der Zufall.
   */
  use(term, cooldownFactor = 1, form = 'sg') {
    if (!term) return '';
    this.cooldowns.set(term.id, Math.round((term.cooldown ?? 3) * cooldownFactor));
    this.usage.set(term.id, (this.usage.get(term.id) ?? 0) + 1);
    return form === 'pl' && term.plural ? term.plural : term.term;
  }

  /**
   * Catchphrase passend zu Kontext und Crashout-Stufe.
   * Kontexte, die mit `*` beginnen, sind Klassen (z. B. `*bestaetigung`)
   * und passen unabhängig vom Thema.
   */
  catchphrase(contexts = [], crashout = 0) {
    const usable = this.vocab.catchphrases.filter((cp) => {
      if ((cp.minCrashout ?? 0) > crashout) return false;
      if (this.cooldowns.has(`cp:${cp.id}`)) return false;
      return cp.contexts.some((c) => c.startsWith('*') || contexts.includes(c));
    });
    const picked = this.rng.weighted(usable, (cp) => cp.weight ?? 1)
      ?? this.rng.weighted(this.vocab.catchphrases.filter((cp) => (cp.minCrashout ?? 0) <= crashout));
    if (!picked) return 'GENAU.';
    this.cooldowns.set(`cp:${picked.id}`, 4);
    this.usage.set(picked.id, (this.usage.get(picked.id) ?? 0) + 1);
    return picked.text;
  }

  connector(tier) {
    return this.rng.pick(this.vocab.connectors[tier] ?? this.vocab.connectors.calm);
  }

  reset() { this.cooldowns.clear(); }

  /** Für Tests und Balancing: wie oft wurde was benutzt? */
  report() { return Object.fromEntries(this.usage); }
}
