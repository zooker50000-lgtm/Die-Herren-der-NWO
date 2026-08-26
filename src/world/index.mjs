/**
 * Open World: Ortsgraph, Reisen, Interaktionen — und das Fenster.
 * Reisen kostet Zeit, Zeit treibt Ereignisse. Deshalb ist jeder Weg
 * durch die Stadt eine Gelegenheit für die Welt, etwas zu tun.
 */
import { meets, meetsWithClock } from '../core/conditions.mjs';

const TRAVEL_MINUTES = { sameRegion: 18, otherRegion: 95, inside: 4 };

export class World {
  constructor(ctx) {
    this.ctx = ctx;
    this.data = ctx.registry.data.locations;
  }

  get here() { return this.ctx.registry.location(this.ctx.store.s.player.location); }

  unlocked(location) {
    if (!location) return false;
    if (!location.unlock || location.unlock === 'start') return true;
    const store = this.ctx.store;
    if (store.s.unlocks.includes(location.unlock)) return true;
    if (store.flag(location.unlock)) return true;
    if (location.unlock.startsWith('akt_')) return store.s.player.act >= Number(location.unlock.slice(4));
    return store.s.quests.completed.includes(location.unlock);
  }

  /** Erreichbare Nachbarorte. */
  exits() {
    const here = this.here;
    if (!here) return [];
    return (here.connections ?? [])
      .map((id) => this.ctx.registry.location(id))
      .filter(Boolean)
      .map((loc) => ({
        id: loc.id,
        name: loc.name,
        region: loc.region,
        unlocked: this.unlocked(loc),
        minutes: this.travelTime(here, loc)
      }));
  }

  travelTime(from, to) {
    if (from.region !== to.region) return TRAVEL_MINUTES.otherRegion;
    if (from.safehouse && to.connections?.includes(from.id) && to.region === from.region && to.id === 'mamer_bereich') return TRAVEL_MINUTES.inside;
    return TRAVEL_MINUTES.sameRegion;
  }

  travel(locationId) {
    const target = this.ctx.registry.location(locationId);
    const here = this.here;
    if (!target) return { ok: false, reason: 'Diesen Ort gibt es nicht.' };
    if (!here.connections?.includes(locationId)) return { ok: false, reason: 'Von hier führt kein Weg dorthin.' };
    if (!this.unlocked(target)) return { ok: false, reason: 'Der Ort ist noch verschlossen.' };

    const minutes = this.travelTime(here, target);
    this.ctx.store.s.player.location = locationId;
    this.ctx.store.s.player.labArea = null;
    if (!this.ctx.store.s.world.visited.includes(locationId)) this.ctx.store.s.world.visited.push(locationId);
    this.ctx.store.touch('world');
    this.ctx.bus.emit('world.travel', { from: here.id, to: locationId, minutes });
    this.ctx.bus.emit('audio.sfx', { id: 'steps' });
    this.ctx.clock.advance(minutes);
    return { ok: true, location: target, minutes };
  }

  /** NPCs, die hier gerade ansprechbar sind. */
  npcsHere() {
    const here = this.here;
    return (here?.npcs ?? [])
      .map((id) => this.ctx.registry.character(id))
      .filter((c) => c && (c.available || this.characterUnlocked(c)));
  }

  characterUnlocked(character) {
    if (!character.unlock) return true;
    const store = this.ctx.store;
    if (character.unlock.startsWith('akt_')) return store.s.player.act >= Number(character.unlock.slice(4));
    return store.flag(character.unlock) || store.s.unlocks.includes(character.unlock);
  }

  /** Interaktionen am aktuellen Ort, gefiltert nach Voraussetzungen. */
  interactables() {
    const here = this.here;
    return (here?.interactables ?? [])
      .filter((it) => meetsWithClock(this.ctx.store.s, it.requires, this.ctx.clock))
      .map((it) => ({ ...it }));
  }

  interact(interactableId) {
    const here = this.here;
    const target = (here?.interactables ?? []).find((i) => i.id === interactableId);
    if (!target) return { ok: false, reason: 'Das gibt es hier nicht.' };
    if (!meetsWithClock(this.ctx.store.s, target.requires, this.ctx.clock)) return { ok: false, reason: 'Noch nicht.' };

    this.ctx.bus.emit('world.interact', { interactable: interactableId, type: target.type, location: here.id });
    this.ctx.clock.advance(6);
    return { ok: true, interactable: target };
  }

  // --- Das Fenster ------------------------------------------------------

  /**
   * Aus dem Fenster sehen. Was zu sehen ist, hängt von Überwachungsdruck,
   * Tageszeit und Akt ab — deshalb lohnt es sich, öfter hinzuschauen.
   */
  lookOutWindow() {
    const { store, rng, clock, meters, bus } = this.ctx;
    const pressure = meters.surveillancePressure();
    const phase = clock.phase;
    const act = store.s.player.act;

    const scenes = [
      { id: 'nichts', weight: 30 - pressure / 4, text: 'Straße. Zwei parkende Autos, eine Katze. Nichts.' },
      { id: 'fahrzeug', weight: 8 + pressure / 3, text: 'Der graue Wagen steht wieder da. Diesmal mit laufendem Motor.', effects: { nwoInfluence: 2, crashout: 4 } },
      { id: 'person', weight: 6 + pressure / 4, text: 'Jemand steht am Laternenmast und sieht nicht aufs Telefon. Niemand steht so da.', effects: { nwoInfluence: 2, crashout: 5 } },
      { id: 'nachbar', weight: 10, text: 'Der Nachbar aus dem Dritten trägt Müll runter. Er sieht kurz hoch.', effects: { crashout: 2 } },
      { id: 'streife', weight: 4 + pressure / 6, text: 'Ein Streifenwagen, langsam, ohne Blaulicht.', effects: { crashout: 3 } },
      { id: 'kamera', weight: 3 + pressure / 5, text: 'An der Kreuzung hängt eine Kamera, die vorletzte Woche noch nicht da war.', effects: { nwoInfluence: 3 } },
      { id: 'nacht_lieferung', weight: phase === 'nacht' ? 12 : 0, text: 'Zwei Männer laden etwas aus einem Transporter. Um diese Uhrzeit. Ohne Licht.', effects: { nwoInfluence: 4, crashout: 6 } },
      { id: 'fenster_finale', weight: act >= 14 && phase === 'nacht' ? 14 : 0, text: 'Gegenüber, im dritten Stock, steht jemand am Fenster und sieht herüber. Er hat eine Kamera. Er filmt nicht die Straße.', effects: { crashout: 10, nwoInfluence: 5 } }
    ];

    const scene = rng.weighted(scenes, (s) => Math.max(0, s.weight)) ?? scenes[0];
    store.count('windowObserved');
    store.s.world.windowScenes.push(scene.id);
    store.touch('world');
    if (scene.effects) this.ctx.applyEffects(scene.effects, { window: scene.id });
    bus.emit('window.observed', { scene: scene.id, phase, text: scene.text });
    bus.emit('audio.sfx', { id: 'window' });
    clock.advance(5);
    return scene;
  }

  // --- Das NWO-Labor ----------------------------------------------------

  labAreas() {
    const labor = this.ctx.registry.location('nwo_labor');
    return (labor?.areas ?? []).map((area) => ({
      ...area,
      unlocked: meets(this.ctx.store.s, area.requires),
      visited: this.ctx.store.s.world.labAreas.includes(area.id)
    }));
  }

  enterLabArea(areaId) {
    const labor = this.ctx.registry.location('nwo_labor');
    const area = (labor?.areas ?? []).find((a) => a.id === areaId);
    if (!area) return { ok: false, reason: 'Diesen Bereich gibt es nicht.' };
    if (!meets(this.ctx.store.s, area.requires)) return { ok: false, reason: 'Keine Freigabe.' };

    this.ctx.store.s.player.labArea = areaId;
    if (!this.ctx.store.s.world.labAreas.includes(areaId)) this.ctx.store.s.world.labAreas.push(areaId);
    this.ctx.store.touch('world');
    this.ctx.bus.emit('labor.area', { area: areaId });
    this.ctx.clock.advance(10);

    // Der unbezeichnete Raum verrät sich nur, wenn man aufmerksam ist.
    if (areaId === 'geheime_bibliothek' && !this.ctx.store.flag('u7_hinweis_gefunden')) {
      this.ctx.store.setFlag('u7_hinweis_gefunden');
      this.ctx.store.addLog('Im Grundriss an der Wand fehlt ein Raum, den es geben muss.', 'nwo');
    }
    return { ok: true, area };
  }

  // --- Läden ------------------------------------------------------------

  shop(shopId) {
    const shop = this.ctx.registry.shops[shopId];
    if (!shop) return null;
    return {
      ...shop,
      stock: shop.stock.map((id) => {
        const item = this.ctx.registry.item(id);
        return { id, name: item?.name ?? id, price: item?.price ?? 20, description: item?.description };
      })
    };
  }

  buy(shopId, itemId) {
    const shop = this.shop(shopId);
    const entry = shop?.stock.find((s) => s.id === itemId);
    if (!entry) return { ok: false, reason: 'Nicht im Sortiment.' };
    if (this.ctx.store.stat('mett') < entry.price) return { ok: false, reason: 'Zu wenig Mett.' };
    this.ctx.applyEffects({ mett: -entry.price, items: [itemId] }, { shop: shopId });
    this.ctx.clock.advance(5);
    return { ok: true, item: entry };
  }

  map() {
    return this.data.regions.map((region) => ({
      ...region,
      locations: this.data.locations
        .filter((l) => l.region === region.id)
        .map((l) => ({
          id: l.id,
          name: l.name,
          unlocked: this.unlocked(l),
          visited: this.ctx.store.s.world.visited.includes(l.id),
          current: l.id === this.ctx.store.s.player.location
        }))
    }));
  }
}
