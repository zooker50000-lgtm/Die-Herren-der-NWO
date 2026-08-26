/**
 * Juhtub: Fideo-Produktion, Reichweite, Kommentare, Abonnenten.
 *
 * Die Parameter eines Fideos (Thema, Länge, Wut, Belege, NWO-Bezug) bestimmen
 * Reichweite und Folgen. Es gibt bewusst keine dominante Strategie:
 * viel Wut bringt Mett und kostet Ruf, viel Beleg bringt Ruf und wenig Mett.
 */
export class FideoSystem {
  constructor(ctx) {
    this.ctx = ctx;
    this.data = ctx.registry.data.media;
    this.wire();
  }

  wire() {
    this.ctx.bus.on('fideo.request_comment', ({ count }) => {
      for (let i = 0; i < count; i++) this.addComment();
    });
  }

  topics() { return this.data.fideoTopics; }
  lengths() { return this.data.lengths; }

  /**
   * @param {object} spec { title, topic, length, anger 0-100, evidence, nwoRelated }
   */
  publish(spec) {
    const { store, rng, bus } = this.ctx;
    const topic = this.data.fideoTopics.find((t) => t.id === spec.topic) ?? this.data.fideoTopics[0];
    const length = this.data.lengths.find((l) => l.id === spec.length) ?? this.data.lengths[1];
    const anger = clamp(spec.anger ?? store.stat('crashout'), 0, 100);
    const authenticity = store.stat('authenticity');
    const subscribers = store.stat('subscribers');

    const reach = Math.round(
      this.data.reachFormula.base *
      topic.mett * length.mett *
      (1 + anger / 120) *
      (0.7 + authenticity / 150) *
      (1 + subscribers / 50000) *
      rng.float(0.75, 1.3)
    );

    const mett = Math.round(reach / 22 * (spec.evidence ? 0.8 : 1.15));
    const authDelta = Math.round(
      (spec.evidence ? 6 : -1) +
      topic.authenticity * 10 -
      anger / 25 +
      (length.authenticity * 8)
    );
    const subDelta = Math.round(reach / 30 * (authDelta > 0 ? 1.2 : 0.8));

    const fideo = {
      id: `fideo_${store.s.media.published.length + 1}`,
      title: spec.title?.trim() || this.autoTitle(topic, anger),
      topic: topic.id,
      length: length.id,
      minutes: length.minutes,
      anger,
      evidence: Boolean(spec.evidence),
      nwoRelated: Boolean(spec.nwoRelated) || topic.id === 'nwo',
      reach,
      day: store.s.world.day,
      comments: []
    };

    store.s.media.published.push(fideo);
    store.count('fideosPublished');
    store.touch('media');

    this.ctx.applyEffects({
      mett,
      subscribers: subDelta,
      authenticity: authDelta,
      crashout: Math.round(anger / 12) - (spec.evidence ? 3 : 0),
      heeterAggro: Math.round(topic.risk * (anger / 20))
    }, { fideo: fideo.id });

    bus.emit('fideo.published', {
      id: fideo.id,
      title: fideo.title,
      topic: fideo.topic,
      anger,
      evidence: fideo.evidence,
      nwoRelated: fideo.nwoRelated,
      reach,
      mett,
      subscribers: subDelta
    });
    bus.emit('audio.sfx', { id: 'juhtub' });
    store.addLog(`Fideo veröffentlicht: ${fideo.title} (${reach.toLocaleString('de-DE')} Aufrufe)`, 'fideo');

    const commentCount = clamp(Math.round(reach / 3000), 1, 6);
    for (let i = 0; i < commentCount; i++) this.addComment(fideo);

    return { fideo, reach, mett, subscribers: subDelta, authenticity: authDelta };
  }

  autoTitle(topic, anger) {
    const { rng } = this.ctx;
    const loud = anger > 55;
    const patterns = loud
      ? ['ICH SAGE DAS JETZT EINMAL: {t}', '{t} — DIE WAHRHEIT', 'SO NICHT! {t}', 'AN ALLE HEETER: {t}']
      : ['Zu {t} — der komplette Zusammenhang', '{t}, ruhig erklärt', 'Was wirklich hinter {t} steckt', '{t}: Teil 1'];
    return rng.pick(patterns).replace('{t}', topic.label);
  }

  addComment(fideo) {
    const { store, rng, bus } = this.ctx;
    const target = fideo ?? store.s.media.published[store.s.media.published.length - 1];
    if (!target) return null;

    const pools = this.data.comments;
    const authenticity = store.stat('authenticity');
    const aggro = store.stat('heeterAggro');
    const nwo = store.stat('nwoInfluence');

    const kind = rng.weightedKey({
      positiv: 4 + authenticity / 12,
      negativ: 3 + aggro / 15,
      heeter: 2 + aggro / 10,
      nwo: nwo / 18,
      absurd: 2
    });

    const comment = {
      id: `c_${store.s.media.comments.length + 1}`,
      fideo: target.id,
      kind,
      text: rng.pick(pools[kind]),
      author: this.commentAuthor(kind),
      day: store.s.world.day
    };
    target.comments.push(comment.id);
    store.s.media.comments.push(comment);
    store.touch('media');
    bus.emit('fideo.comment', { fideo: target.id, kind, text: comment.text });
    return comment;
  }

  commentAuthor(kind) {
    const { rng, registry, store } = this.ctx;
    if (kind === 'heeter') {
      const active = Object.keys(store.s.heeters);
      const id = rng.pick(active.length ? active : registry.data.emails.heeters.map((h) => h.id));
      const heeter = registry.heeters.get(id);
      return heeter?.character ? registry.characterName(heeter.character) : id;
    }
    if (kind === 'nwo') return 'NWO Watch';
    return rng.pick(['zuschauer_88x', 'kanalgucker', 'hm_ok', 'berlin_nord', 'nachtschicht', 'jemand']);
  }

  /** Kommentare durchgehen — eigene Aktion, weil sie Quests auslöst. */
  analyzeComments() {
    const { store, bus } = this.ctx;
    const comments = store.s.media.comments.slice(-20);
    const summary = comments.reduce((acc, c) => { acc[c.kind] = (acc[c.kind] ?? 0) + 1; return acc; }, {});
    bus.emit('comments.analyzed', { count: comments.length, summary });
    store.addLog(`Kommentare durchgegangen: ${comments.length} Stück.`, 'fideo');
    return { comments, summary };
  }

  watch(fideoId) {
    const existing = this.ctx.registry.fideos.get(fideoId);
    const own = this.ctx.store.s.media.published.find((f) => f.id === fideoId);
    const fideo = existing ?? own;
    if (!fideo) return null;
    if (!this.ctx.store.s.media.watched.includes(fideoId)) {
      this.ctx.store.s.media.watched.push(fideoId);
      this.ctx.store.touch('media');
    }
    this.ctx.bus.emit('fideo.watched', { id: fideoId, uploader: existing?.uploader });
    return fideo;
  }

  library() {
    return [
      ...this.data.existing.map((f) => ({ ...f, own: f.uploader === 'mimon_baraka' })),
      ...this.ctx.store.s.media.published.map((f) => ({
        id: f.id, title: f.title, uploader: 'mimon_baraka', views: f.reach, own: true,
        description: `${f.minutes} Minuten, Thema: ${f.topic}`
      }))
    ];
  }
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
