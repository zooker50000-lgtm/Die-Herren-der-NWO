#!/usr/bin/env node
/**
 * Terminal-Client. Benutzt dieselbe Engine wie die Web-UI —
 * die Engine weiß nicht, dass hier eine Konsole hängt.
 */
import readline from 'node:readline';
import { Game } from '../game.mjs';
import { MimonologGenerator } from '../dialogue/mimonolog.mjs';
import { SLOTS, SLOT_LABELS } from '../save/index.mjs';

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  gelb: '\x1b[33m', rot: '\x1b[31m', blau: '\x1b[34m', gruen: '\x1b[32m',
  magenta: '\x1b[35m', cyan: '\x1b[36m', grau: '\x1b[90m'
};
const c = (color, text) => `${C[color] ?? ''}${text}${C.reset}`;

const game = await Game.create({ seed: Number(process.env.MIMON_SEED) || undefined });
game.start();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

/**
 * Eigene Eingabewarteschlange statt rl.question: bei nicht-interaktiver
 * Eingabe (Pipe, Skript) treffen alle Zeilen auf einmal ein, und readline
 * verwirft alles, wofür gerade keine Frage offen ist.
 */
const lines = [];
let waiting = null;
let closed = false;
rl.on('line', (line) => {
  if (waiting) { const resolve = waiting; waiting = null; resolve(line); }
  else lines.push(line);
});
rl.on('close', () => {
  closed = true;
  if (waiting) { const resolve = waiting; waiting = null; resolve(''); }
});

function ask(question) {
  process.stdout.write(question);
  if (lines.length) return Promise.resolve(lines.shift());
  if (closed) return Promise.resolve('');
  return new Promise((resolve) => { waiting = resolve; });
}

// --- Ausgabe ------------------------------------------------------------

function bar(value, max, width = 12) {
  const filled = Math.round((Math.max(0, Math.min(max, value)) / max) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function hud() {
  const s = game.snapshot();
  const m = s.meters;
  console.log('\n' + c('grau', '─'.repeat(72)));
  console.log(
    `${c('bold', 'MIMON BARAKA')}  ${c('grau', s.time)}  ${c('grau', '|')} ` +
    `AKT ${s.act.n}: ${s.act.title}  ${c('grau', '|')} ${c('cyan', s.location.name)}`
  );
  console.log(
    `${c('gruen', 'REAL-AUTH')} ${bar(m.authenticity.value, 100)} ${String(m.authenticity.value).padStart(3)} ${c('grau', m.authenticity.tier.label)}`
  );
  console.log(
    `${c('rot', 'CRASHOUT ')} ${bar(m.crashout.value, 100)} ${String(m.crashout.value).padStart(3)} ${c('grau', m.crashout.tier.label)}`
  );
  console.log(
    `${c('blau', 'NWO      ')} ${bar(m.nwo.value, 100)} ${String(m.nwo.value).padStart(3)} ${c('grau', m.nwo.tier.label)}`
  );
  console.log(
    `${c('gelb', 'METT     ')} ${String(m.mett.value).padStart(6)}   ${c('grau', `Abos ${m.subscribers.toLocaleString('de-DE')}  Heet-Mehls ${s.unread}  Quests ${s.quests}  Kodex ${s.lore.percent}%`)}`
  );
  console.log(c('grau', '─'.repeat(72)));
}

function printMonolog(monolog) {
  console.log('');
  for (const beat of monolog.beats) {
    if (beat.type === 'EHDZHUSTEN') { console.log(c('grau', `   ${beat.text}`)); continue; }
    const color = monolog.tier === 'loud' ? 'rot' : monolog.tier === 'annoyed' ? 'gelb' : 'reset';
    console.log(`   ${c(color, beat.text)}`);
  }
  console.log(c('grau', `   [${monolog.meta.beatCount} Beats, ${monolog.meta.words} Wörter, ${monolog.meta.ehdzhusten}x Ehdzhusten]`));
}

function say(speakerName, text, color = 'cyan') {
  if (!text) return;
  console.log(`\n${c(color, speakerName ? speakerName + ':' : '')} ${text}`);
}

async function chooseFrom(items, { prompt = 'Auswahl', allowBack = true } = {}) {
  if (!items.length) { console.log(c('grau', 'Nichts verfügbar.')); return null; }
  items.forEach((item, i) => {
    const locked = item.available === false || item.unlocked === false;
    console.log(`  ${c('bold', String(i + 1).padStart(2))}) ${locked ? c('grau', item.label + ' [gesperrt]') : item.label}`);
  });
  if (allowBack) console.log(`  ${c('bold', ' 0')}) ${c('grau', 'zurück')}`);
  const answer = (await ask(`${prompt} > `)).trim();
  const index = Number(answer) - 1;
  if (!answer || answer === '0') return null;
  return items[index] ?? null;
}

// --- Aktionen -----------------------------------------------------------

async function runDialogue(dialogueId) {
  let view = game.dialogue.open(dialogueId);
  while (view) {
    if (view.monolog) printMonolog(view.monolog);
    else say(view.speakerName, view.text, view.speaker === 'mimon' ? 'gelb' : 'cyan');

    if (view.choices.length) {
      const picked = await chooseFrom(
        view.choices.map((ch) => ({ ...ch, label: `${ch.text} ${c('grau', '[' + ch.toneLabel + ']')}` })),
        { prompt: 'Antwort', allowBack: false }
      );
      if (!picked) { game.dialogue.close(); return; }
      if (!picked.available) { console.log(c('grau', picked.blockedBy.join(', '))); continue; }
      view = game.dialogue.choose(picked.index);
    } else if (view.canContinue) {
      await ask(c('grau', '   [Enter] '));
      view = game.dialogue.continue();
    } else {
      game.dialogue.close();
      return;
    }
  }
}

async function handlePendingEvent() {
  const view = game.events.view();
  if (!view) return false;
  console.log(`\n${c('magenta', '◆ ' + view.title)}`);
  console.log(`  ${view.text}`);
  // Auf ein Ereignis muss geantwortet werden - eine leere Eingabe fragt erneut.
  for (;;) {
    const picked = await chooseFrom(view.choices.map((ch) => ({ ...ch, label: ch.text })), { prompt: 'Reaktion', allowBack: false });
    if (picked) { game.events.respond(picked.index); return true; }
    if (closed) { game.events.pending = null; return true; }
    console.log(c('grau', '  Bitte eine der Zahlen eingeben.'));
  }
}

async function computerMenu() {
  while (true) {
    const apps = [
      { id: 'juhtub', label: 'JUHTUB' },
      { id: 'heet', label: `HEET-MEHL (${game.emails.unreadCount()} ungelesen)` },
      { id: 'nwomail', label: 'NWO MAIL' },
      { id: 'archiv', label: 'BARAKA-ARCHIV' },
      { id: 'productions', label: 'NWO PRODUCTIONS' },
      { id: 'kommentare', label: 'KOMMENTARE' },
      { id: 'terminal', label: 'NWO-TERMINAL', unlocked: game.nwo.terminalAvailable() }
    ];
    const picked = await chooseFrom(apps, { prompt: 'Computer' });
    if (!picked) return;
    if (picked.id === 'juhtub') await juhtub();
    else if (picked.id === 'heet' || picked.id === 'nwomail') await postfach(picked.id === 'nwomail' ? 'nwo' : 'heet_mehl');
    else if (picked.id === 'archiv') archiv();
    else if (picked.id === 'productions') serien();
    else if (picked.id === 'kommentare') kommentare();
    else if (picked.id === 'terminal') await terminal();
  }
}

async function juhtub() {
  const options = [
    { id: 'publish', label: 'Neues Fideo aufnehmen' },
    ...game.fideos.library().map((f) => ({ id: f.id, label: `${f.title} ${c('grau', `(${(f.views ?? 0).toLocaleString('de-DE')} Aufrufe, ${f.uploader})`)}` }))
  ];
  const picked = await chooseFrom(options, { prompt: 'Juhtub' });
  if (!picked) return;
  if (picked.id === 'publish') return produceFideo();
  const fideo = game.fideos.watch(picked.id);
  console.log(`\n  ${c('bold', fideo.title)}\n  ${c('grau', fideo.description ?? '')}`);
}

async function produceFideo() {
  const title = (await ask('Titel (leer = automatisch) > ')).trim();
  const topic = await chooseFrom(game.fideos.topics().map((t) => ({ ...t, label: t.label })), { prompt: 'Thema', allowBack: false });
  if (!topic) return;
  const length = await chooseFrom(game.fideos.lengths().map((l) => ({ ...l, label: l.label })), { prompt: 'Länge', allowBack: false });
  if (!length) return;
  const anger = Number((await ask('Wut 0-100 > ')).trim()) || game.store.stat('crashout');
  const evidence = (await ask('Mit Belegen? (j/n) > ')).trim().toLowerCase().startsWith('j');

  const result = game.fideos.publish({ title, topic: topic.id, length: length.id, anger, evidence });
  console.log(`\n  ${c('bold', result.fideo.title)}`);
  console.log(`  ${result.reach.toLocaleString('de-DE')} Aufrufe  ${c('gelb', '+' + result.mett + ' METT')}  ${c('gruen', (result.authenticity >= 0 ? '+' : '') + result.authenticity + ' REAL-AUTH')}  ${c('grau', '+' + result.subscribers + ' Abos')}`);
  const comments = game.store.s.media.comments.slice(-3);
  for (const comment of comments) console.log(`  ${c('grau', comment.author + ': ' + comment.text)}`);
}

async function postfach(channel) {
  while (true) {
    const mails = game.emails.inbox.filter((m) => m.channel === channel);
    const picked = await chooseFrom(
      mails.map((m) => ({ ...m, label: `${m.read ? c('grau', '·') : c('rot', '●')} ${m.fromName} — ${m.subject}` })),
      { prompt: channel === 'nwo' ? 'NWO Mail' : 'Heet-Mehl' }
    );
    if (!picked) return;
    const mail = game.emails.read(picked.id);
    console.log(`\n  ${c('bold', 'Von: ' + mail.fromName)}   ${c('grau', 'Betreff: ' + mail.subject)}`);
    console.log(`  ${mail.body}\n`);
    const heeter = game.registry.heeters.get(mail.from);
    const konfrontierbar = heeter?.character && game.roster.dialogueFor(heeter.character, { channel: 'online' });
    const action = await chooseFrom([
      ...game.emails.actions().map((a) => ({ ...a, title: a.label, label: `${a.label} ${c('grau', '— ' + a.note)}` })),
      ...(konfrontierbar ? [{ id: '__konfrontieren', title: 'Zur Rede stellen', label: c('gelb', 'Zur Rede stellen') }] : [])
    ], { prompt: 'Reaktion' });
    if (!action) continue;
    if (action.id === '__konfrontieren') { await runDialogue(konfrontierbar); continue; }
    game.emails.handle(mail.id, action.id);
    console.log(c('grau', `  ${action.title}.`));
  }
}

function archiv() {
  console.log(`\n  ${c('bold', 'BARAKA-ARCHIV')}`);
  for (const page of game.inventory.tagebuch()) {
    if (page.found) console.log(`  ${c('gelb', '▪')} ${c('bold', page.title)} — ${page.text}`);
    else console.log(`  ${c('grau', '▫ ' + page.title + ' (fehlt)')}`);
  }
  console.log(`\n  ${c('grau', 'Fideos im Archiv: ' + game.store.s.media.published.length)}`);
}

function serien() {
  console.log(`\n  ${c('bold', 'NWO PRODUCTIONS')}`);
  for (const s of game.codex.series()) {
    console.log(`\n  ${c('bold', s.title)} ${c('grau', `(${s.episodeCount} Episoden, ${s.done}/${s.playable} gespielt)`)}`);
    console.log(`  ${c('grau', s.logline)}`);
    for (const ep of s.episodes) {
      const mark = ep.done ? c('gruen', '✓') : ep.quest ? c('gelb', '·') : c('grau', '·');
      console.log(`   ${mark} ${String(ep.n).padStart(2)}. ${ep.title}`);
    }
  }
}

function kommentare() {
  const { comments, summary } = game.fideos.analyzeComments();
  console.log(`\n  ${c('bold', 'KOMMENTARE')} ${c('grau', JSON.stringify(summary))}`);
  for (const comment of comments.slice(-12)) {
    console.log(`  ${c('grau', comment.author + ':')} ${comment.text}`);
  }
}

async function terminal() {
  if (!game.nwo.terminalAvailable()) { console.log(c('grau', 'Kein Zugang.')); return; }
  const { greeting } = game.nwo.openTerminal();
  console.log(`\n  ${c('blau', greeting)}`);
  while (true) {
    const section = await chooseFrom(game.nwo.sections().map((s) => ({ ...s, label: s.label })), { prompt: 'NWO-Terminal' });
    if (!section) return;
    if (!section.unlocked) { console.log(c('grau', `  Freigabe ab NWO INFLUENCE ${section.requiresInfluence}.`)); continue; }
    if (section.id === 'level') { console.log(`  ${c('blau', game.nwo.tier.label)} — ${game.nwo.tier.description}`); continue; }
    if (section.id === 'personen' && !game.nwo.files('personen').length) { printStructure(); continue; }
    const file = await chooseFrom(game.nwo.files(section.id).map((f) => ({ ...f, label: f.title })), { prompt: 'Akte' });
    if (!file) continue;
    const opened = game.nwo.readFile(file.id);
    if (opened?.locked) console.log(c('grau', `  Gesperrt. Freigabe ab ${opened.requiresInfluence}.`));
    else console.log(`\n  ${c('bold', opened.title)}\n  ${opened.body}\n  ${c('grau', '[' + opened.layer + ']')}`);
  }
}

function printStructure() {
  const walk = (node, depth = 0) => {
    console.log(`  ${'  '.repeat(depth)}${node.known ? node.name : c('grau', '???')}`);
    for (const child of node.children) walk(child, depth + 1);
  };
  walk(game.nwo.knownStructure());
}

async function alchemieMenu() {
  const lab = game.alchemy.labLevel();
  if (!lab) { console.log(c('grau', 'Hier gibt es kein Labor.')); return; }
  console.log(`\n  ${c('bold', 'ALCHEMIE')} — Level ${game.store.stat('alchemy')}, Labor Stufe ${lab}`);
  for (const stage of game.alchemy.stages()) {
    console.log(`  ${stage.reached ? c('gelb', '▪') : c('grau', '▫')} ${stage.name} — ${c('grau', stage.description)}`);
  }
  const recipes = game.alchemy.knownRecipes();
  const picked = await chooseFrom(recipes.map((r) => {
    const check = game.alchemy.canBrew(r.id);
    return { ...r, label: `${r.name} ${c('grau', check.ok ? '(bereit)' : '— ' + check.reason)}` };
  }), { prompt: 'Brauen' });
  if (!picked) return;
  const result = game.alchemy.brew(picked.id);
  console.log(result.ok ? `  ${c('gelb', 'Gebraut: ' + result.recipe.name)} — ${result.recipe.flavor}` : c('grau', '  ' + result.reason));
}

async function interactMenu() {
  const items = game.world.interactables();
  const picked = await chooseFrom(items.map((i) => ({ ...i, label: i.label })), { prompt: 'Interaktion' });
  if (!picked) return;
  game.world.interact(picked.id);

  switch (picked.type) {
    case 'app': return picked.app === 'computer' ? computerMenu() : telefonMenu();
    case 'window': {
      const scene = game.world.lookOutWindow();
      console.log(`\n  ${c('cyan', scene.text)}`);
      return;
    }
    case 'dialogue': return runDialogue(picked.dialogue);
    case 'alchemy': return alchemieMenu();
    case 'archive': return archiv();
    case 'series': return serien();
    case 'terminal': return terminal();
    case 'shop': return shopMenu(picked.shop);
    case 'consume': {
      game.store.addItem(picked.item, 1);
      const result = game.inventory.use(picked.item);
      console.log(c('grau', `  ${result.item?.description ?? ''}`));
      return;
    }
    case 'rest': case 'sleep': {
      const minutes = picked.type === 'sleep' ? 480 : 60;
      game.clock.advance(minutes);
      game.store.addStat('crashout', -(picked.type === 'sleep' ? 30 : 8), { min: 0, max: 100 });
      console.log(c('grau', `  ${picked.type === 'sleep' ? 'Geschlafen.' : 'Kurz gesessen.'}`));
      return;
    }
    case 'investigate': {
      const found = game.rng.chance(0.4 + game.store.stat('authenticity') / 250);
      if (found) {
        const page = game.inventory.grantRandomPage();
        game.applyEffects({ nwoInfluence: 3, authenticity: 2, log: page ? `Zwischen den Papieren: ${page.title}.` : 'Etwas notiert.' });
      } else console.log(c('grau', '  Nichts. Diesmal nichts.'));
      return;
    }
    case 'police_report': {
      game.bus.emit('police.report', { location: game.store.s.player.location });
      game.applyEffects({ authenticity: 4, trust: { kommissarin_devrim: 5 }, log: 'Anzeige aufgenommen. Wartenummer behalten.' });
      return;
    }
    case 'lore': {
      const entry = game.registry.lore.get(picked.lore);
      game.codex.unlock(picked.lore);
      console.log(`\n  ${c('bold', entry?.title ?? '')}\n  ${entry?.description ?? ''}`);
      return;
    }
    case 'reading': case 'study': {
      const books = game.inventory.list().filter((i) => i.type === 'document');
      const book = await chooseFrom(books.map((b) => ({ ...b, label: b.name })), { prompt: 'Lesen' });
      if (book) {
        const result = game.alchemy.study(book.id);
        console.log(c('grau', result?.alreadyStudied ? '  Kennst du schon. Nachgeschlagen.' : `  ${book.description}`));
      }
      return;
    }
    case 'minigame': {
      game.clock.advance(30);
      game.applyEffects({ crashout: -10, log: 'Ein paar Würfe. Der Korb hat kein Netz.' });
      return;
    }
    case 'upload': {
      game.applyEffects({ mett: 60, authenticity: -3, log: 'Anonym hochgeladen. Niemand weiß, von wem.' });
      return;
    }
    case 'wait_contact': {
      game.clock.advance(45);
      const npcs = game.world.npcsHere();
      if (npcs.length) console.log(c('grau', `  Jemand kommt: ${npcs.map((n) => n.name).join(', ')}`));
      else console.log(c('grau', '  Niemand kommt.'));
      return;
    }
    case 'outfit': return outfitMenu();
    case 'event': { game.events.fire(picked.event); return; }
    default: console.log(c('grau', '  Nichts passiert.'));
  }
}

async function shopMenu(shopId) {
  const shop = game.world.shop(shopId);
  const picked = await chooseFrom(shop.stock.map((s) => ({ ...s, label: `${s.name} ${c('gelb', s.price + ' Mett')} ${c('grau', '— ' + (s.description ?? ''))}` })), { prompt: shop.name });
  if (!picked) return;
  const result = game.world.buy(shopId, picked.id);
  console.log(c('grau', result.ok ? `  Gekauft: ${picked.name}` : `  ${result.reason}`));
}

async function outfitMenu() {
  const wearables = game.inventory.list().filter((i) => i.type === 'wearable');
  const picked = await chooseFrom(wearables.map((w) => ({ ...w, label: `${w.name}${w.worn ? c('gruen', ' (getragen)') : ''}` })), { prompt: 'Anziehen' });
  if (picked) game.inventory.wear(picked.id);
}

async function telefonMenu() {
  const contacts = game.roster.reachableVia('telefon');
  const picked = await chooseFrom(contacts.map((c2) => ({ ...c2, label: `${c2.name} ${c('grau', '(Vertrauen ' + c2.trust + ')')}` })), { prompt: 'Anrufen' });
  if (!picked) return;
  game.bus.emit('phone.answered', { caller: picked.id });
  game.clock.advance(15);
  const dialogueId = game.roster.dialogueFor(picked.id, { channel: 'telefon' });
  if (dialogueId) await runDialogue(dialogueId);
  else console.log(c('grau', `  ${picked.name} geht nicht ran.`));
}

async function travelMenu() {
  const exits = game.world.exits();
  const picked = await chooseFrom(exits.map((e) => ({ ...e, label: `${e.name} ${c('grau', `(${e.minutes} Min.)`)}` })), { prompt: 'Wohin' });
  if (!picked) return;
  const result = game.world.travel(picked.id);
  console.log(c('grau', result.ok ? `  Angekommen: ${result.location.name}` : `  ${result.reason}`));
  if (result.ok && picked.id === 'nwo_labor') await laborMenu();
}

async function laborMenu() {
  while (true) {
    const picked = await chooseFrom(game.world.labAreas().map((a) => ({ ...a, label: `${a.label}${a.visited ? c('grau', ' ✓') : ''}` })), { prompt: 'U-7' });
    if (!picked) return;
    const result = game.world.enterLabArea(picked.id);
    console.log(c('grau', result.ok ? `  Bereich betreten: ${result.area.label}` : `  ${result.reason}`));
  }
}

async function talkMenu() {
  const npcs = game.world.npcsHere();
  const picked = await chooseFrom(npcs.map((n) => ({ ...n, label: `${n.name} ${c('grau', '(' + (n.role ?? '') + ')')}` })), { prompt: 'Ansprechen' });
  if (!picked) return;
  const dialogueId = game.roster.dialogueFor(picked.id, { channel: 'vor_ort' });
  if (dialogueId) await runDialogue(dialogueId);
  else console.log(c('grau', `  ${picked.name} hat gerade nichts zu sagen.`));
}

async function questMenu() {
  const journal = game.quests.journal();
  console.log(`\n  ${c('bold', 'QUESTS')}`);
  for (const quest of journal.active) {
    console.log(`  ${c('gelb', '▪')} ${c('bold', quest.title)} ${c('grau', '[' + quest.type + ']')}`);
    console.log(`    ${c('grau', quest.summary)}`);
    for (const o of quest.objectives) {
      const mark = o.done ? c('gruen', '✓') : c('grau', '·');
      const progress = o.needed > 1 ? c('grau', ` (${o.count}/${o.needed})`) : '';
      console.log(`    ${mark} ${o.text}${progress}`);
    }
  }
  console.log(`  ${c('grau', 'Abgeschlossen: ' + journal.completed.length)}`);
  if (journal.available.length) {
    console.log(`\n  ${c('bold', 'VERFÜGBAR')}`);
    const picked = await chooseFrom(
      journal.available.map((q) => ({ ...q, label: `${q.title} ${c('grau', '— ' + q.summary)}` })),
      { prompt: 'Annehmen' }
    );
    if (picked) game.quests.start(picked.id);
  }
}

function kodexMenu() {
  const view = game.codex.view({ includeLocked: false });
  console.log(`\n  ${c('bold', 'KODEX')} ${c('grau', game.codex.stats().unlocked + '/' + game.codex.stats().total)}`);
  for (const [layer, entries] of Object.entries(view)) {
    if (!entries.length) continue;
    console.log(`\n  ${c('blau', layer)}`);
    for (const entry of entries) console.log(`   ${c('bold', entry.title)} — ${entry.description}`);
  }
}

function inventarMenu() {
  console.log(`\n  ${c('bold', 'INVENTAR')}`);
  for (const item of game.inventory.list()) {
    console.log(`  ${item.worn ? c('gruen', '▪') : '·'} ${item.name}${item.count > 1 ? c('grau', ' x' + item.count) : ''} ${c('grau', '— ' + (item.description ?? ''))}`);
  }
}

async function saveMenu() {
  const slots = await game.save.list();
  const picked = await chooseFrom(slots.map((s) => ({
    ...s,
    label: s.empty ? `${s.label} ${c('grau', '(leer)')}` : `${s.label} ${c('grau', `Akt ${s.act}, Tag ${s.day}, ${s.quests} Quests`)}`
  })), { prompt: 'Archiv' });
  if (!picked) return;
  const mode = (await ask('(s)peichern oder (l)aden? > ')).trim().toLowerCase();
  if (mode.startsWith('s')) { await game.save.save(picked.slot); console.log(c('grau', '  Gespeichert.')); }
  else if (mode.startsWith('l')) {
    const result = await game.save.load(picked.slot);
    if (result.ok) { game.resume(); console.log(c('grau', '  Geladen.')); }
    else console.log(c('rot', '  ' + result.reason));
  }
}

async function finale() {
  if (game.store.s.player.act < 15) {
    console.log(c('grau', '  Dafür ist es noch zu früh. Es fehlt noch einiges.'));
    return;
  }
  const { monolog, ending } = game.finalMonolog();
  printMonolog(monolog);
  if (ending) {
    console.log(`\n  ${c('bold', 'ENDE ' + ending.code + ' — ' + ending.title)}`);
    console.log(`  ${ending.text}`);
    console.log(`\n  ${c('gelb', ending.epilog)}`);
  }
}

// --- Hauptschleife ------------------------------------------------------

console.log(c('bold', '\n  MIMON BARAKA UNIVERSE'));
console.log(c('grau', '  Ein fiktionales Satire-Adventure. Tippe die Zahl einer Aktion.\n'));

const MAIN_ACTIONS = [
  { id: 'umsehen', label: 'Umsehen' },
  { id: 'interagieren', label: 'Interagieren' },
  { id: 'reden', label: 'Jemanden ansprechen' },
  { id: 'gehen', label: 'Woanders hingehen' },
  { id: 'quests', label: 'Questlog' },
  { id: 'inventar', label: 'Inventar' },
  { id: 'kodex', label: 'Kodex' },
  { id: 'monolog', label: 'Mimonolog halten' },
  { id: 'warten', label: 'Warten (1 Stunde)' },
  { id: 'archiv', label: 'MIMON-ARCHIV (speichern/laden)' },
  { id: 'finale', label: 'Der letzte Mimonolog' },
  { id: 'ende', label: 'Beenden' }
];

let running = true;
while (running && !(closed && !lines.length)) {
  if (await handlePendingEvent()) continue;
  hud();

  const here = game.world.here;
  console.log(`  ${c('grau', here.description)}`);
  const npcs = game.world.npcsHere();
  if (npcs.length) console.log(`  ${c('grau', 'Hier: ' + npcs.map((n) => n.name).join(', '))}`);

  const picked = await chooseFrom(MAIN_ACTIONS, { prompt: 'Was tun', allowBack: false });
  switch (picked?.id) {
    case 'umsehen': {
      const log = game.store.s.log.slice(-6);
      for (const entry of log) console.log(`  ${c('grau', '· ' + entry.text)}`);
      break;
    }
    case 'interagieren': await interactMenu(); break;
    case 'reden': await talkMenu(); break;
    case 'gehen': await travelMenu(); break;
    case 'quests': await questMenu(); break;
    case 'inventar': inventarMenu(); break;
    case 'kodex': kodexMenu(); break;
    case 'monolog': {
      const topics = Object.entries(game.registry.topics).map(([id, t]) => ({ id, label: t.subject }));
      const topic = await chooseFrom(topics, { prompt: 'Worüber' });
      if (topic) printMonolog(game.monolog.generate({ topic: topic.id }));
      break;
    }
    case 'warten': game.clock.advance(60); break;
    case 'archiv': await saveMenu(); break;
    case 'finale': await finale(); break;
    case 'ende': running = false; break;
    default: break;
  }
}

console.log(c('grau', '\n  DIE NWO SIEHT ALLES.\n'));
rl.close();
