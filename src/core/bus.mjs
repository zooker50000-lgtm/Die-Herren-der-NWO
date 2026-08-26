/**
 * Event-Bus mit Wildcard-Unterstützung.
 * Systeme reden nie direkt miteinander — sie feuern und lauschen.
 */
export class Bus {
  constructor({ historySize = 200 } = {}) {
    this.listeners = new Map();
    this.history = [];
    this.historySize = historySize;
  }

  /** @returns {() => void} Abmeldefunktion */
  on(pattern, handler) {
    if (!this.listeners.has(pattern)) this.listeners.set(pattern, new Set());
    this.listeners.get(pattern).add(handler);
    return () => this.off(pattern, handler);
  }

  once(pattern, handler) {
    const off = this.on(pattern, (...args) => { off(); handler(...args); });
    return off;
  }

  off(pattern, handler) {
    const set = this.listeners.get(pattern);
    if (set) { set.delete(handler); if (!set.size) this.listeners.delete(pattern); }
  }

  emit(type, payload = {}) {
    const event = { type, payload, at: Date.now() };
    this.history.push(event);
    if (this.history.length > this.historySize) this.history.shift();

    for (const [pattern, handlers] of this.listeners) {
      if (!matches(pattern, type)) continue;
      for (const handler of [...handlers]) {
        try {
          handler(payload, type);
        } catch (err) {
          // Ein defekter Listener darf den Spielfluss nicht anhalten.
          this.emit__error(type, pattern, err);
        }
      }
    }
    return event;
  }

  emit__error(type, pattern, err) {
    const set = this.listeners.get('bus.error');
    if (!set) return;
    for (const handler of set) handler({ type, pattern, error: err }, 'bus.error');
  }

  /** Letzte Ereignisse, optional nach Muster gefiltert. */
  recent(pattern = '*', limit = 20) {
    const out = [];
    for (let i = this.history.length - 1; i >= 0 && out.length < limit; i--) {
      if (matches(pattern, this.history[i].type)) out.push(this.history[i]);
    }
    return out;
  }

  clear() { this.listeners.clear(); this.history.length = 0; }
}

/** `quest.*` trifft `quest.started`; `*` trifft alles. */
export function matches(pattern, type) {
  if (pattern === '*' || pattern === type) return true;
  if (pattern.endsWith('.*')) return type.startsWith(pattern.slice(0, -1));
  return false;
}
