/**
 * Seedbarer RNG (Mulberry32). Der Cursor ist Teil des Savegames, damit
 * ein geladener Stand denselben Verlauf produziert wie vor dem Speichern.
 */
export class Rng {
  constructor(seed = Date.now() >>> 0, cursor = 0) {
    this.seed = seed >>> 0;
    this.cursor = cursor >>> 0;
    this.state = (this.seed + this.cursor * 0x6d2b79f5) >>> 0;
  }

  next() {
    this.cursor++;
    let t = (this.state += 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Ganzzahl in [min, max] inklusive. */
  int(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; }

  float(min = 0, max = 1) { return min + this.next() * (max - min); }

  chance(p) { return this.next() < p; }

  pick(list) { return list.length ? list[Math.floor(this.next() * list.length)] : undefined; }

  /**
   * Gewichtete Auswahl.
   * @param {Array} entries  Liste von Objekten
   * @param {(e:any)=>number} weightOf
   */
  weighted(entries, weightOf = (e) => e.weight ?? 1) {
    const usable = entries.filter((e) => weightOf(e) > 0);
    if (!usable.length) return undefined;
    const total = usable.reduce((sum, e) => sum + weightOf(e), 0);
    let roll = this.next() * total;
    for (const entry of usable) {
      roll -= weightOf(entry);
      if (roll <= 0) return entry;
    }
    return usable[usable.length - 1];
  }

  /** Gewichtete Auswahl über ein `{ key: weight }`-Objekt. */
  weightedKey(map) {
    const entries = Object.entries(map).map(([key, weight]) => ({ key, weight }));
    return this.weighted(entries)?.key;
  }

  shuffle(list) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /** Unabhängiger Strom, der den Hauptcursor nicht verbraucht. */
  fork(salt = 1) { return new Rng((this.seed ^ Math.imul(salt, 0x9e3779b9)) >>> 0, this.cursor); }

  snapshot() { return { seed: this.seed, cursor: this.cursor }; }

  static restore({ seed, cursor }) { return new Rng(seed, cursor); }
}
