/**
 * UI-Controller. Hält den Ansichtszustand (welcher Bildschirm, welcher
 * Dialogknoten) und zeichnet neu, wenn sich der Spielzustand ändert.
 * Spiellogik steht hier bewusst keine — die liegt vollständig in der Engine.
 */
import { $, debounce, h, mount } from './dom.mjs';
import { renderHud } from './hud.mjs';
import { renderStage } from './stage.mjs';
import { renderQuests, renderLog } from './panels.mjs';
import { renderComputer } from './computer.mjs';
import { renderOverlay } from './overlays.mjs';

export class UI {
  constructor(game, root = document) {
    this.game = game;
    this.root = root;
    this.view = 'welt';            // welt | computer
    this.overlay = null;
    this.computerApp = 'juhtub';
    this.terminalSection = 'akten';
    this.dialogueView = null;
    this.monolog = null;
    this.openMail = null;
    this.saveSlots = [];
    this.toasts = [];
    this.fideoDraft = { title: '', topic: 'nwo', length: 'mittel', anger: 50, evidence: false };

    this.nodes = {
      hud: $('#hud', root),
      stage: $('#stage', root),
      quests: $('#quests', root),
      log: $('#log', root),
      overlay: $('#overlay', root),
      toasts: $('#toasts', root),
      nav: $('#nav', root)
    };

    this.render = debounce(() => this.draw());
    this.wire();
  }

  wire() {
    const { bus } = this.game;
    bus.on('state.patched', () => this.render());
    bus.on('event.fired', () => this.render());
    bus.on('dialogue.closed', () => { this.dialogueView = null; this.render(); });

    bus.on('effects.applied', ({ applied }) => {
      for (const entry of applied) {
        if (entry.kind === 'stat' && Math.abs(entry.value) >= 1) {
          this.toast(`${entry.value > 0 ? '+' : ''}${Math.round(entry.value)} ${entry.label}`, entry.value > 0 ? 'good' : 'bad');
        }
        if (entry.kind === 'item') this.toast(`Erhalten: ${entry.label}`, 'item');
        if (entry.kind === 'lore') this.toast(`Kodex: ${entry.label}`, 'lore');
        if (entry.kind === 'achievement') this.toast(`Achievement: ${entry.label}`, 'gold');
      }
    });
    bus.on('quest.completed', ({ title }) => this.toast(`Abgeschlossen: ${title}`, 'gold'));
    bus.on('quest.started', ({ title }) => this.toast(`Neue Quest: ${title}`, 'lore'));
    bus.on('act.changed', ({ act, title }) => this.toast(`AKT ${act}: ${title}`, 'gold'));
    bus.on('crashout.maximum', () => this.toast('MAXIMUM CRASHOUT', 'bad'));
    bus.on('nwo.sees_all', () => this.toast('DIE NWO SIEHT ALLES', 'nwo'));
    bus.on('save.written', ({ label }) => this.toast(label, 'lore'));
    bus.on('monolog.ehdzhusten', () => this.flash('ehdzhusten'));

    document.addEventListener('keydown', (e) => this.onKey(e));
  }

  onKey(e) {
    if (e.target.matches('input, select, textarea')) return;
    const map = { k: 'kodex', i: 'inventar', m: 'karte', f: 'figuren', t: 'terminal', a: 'alchemie' };
    if (e.key === 'Escape') { this.overlay ? this.closeOverlay() : (this.view = 'welt'); this.render(); return; }
    if (e.key === 'c') { this.view = this.view === 'computer' ? 'welt' : 'computer'; this.render(); return; }
    if (map[e.key]) { this.toggleOverlay(map[e.key]); }
  }

  // --- Zeichnen ---------------------------------------------------------

  draw() {
    renderHud(this.nodes.hud, this.game);
    this.drawNav();
    if (this.view === 'computer') renderComputer(this.nodes.stage, this.game, this);
    else renderStage(this.nodes.stage, this.game, this);
    renderQuests(this.nodes.quests, this.game, this);
    renderLog(this.nodes.log, this.game);
    renderOverlay(this.nodes.overlay, this.game, this);
    this.drawToasts();
  }

  renderComputerOnly() { if (this.view === 'computer') renderComputer(this.nodes.stage, this.game, this); }

  drawNav() {
    const buttons = [
      { id: 'welt', label: 'Welt', active: this.view === 'welt' && !this.overlay },
      { id: 'computer', label: 'Computer', active: this.view === 'computer' },
      { id: 'kodex', label: 'Kodex', overlay: true },
      { id: 'inventar', label: 'Inventar', overlay: true },
      { id: 'alchemie', label: 'Alchemie', overlay: true },
      { id: 'karte', label: 'Karte', overlay: true },
      { id: 'figuren', label: 'Figuren', overlay: true },
      { id: 'terminal', label: 'NWO', overlay: true, nwo: true },
      { id: 'archiv', label: 'Archiv', overlay: true }
    ];
    mount(this.nodes.nav, buttons.map((b) =>
      h('button', {
        class: `nav__button ${b.active || this.overlay === b.id ? 'is-active' : ''} ${b.nwo ? 'nav__button--nwo' : ''}`,
        onclick: () => {
          if (b.overlay) this.toggleOverlay(b.id);
          else { this.view = b.id; this.overlay = null; this.render(); }
        }
      }, b.label)
    ),
    h('button', {
      class: 'nav__button nav__button--final',
      title: this.game.store.s.player.act >= 15 ? 'Der letzte Mimonolog' : 'Noch zu früh',
      onclick: () => this.finalMonolog()
    }, 'Letzter Mimonolog'));
  }

  drawToasts() {
    mount(this.nodes.toasts, this.toasts.slice(-6).map((t) =>
      h('div', { class: `toast toast--${t.kind}` }, t.text)
    ));
  }

  toast(text, kind = 'info') {
    const entry = { text, kind, id: Math.random() };
    this.toasts.push(entry);
    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t !== entry);
      this.drawToasts();
    }, 3600);
    this.drawToasts();
  }

  flash(kind) {
    document.body.classList.add(`flash--${kind}`);
    setTimeout(() => document.body.classList.remove(`flash--${kind}`), 400);
  }

  // --- Aktionen ---------------------------------------------------------

  async toggleOverlay(id) {
    this.overlay = this.overlay === id ? null : id;
    if (this.overlay === 'terminal' && this.game.nwo.terminalAvailable()) this.game.nwo.openTerminal();
    if (this.overlay === 'archiv') this.saveSlots = await this.game.save.list();
    this.render();
  }

  closeOverlay() { this.overlay = null; this.render(); }
  openTerminal(section) { this.terminalSection = section; this.game.nwo.files(section).forEach(() => {}); this.render(); }
  openComputer(app) { this.computerApp = app; this.openMail = null; this.render(); }

  travel(locationId) {
    const result = this.game.world.travel(locationId);
    if (!result.ok) this.toast(result.reason, 'bad');
    else this.overlay = null;
    this.render();
  }

  enterLabArea(areaId) {
    const result = this.game.world.enterLabArea(areaId);
    this.toast(result.ok ? `Bereich: ${result.area.label}` : result.reason, result.ok ? 'lore' : 'bad');
    this.render();
  }

  interact(interactable) {
    const result = this.game.world.interact(interactable.id);
    if (!result.ok) { this.toast(result.reason, 'bad'); return; }
    const it = result.interactable;

    switch (it.type) {
      case 'app':
        if (it.app === 'computer') this.view = 'computer';
        else { this.overlay = 'telefon'; }
        break;
      case 'window': {
        const scene = this.game.world.lookOutWindow();
        this.toast(scene.text, 'nwo');
        break;
      }
      case 'dialogue': this.openDialogue(it.dialogue); break;
      case 'alchemy': this.overlay = 'alchemie'; break;
      case 'archive': this.view = 'computer'; this.computerApp = 'archiv'; break;
      case 'series': this.view = 'computer'; this.computerApp = 'productions'; break;
      case 'terminal': this.toggleOverlay('terminal'); return;
      case 'outfit': this.overlay = 'inventar'; break;
      case 'shop': this.openShop(it.shop); return;
      case 'consume':
        this.game.store.addItem(it.item, 1);
        this.game.inventory.use(it.item);
        break;
      case 'rest': case 'sleep': {
        const minutes = it.type === 'sleep' ? 480 : 60;
        this.game.clock.advance(minutes);
        this.game.store.addStat('crashout', -(it.type === 'sleep' ? 30 : 8), { min: 0, max: 100 });
        this.toast(it.type === 'sleep' ? 'Geschlafen.' : 'Kurz gesessen.', 'good');
        break;
      }
      case 'investigate': {
        const found = this.game.rng.chance(0.4 + this.game.store.stat('authenticity') / 250);
        if (found) {
          const page = this.game.inventory.grantRandomPage();
          this.game.applyEffects({ nwoInfluence: 3, authenticity: 2, log: page ? `Zwischen den Papieren: ${page.title}.` : 'Etwas notiert.' });
        } else this.toast('Nichts. Diesmal nichts.', 'info');
        break;
      }
      case 'police_report':
        this.game.bus.emit('police.report', { location: this.game.store.s.player.location });
        this.game.applyEffects({ authenticity: 4, trust: { kommissarin_devrim: 5 }, log: 'Anzeige aufgenommen. Wartenummer behalten.' });
        break;
      case 'lore':
        this.game.codex.unlock(it.lore);
        this.overlay = 'kodex';
        break;
      case 'reading': case 'study': this.overlay = 'inventar'; break;
      case 'minigame':
        this.game.clock.advance(30);
        this.game.applyEffects({ crashout: -10, log: 'Ein paar Würfe. Der Korb hat kein Netz.' });
        break;
      case 'upload':
        this.game.applyEffects({ mett: 60, authenticity: -3, log: 'Anonym hochgeladen. Niemand weiß, von wem.' });
        break;
      case 'wait_contact': {
        this.game.clock.advance(45);
        const npcs = this.game.world.npcsHere();
        this.toast(npcs.length ? `Jemand kommt: ${npcs.map((n) => n.name).join(', ')}` : 'Niemand kommt.', 'info');
        break;
      }
      case 'event': this.game.events.fire(it.event); break;
      case 'travel': this.travel(it.target); return;
      default: this.toast('Nichts passiert.', 'info');
    }
    this.render();
  }

  openShop(shopId) {
    this.shopId = shopId;
    this.overlay = 'laden';
    this.render();
  }

  buy(itemId) {
    const result = this.game.world.buy(this.shopId, itemId);
    this.toast(result.ok ? `Gekauft: ${result.item.name}` : result.reason, result.ok ? 'good' : 'bad');
    this.render();
  }

  talkTo(npcId, channel = 'vor_ort') {
    const dialogueId = this.game.roster.dialogueFor(npcId, { channel });
    if (!dialogueId) { this.toast(`${this.game.registry.characterName(npcId)} hat gerade nichts zu sagen.`, 'info'); return; }
    if (channel === 'telefon') {
      this.game.bus.emit('phone.answered', { caller: npcId });
      this.game.clock.advance(15);
    }
    this.openDialogue(dialogueId, npcId);
  }

  openDialogue(dialogueId, npc) {
    this.view = 'welt';
    this.overlay = null;
    this.dialogueView = this.game.dialogue.open(dialogueId, { npc });
    this.render();
  }

  choose(index) {
    this.dialogueView = this.game.dialogue.choose(index);
    this.render();
  }

  continueDialogue() {
    this.dialogueView = this.game.dialogue.isOpen ? this.game.dialogue.continue() : null;
    this.render();
  }

  respondEvent(index) {
    this.game.events.respond(index);
    this.render();
  }

  startQuest(questId) {
    this.game.quests.start(questId);
    this.render();
  }

  // --- Computer ---------------------------------------------------------

  publishFideo() {
    const result = this.game.fideos.publish({ ...this.fideoDraft });
    this.toast(`${result.fideo.title} — ${result.reach.toLocaleString('de-DE')} Aufrufe`, 'gold');
    this.fideoDraft.title = '';
    this.render();
  }

  watchFideo(id) {
    const fideo = this.game.fideos.watch(id);
    if (fideo) this.toast(`Angesehen: ${fideo.title}`, 'info');
    this.render();
  }

  readMail(id) {
    this.openMail = id;
    this.game.emails.read(id);
    this.render();
  }

  /** Absender eines Heet-Mehls direkt zur Rede stellen. */
  confrontSender(mailId) {
    const mail = this.game.emails.inbox.find((m) => m.id === mailId);
    const heeter = mail && this.game.registry.heeters.get(mail.from);
    if (!heeter?.character) { this.toast('Kein Weg zu diesem Absender.', 'bad'); return; }
    this.openMail = null;
    this.talkTo(heeter.character, 'online');
  }

  handleMail(id, action) {
    const result = this.game.emails.handle(id, action);
    if (result) this.toast(`${result.action.label}.`, 'info');
    this.openMail = null;
    this.render();
  }

  analyzeComments() {
    this.game.fideos.analyzeComments();
    this.render();
  }

  // --- Sonstiges --------------------------------------------------------

  useItem(itemId) {
    const result = this.game.inventory.use(itemId);
    if (result?.reason) this.toast(result.reason, 'bad');
    this.render();
  }

  brew(recipeId) {
    const result = this.game.alchemy.brew(recipeId);
    this.toast(result.ok ? `Gebraut: ${result.recipe.name}` : result.reason, result.ok ? 'gold' : 'bad');
    this.render();
  }

  async saveTo(slot) {
    await this.game.save.save(slot);
    this.saveSlots = await this.game.save.list();
    this.render();
  }

  async loadFrom(slot) {
    const result = await this.game.save.load(slot);
    if (!result.ok) { this.toast(result.reason, 'bad'); return; }
    this.game.resume();
    this.dialogueView = null;
    this.overlay = null;
    this.toast('Archiv geladen.', 'gold');
    this.render();
  }

  showMonolog(spec) {
    // Ein Monolog ist eine eigenstaendige Handlung: ein offener Dialog wuerde
    // ihn in der Buehnenreihenfolge sonst verdecken.
    if (this.game.dialogue.isOpen) { this.game.dialogue.close(); this.dialogueView = null; }
    this.monolog = this.game.monolog.generate(spec);
    this.view = 'welt';
    this.overlay = null;
    this.render();
  }

  closeMonolog() { this.monolog = null; this.render(); }

  finalMonolog() {
    if (this.game.store.s.player.act < 15) {
      this.toast('Dafür ist es noch zu früh. Es fehlt noch einiges.', 'bad');
      return;
    }
    const { monolog, ending } = this.game.finalMonolog();
    this.monolog = monolog;
    this.render();
    if (ending) setTimeout(() => { this.monolog = null; this.overlay = 'ende'; this.render(); }, 1200);
  }
}
