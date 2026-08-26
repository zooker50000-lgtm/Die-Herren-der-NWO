/**
 * Inventar, Kleidung und das magische Tagebuch.
 * Getragene Stücke wirken passiv — die Lederjacke ist kein Kosmetikslot.
 */
export class Inventory {
  constructor(ctx) {
    this.ctx = ctx;
    this.ctx.bus.on('item.gained', ({ item }) => this.onGained(item));
  }

  list() {
    const store = this.ctx.store;
    return Object.entries(store.s.inventory).map(([id, count]) => {
      const item = this.ctx.registry.item(id) ?? { id, name: id, type: 'unbekannt' };
      return {
        ...item,
        count,
        worn: Object.values(store.s.player.outfit).includes(id),
        usable: item.type === 'consumable' || item.type === 'document'
      };
    });
  }

  onGained(itemId) {
    const item = this.ctx.registry.item(itemId);
    if (!item) return;
    this.ctx.store.addLog(`Erhalten: ${item.name}`, 'item');
    if (itemId === 'magisches_tagebuch') this.initTagebuch();
  }

  initTagebuch() {
    const pages = this.ctx.store.s.tagebuch.pages;
    if (pages.length) return;
    for (const page of this.ctx.registry.data.items.tagebuchSeiten) {
      if (page.found) this.addPage(page.id, { silent: true });
    }
  }

  addPage(pageId, { silent = false } = {}) {
    const pages = this.ctx.store.s.tagebuch.pages;
    if (pages.includes(pageId)) return false;
    const page = this.ctx.registry.tagebuchSeiten.get(pageId);
    if (!page) return false;
    pages.push(pageId);
    this.ctx.store.touch('tagebuch');
    this.ctx.bus.emit('tagebuch.page', { page: pageId, total: pages.length });
    if (!silent) {
      this.ctx.store.addLog(`Tagebuchseite gefunden: ${page.title}`, 'item');
      this.ctx.bus.emit('audio.sfx', { id: 'ping' });
    }
    if (pages.length >= this.ctx.registry.data.items.tagebuchSeiten.length) {
      this.ctx.bus.emit('achievement.request', { achievement: 'ach_archivar' });
    }
    return true;
  }

  /** Eine noch fehlende Seite ausgeben — für Fundorte in Welt und Quests. */
  grantRandomPage() {
    const all = this.ctx.registry.data.items.tagebuchSeiten;
    const missing = all.filter((p) => !this.ctx.store.s.tagebuch.pages.includes(p.id));
    const page = this.ctx.rng.pick(missing);
    return page ? (this.addPage(page.id) ? page : null) : null;
  }

  tagebuch() {
    const owned = this.ctx.store.s.tagebuch.pages;
    return this.ctx.registry.data.items.tagebuchSeiten.map((p) => ({
      id: p.id,
      title: p.title,
      layer: p.layer,
      found: owned.includes(p.id),
      text: owned.includes(p.id) ? p.text : null
    }));
  }

  use(itemId) {
    const item = this.ctx.registry.item(itemId);
    if (!item || !this.ctx.store.has(itemId)) return { ok: false, reason: 'Nicht im Inventar.' };

    if (item.type === 'consumable') {
      this.ctx.store.removeItem(itemId, 1);
      this.ctx.applyEffects(item.effects, { item: itemId });
      this.ctx.clock.advance(10);
      return { ok: true, item };
    }
    if (item.type === 'document') return this.ctx.alchemy.study(itemId) ?? { ok: false };
    if (item.type === 'wearable') return this.wear(itemId);
    return { ok: false, reason: 'Damit lässt sich hier nichts anfangen.' };
  }

  wear(itemId) {
    const item = this.ctx.registry.item(itemId);
    if (!item?.slot) return { ok: false, reason: 'Nichts zum Anziehen.' };
    const outfit = this.ctx.store.s.player.outfit;
    const previous = outfit[item.slot];
    if (previous === itemId) return { ok: true, item, alreadyWorn: true };
    if (previous) this.removePassive(previous);
    outfit[item.slot] = itemId;
    this.applyPassive(itemId);
    this.ctx.store.touch('player');
    this.ctx.bus.emit('outfit.changed', { slot: item.slot, item: itemId });
    return { ok: true, item };
  }

  applyPassive(itemId) {
    const item = this.ctx.registry.item(itemId);
    for (const [key, value] of Object.entries(item?.effects ?? {})) {
      if (typeof value === 'number') this.ctx.store.addStat(key, value);
    }
  }

  removePassive(itemId) {
    const item = this.ctx.registry.item(itemId);
    for (const [key, value] of Object.entries(item?.effects ?? {})) {
      if (typeof value === 'number') this.ctx.store.addStat(key, -value);
    }
  }

  outfit() {
    const outfit = this.ctx.store.s.player.outfit;
    return Object.fromEntries(Object.entries(outfit).map(([slot, id]) => [slot, id ? this.ctx.registry.item(id) : null]));
  }
}
