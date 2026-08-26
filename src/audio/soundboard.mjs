/**
 * Soundboard. Alle Sounds werden zur Laufzeit per WebAudio synthetisiert —
 * das Repository enthält bewusst keine Binärassets. Sobald echte Samples
 * ergänzt werden, bleibt die Schnittstelle dieselbe (`play(id)`).
 *
 * In Node existiert kein AudioContext; dort ist das Soundboard eine
 * stille Attrappe, damit die Engine plattformgleich bleibt.
 */
export class Soundboard {
  constructor(ctx) {
    this.ctx = ctx;
    this.defs = new Map(ctx.registry.data.audio.sfx.map((s) => [s.id, s]));
    this.audio = null;
    this.enabled = true;
    this.volume = 0.7;
    this.currentMusic = null;
    ctx.bus.on('audio.sfx', ({ id }) => this.play(id));
  }

  get available() { return typeof globalThis.AudioContext !== 'undefined' || typeof globalThis.webkitAudioContext !== 'undefined'; }

  /** Muss aus einer Nutzeraktion heraus aufgerufen werden (Autoplay-Regeln). */
  unlock() {
    if (this.audio || !this.available) return;
    const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    this.audio = new AC();
  }

  play(id) {
    if (!this.enabled || !this.audio) return false;
    const def = this.defs.get(id);
    if (!def) return false;
    const now = this.audio.currentTime;
    const gain = this.audio.createGain();
    gain.gain.value = (def.gain ?? 0.2) * this.volume;
    gain.connect(this.audio.destination);

    switch (def.synth) {
      case 'noise_burst': this.noiseBurst(def, gain, now); break;
      case 'ring': this.ring(def, gain, now); break;
      case 'click_seq': this.clickSeq(def, gain, now); break;
      case 'hum': this.tone(def, gain, now, 'sawtooth'); break;
      case 'chime': this.chime(def, gain, now); break;
      case 'sting': this.sting(def, gain, now); break;
      case 'thud': this.tone(def, gain, now, 'sine'); break;
      case 'slide': this.slide(def, gain, now); break;
      case 'siren': this.siren(def, gain, now); break;
      default: this.chime(def, gain, now);
    }
    return true;
  }

  // --- Synthesebausteine ------------------------------------------------

  noiseBurst(def, out, now) {
    const length = Math.floor(this.audio.sampleRate * def.duration);
    const buffer = this.audio.createBuffer(1, length, this.audio.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      // Hüllkurve: schneller Anschlag, rauer Abfall — daher das Kratzige.
      const t = i / length;
      channel[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 1.7) * (t < 0.06 ? t / 0.06 : 1);
    }
    const source = this.audio.createBufferSource();
    source.buffer = buffer;
    const filter = this.audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = def.filter ?? 900;
    filter.Q.value = 1.4;
    source.connect(filter).connect(out);
    source.start(now);
  }

  ring(def, out, now) {
    const [a, b] = def.freq;
    for (let rep = 0; rep < 2; rep++) {
      const start = now + rep * 0.55;
      for (const freq of [a, b]) {
        const osc = this.audio.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const g = this.audio.createGain();
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(0.5, start + 0.02);
        g.gain.linearRampToValueAtTime(0, start + 0.4);
        osc.connect(g).connect(out);
        osc.start(start); osc.stop(start + 0.45);
      }
    }
  }

  clickSeq(def, out, now) {
    for (let i = 0; i < (def.count ?? 6); i++) {
      const t = now + i * (def.duration / (def.count ?? 6)) * (0.7 + Math.random() * 0.6);
      const osc = this.audio.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 1200 + Math.random() * 800;
      const g = this.audio.createGain();
      g.gain.setValueAtTime(0.4, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      osc.connect(g).connect(out);
      osc.start(t); osc.stop(t + 0.04);
    }
  }

  chime(def, out, now) {
    for (const [i, freq] of (def.freq ?? [880]).entries()) {
      const osc = this.audio.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const g = this.audio.createGain();
      const start = now + i * 0.07;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.6, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, start + def.duration);
      osc.connect(g).connect(out);
      osc.start(start); osc.stop(start + def.duration + 0.05);
    }
  }

  sting(def, out, now) {
    const [from, to] = def.freq;
    const osc = this.audio.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + def.duration);
    const filter = this.audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + def.duration);
    const g = this.audio.createGain();
    g.gain.setValueAtTime(0.7, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + def.duration);
    osc.connect(filter).connect(g).connect(out);
    osc.start(now); osc.stop(now + def.duration + 0.05);
  }

  tone(def, out, now, type) {
    const osc = this.audio.createOscillator();
    osc.type = type;
    osc.frequency.value = Array.isArray(def.freq) ? def.freq[0] : def.freq ?? 100;
    const g = this.audio.createGain();
    g.gain.setValueAtTime(0.5, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + def.duration);
    osc.connect(g).connect(out);
    osc.start(now); osc.stop(now + def.duration + 0.05);
  }

  slide(def, out, now) {
    const [from, to] = def.freq;
    const osc = this.audio.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.linearRampToValueAtTime(to, now + def.duration);
    const g = this.audio.createGain();
    g.gain.setValueAtTime(0.4, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + def.duration);
    osc.connect(g).connect(out);
    osc.start(now); osc.stop(now + def.duration + 0.05);
  }

  siren(def, out, now) {
    const [high, low] = def.freq;
    const osc = this.audio.createOscillator();
    osc.type = 'sine';
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      osc.frequency.setValueAtTime(i % 2 ? low : high, now + (i * def.duration) / steps);
    }
    const g = this.audio.createGain();
    g.gain.setValueAtTime(0.5, now);
    g.gain.setValueAtTime(0.5, now + def.duration - 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, now + def.duration);
    osc.connect(g).connect(out);
    osc.start(now); osc.stop(now + def.duration + 0.05);
  }

  // --- Musik ------------------------------------------------------------

  /** Welches Stück soll gerade laufen? Regeln stehen in data/audio.json. */
  currentTrack() {
    const rules = this.ctx.registry.data.audio.musicRules;
    const state = this.ctx.store.s;
    const tier = this.ctx.meters.crashoutTier.id;
    for (const rule of rules) {
      const w = rule.when;
      if (w.crashoutTier && !w.crashoutTier.includes(tier)) continue;
      if (w.location && !w.location.includes(state.player.location)) continue;
      if (w.act?.min != null && state.player.act < w.act.min) continue;
      return this.ctx.registry.data.audio.music.find((m) => m.id === rule.play);
    }
    return null;
  }

  syncMusic() {
    const track = this.currentTrack();
    if (track?.id === this.currentMusic) return null;
    this.currentMusic = track?.id ?? null;
    this.ctx.bus.emit('audio.music', { track: track?.id, mood: track?.mood, style: track?.style });
    return track;
  }
}
