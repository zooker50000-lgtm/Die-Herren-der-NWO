/**
 * Alchemie als Skillsystem.
 *
 * Bewusste Grenze: Rezepte sind symbolisch (Stufen, Essenzen, Zeichen).
 * Es gibt keine Mengen, keine Temperaturen, keine Verfahren — nichts,
 * was außerhalb der Spielwelt eine Anleitung wäre.
 */
import { meets } from '../core/conditions.mjs';

export class AlchemySystem {
  constructor(ctx) {
    this.ctx = ctx;
    this.data = ctx.registry.data.alchemy;
    this.wire();
  }

  get level() { return this.ctx.store.stat('alchemy'); }
  get xp() { return this.ctx.store.stat('alchemyXp'); }

  wire() {
    this.ctx.bus.on('alchemy.xp', () => this.checkLevel());
    this.ctx.bus.on('item.gained', ({ item }) => {
      const book = this.data.books.find((b) => b.id === item);
      if (book) this.ctx.store.addLog(`Neue Rezepte studiert: ${book.unlocksRecipes.length}`, 'alchemie');
    });
  }

  /** Kurve aus data/alchemy.json - flach genug, dass die Geschichte sie traegt. */
  xpForLevel(level) { return level * 18 + 40; }

  checkLevel() {
    // Der Abzug der XP feuert selbst wieder alchemy.xp - ein Wiedereintritt
    // wuerde dieselbe Stufe doppelt vergeben.
    if (this.levelling) return;
    this.levelling = true;
    const store = this.ctx.store;
    let leveled = false;
    while (this.level < 100 && this.xp >= this.xpForLevel(this.level)) {
      store.addStat('alchemyXp', -this.xpForLevel(this.level));
      store.addStat('alchemy', 1, { min: 1, max: 100 });
      leveled = true;
    }
    this.levelling = false;
    if (leveled) {
      this.ctx.bus.emit('alchemy.levelup', { level: this.level });
      store.addLog(`Alchemie-Level ${this.level}.`, 'alchemie');
      this.ctx.bus.emit('audio.sfx', { id: 'ping' });
    }
  }

  /** Laborstufe am aktuellen Ort. */
  labLevel() {
    const location = this.ctx.store.s.player.location;
    const lab = [...this.data.labLevels].reverse().find((l) => l.location === location);
    return lab?.level ?? 0;
  }

  /** Freigeschaltete Rezepte: über Bücher, Level und Voraussetzungen. */
  knownRecipes() {
    const store = this.ctx.store;
    const unlocked = new Set();
    for (const book of this.data.books) {
      if (store.has(book.id)) for (const r of book.unlocksRecipes) unlocked.add(r);
    }
    return this.data.recipes.filter((r) => unlocked.has(r.id));
  }

  canBrew(recipeId) {
    const recipe = this.ctx.registry.recipes.get(recipeId);
    const store = this.ctx.store;
    if (!recipe) return { ok: false, reason: 'Unbekanntes Rezept.' };
    if (!this.knownRecipes().some((r) => r.id === recipeId)) return { ok: false, reason: 'Rezept nicht bekannt. Es fehlt das Buch.' };
    if (this.level < recipe.minLevel) return { ok: false, reason: `Alchemie-Level ${recipe.minLevel} nötig.` };
    const lab = this.labLevel();
    if (lab < 1) return { ok: false, reason: 'Hier gibt es kein Labor.' };
    if (recipe.tier > lab) return { ok: false, reason: 'Dieses Labor reicht dafür nicht aus.' };
    if (recipe.requires && !meets(store.s, recipe.requires)) return { ok: false, reason: 'Voraussetzungen fehlen.' };
    const missing = recipe.ingredients.filter((i) => !store.has(i));
    if (missing.length) return { ok: false, reason: `Zutaten fehlen: ${missing.map((m) => this.ctx.registry.itemName(m)).join(', ')}` };
    return { ok: true, recipe };
  }

  brew(recipeId) {
    const check = this.canBrew(recipeId);
    if (!check.ok) return check;
    const recipe = check.recipe;
    for (const ing of recipe.ingredients) this.ctx.store.removeItem(ing, 1);

    this.ctx.applyEffects({ ...recipe.effects, alchemyXp: recipe.xp }, { recipe: recipeId });
    this.ctx.bus.emit('alchemy.brewed', { recipe: recipeId, stage: recipe.stage, tier: recipe.tier });
    this.ctx.bus.emit('alchemy.stage', { stage: recipe.stage, recipe: recipeId });
    this.ctx.store.addLog(`Gebraut: ${recipe.name}. ${recipe.flavor}`, 'alchemie');
    return { ok: true, recipe };
  }

  stages() {
    return this.data.stages.map((s) => ({ ...s, reached: this.level >= s.minLevel }));
  }

  /** Bücher lesen: einmalig XP, danach nur noch Nachschlagewerk. */
  study(itemId) {
    const item = this.ctx.registry.item(itemId);
    if (!item || !this.ctx.store.has(itemId)) return null;
    const flag = `studiert_${itemId}`;
    if (this.ctx.store.flag(flag)) return { alreadyStudied: true, item };
    this.ctx.store.setFlag(flag);
    if (item.effects) this.ctx.applyEffects(item.effects, { item: itemId });
    this.ctx.store.addLog(`Studiert: ${item.name}`, 'alchemie');
    return { item };
  }
}
