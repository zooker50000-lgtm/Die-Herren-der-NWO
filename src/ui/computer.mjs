/**
 * Der Computer als eigenes Minispiel: JUHTUB, HEET-MEHL, NWO MAIL,
 * BARAKA-ARCHIV, NWO PRODUCTIONS, KOMMENTARE.
 */
import { h, mount, num, layerTag } from './dom.mjs';

export const APPS = [
  { id: 'juhtub', label: 'JUHTUB' },
  { id: 'heet_mehl', label: 'HEET-MEHL' },
  { id: 'nwo_mail', label: 'NWO MAIL' },
  { id: 'archiv', label: 'BARAKA-ARCHIV' },
  { id: 'productions', label: 'NWO PRODUCTIONS' },
  { id: 'kommentare', label: 'KOMMENTARE' }
];

export function renderComputer(root, game, ui) {
  const app = ui.computerApp ?? 'juhtub';
  const unread = game.emails.unreadCount();

  mount(root,
    h('div', { class: 'computer' },
      h('nav', { class: 'computer__nav' }, APPS.map((entry) =>
        h('button', {
          class: `computer__app ${app === entry.id ? 'is-active' : ''}`,
          onclick: () => ui.openComputer(entry.id)
        },
          entry.label,
          entry.id === 'heet_mehl' && unread ? h('span', { class: 'badge' }, unread) : null
        )
      )),
      h('div', { class: 'computer__screen' }, appBody(app, game, ui))
    )
  );
}

function appBody(app, game, ui) {
  switch (app) {
    case 'juhtub': return juhtub(game, ui);
    case 'heet_mehl': return postfach(game, ui, 'heet_mehl');
    case 'nwo_mail': return postfach(game, ui, 'nwo');
    case 'archiv': return archiv(game);
    case 'productions': return productions(game);
    case 'kommentare': return kommentare(game, ui);
    default: return h('p', {}, '—');
  }
}

// --- JUHTUB -------------------------------------------------------------

function juhtub(game, ui) {
  const draft = ui.fideoDraft;
  return h('div', { class: 'juhtub' },
    h('section', { class: 'produce' },
      h('h3', {}, 'Neues Fideo'),
      h('label', {}, 'Titel',
        h('input', {
          type: 'text', value: draft.title, placeholder: '(leer = automatischer Titel)',
          oninput: (e) => { draft.title = e.target.value; }
        })
      ),
      h('div', { class: 'produce__row' },
        h('label', {}, 'Thema',
          h('select', { onchange: (e) => { draft.topic = e.target.value; ui.render(); } },
            game.fideos.topics().map((t) => h('option', { value: t.id, selected: draft.topic === t.id }, t.label))
          )
        ),
        h('label', {}, 'Länge',
          h('select', { onchange: (e) => { draft.length = e.target.value; ui.render(); } },
            game.fideos.lengths().map((l) => h('option', { value: l.id, selected: draft.length === l.id }, l.label))
          )
        )
      ),
      h('label', {}, `Wut: ${draft.anger}`,
        h('input', {
          type: 'range', min: '0', max: '100', value: String(draft.anger),
          oninput: (e) => { draft.anger = Number(e.target.value); ui.renderComputerOnly(); }
        })
      ),
      h('label', { class: 'checkbox' },
        h('input', { type: 'checkbox', checked: draft.evidence, onchange: (e) => { draft.evidence = e.target.checked; } }),
        'Mit Belegen (Screenshots, Zeitstempel, Archiv)'
      ),
      h('p', { class: 'produce__hint' }, hintFor(draft)),
      h('button', { class: 'button button--gold', onclick: () => ui.publishFideo() }, 'Veröffentlichen')
    ),
    h('section', { class: 'library' },
      h('h3', {}, 'Auf Juhtub'),
      game.fideos.library().slice().reverse().map((f) =>
        h('article', { class: `fideo ${f.own ? 'fideo--own' : ''}`, onclick: () => ui.watchFideo(f.id) },
          h('span', { class: 'fideo__title' }, f.title),
          h('span', { class: 'fideo__meta' }, `${num(f.views)} Aufrufe · ${f.uploader === 'mimon_baraka' ? 'du' : game.registry.characterName(f.uploader) || f.uploader}`),
          f.description ? h('span', { class: 'fideo__desc' }, f.description) : null
        )
      )
    )
  );
}

function hintFor(draft) {
  if (draft.evidence && draft.anger < 40) return 'Ruhig und belegt: wenig Mett, stabiler Ruf, die Organisation merkt es trotzdem.';
  if (draft.anger > 70 && !draft.evidence) return 'Viel Wut, keine Belege: viel Mett, viel Reichweite, danach viel Post.';
  if (draft.anger > 70 && draft.evidence) return 'Laut und belegt. Beides geht, aber es kostet Nerven.';
  return 'Solide. Wird gesehen, aber niemand redet danach darüber.';
}

// --- Postfach -----------------------------------------------------------

function postfach(game, ui, channel) {
  const mails = game.emails.inbox.filter((m) => m.channel === channel);
  const open = ui.openMail && mails.find((m) => m.id === ui.openMail);

  return h('div', { class: 'mailbox' },
    h('div', { class: 'mailbox__list' },
      mails.length ? mails.map((mail) =>
        h('button', {
          class: `mail ${mail.read ? '' : 'mail--unread'} ${open?.id === mail.id ? 'is-active' : ''}`,
          onclick: () => ui.readMail(mail.id)
        },
          h('span', { class: 'mail__from' }, mail.fromName),
          h('span', { class: 'mail__subject' }, mail.subject),
          h('span', { class: 'mail__day' }, `Tag ${mail.day}`)
        )
      ) : h('p', { class: 'muted' }, channel === 'nwo' ? 'Keine Nachrichten. Das heißt nichts.' : 'Keine Heet-Mehls. Noch nicht.')
    ),
    open ? h('div', { class: 'mailbox__reader' },
      h('header', {},
        h('strong', {}, open.fromName),
        h('span', { class: 'muted' }, open.subject),
        layerTag(open.layer)
      ),
      h('p', { class: 'mail__body' }, open.body),
      h('div', { class: 'mail__actions' },
        game.emails.actions().map((action) =>
          h('button', { class: 'button', title: action.note, onclick: () => ui.handleMail(open.id, action.id) }, action.label)
        ),
        confrontable(game, open)
          ? h('button', { class: 'button button--gold', onclick: () => ui.confrontSender(open.id) }, 'Zur Rede stellen')
          : null
      )
    ) : null
  );
}

/** Lässt sich der Absender dieser Nachricht direkt ansprechen? */
function confrontable(game, mail) {
  const heeter = game.registry.heeters.get(mail.from);
  return Boolean(heeter?.character && game.roster.dialogueFor(heeter.character, { channel: 'online' }));
}

// --- Archiv, Serien, Kommentare ----------------------------------------

function archiv(game) {
  const pages = game.inventory.tagebuch();
  return h('div', { class: 'archiv' },
    h('h3', {}, 'Magisches Tagebuch', h('span', { class: 'muted' }, ` ${pages.filter((p) => p.found).length}/${pages.length}`)),
    h('div', { class: 'pages' }, pages.map((page) =>
      h('article', { class: `page ${page.found ? '' : 'page--missing'}` },
        h('header', {}, page.title, layerTag(page.layer)),
        h('p', {}, page.found ? page.text : '— fehlt —')
      )
    )),
    h('h3', {}, 'Eigene Fideos'),
    h('ul', { class: 'plain' }, game.store.s.media.published.map((f) =>
      h('li', {}, `${f.title} — ${num(f.reach)} Aufrufe, Tag ${f.day}`)
    ))
  );
}

function productions(game) {
  return h('div', { class: 'series' }, game.codex.series().map((s) =>
    h('article', { class: 'serie' },
      h('header', {},
        h('h3', {}, s.title),
        h('span', { class: 'muted' }, `${s.episodeCount} Episoden · ${s.done}/${s.playable} gespielt`),
        layerTag(s.layer)
      ),
      h('p', { class: 'serie__logline' }, s.logline),
      s.contentNote ? h('p', { class: 'serie__note' }, s.contentNote) : null,
      h('ol', { class: 'episodes' }, s.episodes.map((ep) =>
        h('li', { class: ep.done ? 'is-done' : ep.quest ? 'is-playable' : '' },
          h('span', { class: 'episodes__n' }, String(ep.n).padStart(2, '0')),
          h('span', { class: 'episodes__title' }, ep.title),
          h('span', { class: 'episodes__summary' }, ep.summary ?? '')
        )
      ))
    )
  ));
}

function kommentare(game, ui) {
  const comments = game.store.s.media.comments.slice(-40).reverse();
  return h('div', { class: 'comments' },
    h('button', { class: 'button', onclick: () => ui.analyzeComments() }, 'Kommentare durchgehen'),
    comments.length ? comments.map((comment) =>
      h('p', { class: `comment comment--${comment.kind}` },
        h('span', { class: 'comment__author' }, comment.author),
        comment.text
      )
    ) : h('p', { class: 'muted' }, 'Noch nichts. Kein Fideo, keine Kommentare.')
  );
}
