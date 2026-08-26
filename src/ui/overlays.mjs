/** Overlays: NWO-Terminal, Kodex, Inventar, Alchemie, Karte, Figuren, Archiv. */
import { h, mount, num, layerTag } from './dom.mjs';

export function renderOverlay(root, game, ui) {
  if (!ui.overlay) { root.hidden = true; return; }
  root.hidden = false;
  const builder = {
    terminal, kodex, inventar, alchemie, karte, figuren, archiv, laden, monolog, telefon, ende
  }[ui.overlay];

  mount(root,
    h('div', { class: `overlay__panel overlay__panel--${ui.overlay}` },
      h('button', { class: 'overlay__close', onclick: () => ui.closeOverlay() }, '×'),
      builder ? builder(game, ui) : h('p', {}, '—')
    )
  );
}

// --- NWO-Terminal -------------------------------------------------------

function terminal(game, ui) {
  if (!game.nwo.terminalAvailable()) {
    return h('div', { class: 'terminal terminal--locked' },
      h('h2', {}, 'NWO TERMINAL'),
      h('p', {}, 'Kein Zugang. Die Struktur ist noch zu weit weg.'),
      h('p', { class: 'muted' }, `Zugang ab NWO INFLUENCE 40. Aktuell: ${Math.round(game.store.stat('nwoInfluence'))}.`)
    );
  }
  if (game.nwo.quizPending()) {
    const quiz = game.nwo.openQuiz();
    return h('div', { class: 'terminal' },
      h('h2', { class: 'terminal__greeting' }, quiz.intro),
      h('p', { class: 'terminal__frage' }, quiz.question),
      h('div', { class: 'choices' }, quiz.answers.map((a) =>
        h('button', { class: 'choice choice--continue', onclick: () => ui.answerQuiz(a.id) }, a.text)
      ))
    );
  }

  const section = ui.terminalSection ?? 'akten';
  const files = game.nwo.files(section);

  return h('div', { class: 'terminal' },
    h('h2', { class: 'terminal__greeting' }, 'DIE NWO SIEHT ALLES.'),
    h('div', { class: 'terminal__body' },
      h('nav', {}, game.nwo.sections().map((s) =>
        h('button', {
          class: `terminal__section ${section === s.id ? 'is-active' : ''} ${s.unlocked ? '' : 'is-locked'}`,
          onclick: () => ui.openTerminal(s.id)
        }, s.label, s.unlocked ? null : h('span', { class: 'muted' }, ` ${s.requiresInfluence}`))
      )),
      h('div', { class: 'terminal__content' },
        section === 'level' ? levelView(game) :
        section === 'personen' && !files.length ? structureView(game) :
        files.length ? files.map((file) => h('article', { class: `akte ${file.unlocked ? '' : 'akte--locked'}` },
          h('header', {}, file.title, layerTag(file.layer)),
          h('p', {}, file.unlocked ? file.body : `GESPERRT — Freigabe ab Einfluss ${file.requiresInfluence}.`)
        )) : h('p', { class: 'muted' }, 'Keine Einträge in dieser Sektion.')
      )
    )
  );
}

function levelView(game) {
  const tier = game.nwo.tier;
  return h('div', {},
    h('h3', {}, tier.label),
    h('p', {}, tier.description),
    h('p', { class: 'muted' }, `Agenten im Feld: ${tier.agents} · Ereignisdichte +${Math.round((tier.eventBoost ?? 0) * 100)}%`)
  );
}

function structureView(game) {
  const walk = (node) => h('li', { class: node.known ? '' : 'is-unknown' },
    node.known ? node.name : '???',
    node.children?.length ? h('ul', {}, node.children.map(walk)) : null
  );
  return h('div', {}, h('h3', {}, 'Struktur'), h('ul', { class: 'structure' }, walk(game.nwo.knownStructure())));
}

// --- Kodex --------------------------------------------------------------

function kodex(game) {
  const view = game.codex.view();
  const stats = game.codex.stats();
  return h('div', { class: 'kodex' },
    h('h2', {}, 'KODEX', h('span', { class: 'muted' }, ` ${stats.unlocked}/${stats.total}`)),
    Object.entries(view).map(([layer, entries]) =>
      entries.length ? h('section', {},
        h('h3', {}, layerTag(layer)),
        h('div', { class: 'kodex__grid' }, entries.map((entry) =>
          h('article', { class: `kodex__entry ${entry.unlocked ? '' : 'is-locked'}` },
            h('h4', {}, entry.unlocked ? entry.title : '???'),
            h('p', {}, entry.unlocked ? entry.description : 'Noch nicht entdeckt.'),
            entry.derivedFrom ? h('p', { class: 'muted' }, `abgeleitet aus: ${entry.derivedFrom}`) : null
          )
        ))
      ) : null
    ),
    h('section', {},
      h('h3', {}, 'Achievements'),
      h('div', { class: 'chips' }, game.registry.data.endings.achievements.map((a) => {
        const has = game.store.s.achievements.includes(a.id);
        return h('span', { class: `chip ${has ? 'chip--gold' : 'chip--locked'}` },
          has || !a.secret ? a.title : '???',
          h('span', { class: 'chip__meta' }, has ? a.description : a.secret ? 'geheim' : 'offen'));
      }))
    )
  );
}

// --- Inventar & Alchemie ------------------------------------------------

function inventar(game, ui) {
  const items = game.inventory.list();
  return h('div', { class: 'inventar' },
    h('h2', {}, 'INVENTAR'),
    h('div', { class: 'inventar__grid' }, items.map((item) =>
      h('article', { class: `item ${item.worn ? 'item--worn' : ''}` },
        h('header', {}, item.name, item.count > 1 ? h('span', { class: 'muted' }, ` ×${item.count}`) : null),
        h('p', {}, item.description ?? ''),
        h('footer', {},
          layerTag(item.layer),
          item.type === 'wearable' ? h('button', { class: 'button button--small', onclick: () => ui.useItem(item.id) }, item.worn ? 'getragen' : 'anziehen') : null,
          item.usable ? h('button', { class: 'button button--small', onclick: () => ui.useItem(item.id) }, item.type === 'document' ? 'lesen' : 'benutzen') : null
        )
      )
    ))
  );
}

function alchemie(game, ui) {
  const lab = game.alchemy.labLevel();
  const recipes = game.alchemy.knownRecipes();
  return h('div', { class: 'alchemie' },
    h('h2', {}, 'ALCHEMIE'),
    h('p', { class: 'muted' }, `Level ${game.store.stat('alchemy')} · ${Math.round(game.store.stat('alchemyXp'))}/${game.alchemy.xpForLevel(game.store.stat('alchemy'))} XP · Labor Stufe ${lab || '—'}`),
    h('div', { class: 'stages' }, game.alchemy.stages().map((stage) =>
      h('div', { class: `stage stage--${stage.id} ${stage.reached ? 'is-reached' : ''}` },
        h('strong', {}, stage.name),
        h('span', {}, stage.description)
      )
    )),
    h('h3', {}, 'Rezepte'),
    recipes.length ? h('div', { class: 'recipes' }, recipes.map((recipe) => {
      const check = game.alchemy.canBrew(recipe.id);
      return h('article', { class: `recipe ${check.ok ? 'is-ready' : ''}` },
        h('header', {}, recipe.name, layerTag(recipe.layer)),
        h('p', { class: 'recipe__flavor' }, recipe.flavor),
        h('p', { class: 'muted' }, recipe.ingredients.map((i) => game.registry.itemName(i)).join(' · ')),
        h('button', { class: 'button', disabled: !check.ok, onclick: () => ui.brew(recipe.id) }, check.ok ? 'Brauen' : check.reason)
      );
    })) : h('p', { class: 'muted' }, 'Keine Rezepte bekannt. Es fehlen die Bücher.')
  );
}

// --- Karte, Figuren, Archiv --------------------------------------------

function karte(game, ui) {
  return h('div', { class: 'karte' },
    h('h2', {}, 'KARTE'),
    game.world.map().map((region) =>
      h('section', {},
        h('h3', {}, region.name),
        h('div', { class: 'chips' }, region.locations.map((loc) =>
          h('button', {
            class: `chip ${loc.current ? 'chip--gold' : ''} ${loc.unlocked ? '' : 'chip--locked'} ${loc.visited ? '' : 'chip--unvisited'}`,
            onclick: () => ui.travel(loc.id)
          }, loc.name, h('span', { class: 'chip__meta' }, loc.current ? 'hier' : loc.unlocked ? (loc.visited ? 'bekannt' : 'unbekannt') : 'verschlossen'))
        ))
      )
    ),
    h('p', { class: 'muted' }, 'Reisen ist nur zu benachbarten Orten möglich.')
  );
}

function figuren(game, ui) {
  return h('div', { class: 'figuren' },
    h('h2', {}, 'FIGUREN'),
    h('div', { class: 'figuren__grid' }, game.roster.view().map((c) =>
      h('article', { class: `figur ${c.known ? '' : 'is-unknown'}`, style: { '--figur-color': c.color } },
        h('header', {}, c.known ? c.name : '???', layerTag(c.layer)),
        h('p', { class: 'figur__faction' }, c.factionName),
        h('p', {}, c.bio ?? 'Noch nicht begegnet.'),
        c.known ? h('div', { class: 'figur__trust' },
          h('span', { class: 'figur__bar' }, h('span', { style: { width: `${c.trust}%` } })),
          h('span', { class: 'muted' }, `Vertrauen ${c.trust}`)
        ) : null,
        c.known && c.traits.length ? h('div', { class: 'chips' }, c.traits.map((t) => h('span', { class: 'chip chip--tiny' }, t))) : null
      )
    ))
  );
}

function archiv(game, ui) {
  return h('div', { class: 'archiv-save' },
    h('h2', {}, 'MIMON-ARCHIV'),
    h('div', { class: 'slots' }, (ui.saveSlots ?? []).map((slot) =>
      h('article', { class: `slot ${slot.empty ? 'slot--empty' : ''}` },
        h('header', {}, slot.label),
        slot.empty
          ? h('p', { class: 'muted' }, 'leer')
          : h('p', {}, `Akt ${slot.act} · Tag ${slot.day} · ${slot.quests} Quests · REAL-AUTH ${slot.authenticity} · NWO ${slot.nwoInfluence}`),
        h('div', { class: 'slot__actions' },
          h('button', { class: 'button button--small', onclick: () => ui.saveTo(slot.slot) }, 'Speichern'),
          h('button', { class: 'button button--small', disabled: slot.empty, onclick: () => ui.loadFrom(slot.slot) }, 'Laden')
        )
      )
    )),
    h('p', { class: 'muted' }, 'Autosave nach jedem Fideo: FIDEO ARCHIVIERT.')
  );
}

function telefon(game, ui) {
  const kontakte = game.roster.reachableVia('telefon');
  return h('div', { class: 'telefon' },
    h('h2', {}, 'TELEFON'),
    kontakte.length
      ? h('div', { class: 'chips' }, kontakte.map((c) =>
          h('button', { class: 'chip chip--npc', style: { '--chip-color': c.color }, onclick: () => ui.talkTo(c.id, 'telefon') },
            h('span', { class: 'chip__name' }, c.name),
            h('span', { class: 'chip__meta' }, `Vertrauen ${c.trust}`))
        ))
      : h('p', { class: 'muted' }, 'Niemand, den man jetzt anrufen sollte.')
  );
}

function monolog(game, ui) {
  return h('div', { class: 'monolog-picker' },
    h('h2', {}, 'MIMONOLOG'),
    h('p', { class: 'muted' }, `Stufe: ${game.meters.crashoutTier.label}. Je höher der Crashout, desto länger und lauter wird es.`),
    h('div', { class: 'chips' }, Object.entries(game.registry.topics).map(([id, topic]) =>
      h('button', { class: 'chip', onclick: () => ui.showMonolog({ topic: id }) },
        topic.short,
        h('span', { class: 'chip__meta' }, topic.subject))
    ))
  );
}

function laden(game, ui) {
  const shop = game.world.shop(ui.shopId);
  if (!shop) return h('p', {}, 'Geschlossen.');
  const mett = Math.round(game.store.stat('mett'));
  return h('div', { class: 'laden' },
    h('h2', {}, shop.name.toUpperCase()),
    h('p', { class: 'muted' }, `Du hast ${num(mett)} Mett.`),
    h('div', { class: 'laden__grid' }, shop.stock.map((entry) =>
      h('article', { class: `ware ${mett >= entry.price ? '' : 'ware--zu_teuer'}` },
        h('header', {}, entry.name, h('span', { class: 'ware__preis' }, `${entry.price} Mett`)),
        h('p', {}, entry.description ?? ''),
        h('button', {
          class: 'button button--small',
          disabled: mett < entry.price,
          onclick: () => ui.buy(entry.id)
        }, mett >= entry.price ? 'Kaufen' : 'Zu wenig Mett')
      )
    ))
  );
}

function ende(game) {
  const ending = game.registry.endings.get(game.store.s.ending);
  if (!ending) return h('p', {}, 'Noch kein Ende.');
  return h('div', { class: 'ende' },
    h('h2', {}, `ENDE ${ending.code} — ${ending.title}`),
    h('p', { class: 'ende__text' }, ending.text),
    h('p', { class: 'ende__epilog' }, ending.epilog),
    h('p', { class: 'muted' }, `Abonnenten: ${num(game.store.stat('subscribers'))} · Kodex: ${game.codex.stats().percent}% · Mimonologe: ${game.store.s.counters.monologs}`)
  );
}
