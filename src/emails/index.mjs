/**
 * Heet-Mehl-System.
 *
 * Nachrichten kommen aus dem kuratierten Pool, solange dort etwas passt;
 * danach erzeugen die Heeter-Templates prozedural weiter. Jede Nachricht
 * kennt dieselben fünf Reaktionen — und keine davon ist immer richtig.
 */
export class EmailSystem {
  constructor(ctx) {
    this.ctx = ctx;
    this.data = ctx.registry.data.emails;
    this.wire();
  }

  get inbox() { return this.ctx.store.s.emails.inbox; }

  wire() {
    const { bus } = this.ctx;
    bus.on('email.request_spawn', ({ spec }) => this.spawn(spec));
    bus.on('heeter.request_spawn', ({ count }) => { for (let i = 0; i < count; i++) this.spawnHeeter(); });
    // Reichweite zieht Post nach sich.
    bus.on('fideo.published', ({ reach }) => {
      const rolls = Math.min(3, Math.floor(reach / 9000));
      for (let i = 0; i < rolls; i++) if (this.ctx.rng.chance(0.7)) this.spawn('auto');
    });
  }

  /** Neue Nachricht zustellen. spec: 'auto' | 'heet_mehl_pool:<heeterId>' | poolId */
  spawn(spec = 'auto') {
    const state = this.ctx.store.s;
    let mail = null;

    if (typeof spec === 'string' && spec.startsWith('heet_mehl_pool:')) {
      const from = spec.split(':')[1];
      mail = this.fromPool((m) => m.from === from);
    } else if (spec !== 'auto' && this.ctx.registry.mailPool.get(spec)) {
      mail = this.materialize(this.ctx.registry.mailPool.get(spec));
    } else if (spec !== 'auto') {
      // Auch NWO-Mail lässt sich gezielt zustellen — eine Quest, die auf eine
      // bestimmte Nachricht wartet, darf nicht daran scheitern, dass die
      // Nachricht vorher schon abgearbeitet wurde.
      const nwoMail = this.data.nwoMail.find((m) => m.id === spec);
      if (nwoMail) mail = this.materialize({ ...nwoMail, channel: 'nwo' });
    }

    if (!mail) mail = this.fromPool() ?? this.procedural();
    if (!mail) return null;

    state.emails.inbox.push(mail);
    this.ctx.store.touch('emails');
    this.ctx.bus.emit('email.received', { id: mail.id, from: mail.from, subject: mail.subject, channel: mail.channel });
    this.ctx.bus.emit('audio.sfx', { id: 'notification' });
    return mail;
  }

  /** NWO-Mail zustellen, sobald der Einfluss reicht. */
  deliverNwoMail() {
    const pending = this.ctx.nwo.pendingMail();
    for (const template of pending) {
      const mail = this.materialize({ ...template, channel: 'nwo' });
      this.inbox.push(mail);
      this.ctx.bus.emit('email.received', { id: mail.id, from: mail.from, subject: mail.subject, channel: 'nwo' });
    }
    if (pending.length) this.ctx.store.touch('emails');
    return pending.length;
  }

  fromPool(filter = () => true) {
    const state = this.ctx.store.s;
    const act = state.player.act;
    const candidates = this.data.pool.filter((m) =>
      filter(m) &&
      (m.act ?? 1) <= act &&
      !state.emails.handled.includes(m.id) &&
      !this.inbox.some((e) => e.templateId === m.id)
    );
    const picked = this.ctx.rng.pick(candidates);
    return picked ? this.materialize(picked) : null;
  }

  /** Prozedurale Nachricht aus den Taktik-Vorlagen eines Heeters. */
  procedural() {
    const state = this.ctx.store.s;
    const active = Object.keys(state.heeters);
    const heeterId = this.ctx.rng.pick(active.length ? active : this.data.heeters.map((h) => h.id));
    const heeter = this.ctx.registry.heeters.get(heeterId);
    if (!heeter) return null;
    const templates = this.data.templates[heeter.tactic] ?? [];
    const template = this.ctx.rng.pick(templates);
    if (!template) return null;

    const lastFideo = state.media.published[state.media.published.length - 1];
    const body = template
      .replace(/\{mimon\}/g, 'mimon')
      .replace(/\{fideo\}/g, lastFideo?.title ?? 'dein letztes fideo')
      .replace(/\{zahl\}/g, String(this.ctx.rng.int(3, 91)))
      .replace(/\{thema\}/g, this.ctx.rng.pick(['der nwo', 'den heetern', 'der alchemie', 'minute 31', 'dem fahrzeug']));

    return this.materialize({
      id: null,
      from: heeterId,
      subject: this.ctx.rng.pick(['(kein Betreff)', 're:', 'kurz was', 'frage', '?']),
      body,
      layer: 'FICTIONAL_GAME_CONTENT',
      procedural: true
    });
  }

  materialize(template) {
    const state = this.ctx.store.s;
    const id = `mail_${state.emails.nextId++}`;
    const heeter = this.ctx.registry.heeters.get(template.from);
    const fromName = heeter?.character
      ? this.ctx.registry.characterName(heeter.character)
      : (heeter?.name ?? template.from);
    return {
      id,
      templateId: template.id ?? null,
      from: template.from,
      fromName,
      subject: template.subject,
      body: template.body,
      channel: template.channel ?? 'heet_mehl',
      layer: template.layer,
      bait: Boolean(template.bait),
      apology: Boolean(template.apology),
      policeWorthy: Boolean(template.policeWorthy),
      triggers: template.triggers ?? null,
      effects: template.effects ?? null,
      read: false,
      day: state.world.day
    };
  }

  read(mailId) {
    const mail = this.inbox.find((m) => m.id === mailId);
    if (!mail || mail.read) return mail ?? null;
    mail.read = true;
    this.ctx.store.touch('emails');
    if (mail.triggers) this.ctx.applyEffects(mail.triggers, { email: mailId });
    if (mail.effects) this.ctx.applyEffects(mail.effects, { email: mailId });
    this.ctx.bus.emit('email.read', {
      id: mailId,
      from: mail.from,
      channel: mail.channel,
      bait: mail.bait
    });
    return mail;
  }

  /** Eine der fünf Reaktionen ausführen. */
  handle(mailId, actionId) {
    const index = this.inbox.findIndex((m) => m.id === mailId);
    if (index < 0) return null;
    const mail = this.inbox[index];
    const action = this.ctx.registry.mailActions.get(actionId);
    if (!action) return null;

    let effects = { ...action.effects };
    // Einen Köder zu ignorieren ist die einzige Antwort, die ihn kleiner macht.
    if (mail.bait && actionId === 'ignorieren') effects = { ...effects, authenticity: 6, heeterAggro: -8 };
    if (mail.bait && actionId === 'antworten') effects = { ...effects, crashout: 12, heeterAggro: 12 };
    if (mail.apology && actionId === 'vorlesen') effects = { ...effects, authenticity: -8 };
    if (mail.policeWorthy && actionId === 'polizei') effects = { ...effects, authenticity: 6, trust: { kommissarin_devrim: 8 } };

    this.ctx.applyEffects(effects, { email: mailId, action: actionId });
    this.adjustHeeter(mail.from, actionId);

    this.inbox.splice(index, 1);
    if (mail.templateId) this.ctx.store.s.emails.handled.push(mail.templateId);
    this.ctx.store.count('emailsHandled');
    this.ctx.store.touch('emails');
    this.ctx.bus.emit('email.handled', { id: mailId, from: mail.from, action: actionId, channel: mail.channel });
    return { mail, action };
  }

  adjustHeeter(heeterId, actionId) {
    const state = this.ctx.store.s;
    if (!this.ctx.registry.heeters.get(heeterId)) return;
    const entry = state.heeters[heeterId] ?? (state.heeters[heeterId] = {
      aggro: this.ctx.registry.heeters.get(heeterId).aggro ?? 20,
      exposed: false,
      contacts: 0
    });
    entry.contacts++;
    const delta = { ignorieren: -3, antworten: 6, vorlesen: 12, polizei: -6, nwo: 2 }[actionId] ?? 0;
    entry.aggro = Math.max(0, Math.min(100, entry.aggro + delta));
    this.ctx.store.addStat('heeterAggro', delta * 0.4, { min: 0, max: 100 });
    this.ctx.store.touch('heeters');
  }

  spawnHeeter() {
    const state = this.ctx.store.s;
    const act = state.player.act;
    const candidates = this.data.heeters.filter((h) => {
      const character = h.character ? this.ctx.registry.character(h.character) : null;
      const unlockAct = character?.unlock?.startsWith('akt_') ? Number(character.unlock.slice(4)) : 1;
      return unlockAct <= act && !state.heeters[h.id];
    });
    const picked = this.ctx.rng.pick(candidates);
    if (!picked) {
      // Alle bekannt: stattdessen wird jemand lauter.
      const existing = this.ctx.rng.pick(Object.keys(state.heeters));
      if (existing) {
        state.heeters[existing].aggro = Math.min(100, state.heeters[existing].aggro + 10);
        this.ctx.store.touch('heeters');
      }
      return null;
    }
    state.heeters[picked.id] = { aggro: picked.aggro, exposed: false, contacts: 0 };
    this.ctx.store.touch('heeters');
    this.ctx.store.addLog(`Ein neuer Heeter: ${picked.character ? this.ctx.registry.characterName(picked.character) : picked.id}`, 'heeter');
    this.ctx.bus.emit('heeter.spawned', { heeter: picked.id });
    return picked;
  }

  actions() { return this.data.actions; }
  unreadCount() { return this.inbox.filter((m) => !m.read).length; }
}
