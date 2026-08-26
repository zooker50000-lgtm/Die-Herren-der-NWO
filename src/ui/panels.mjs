/** Seitenspalte: Questlog und Weltprotokoll. */
import { h, mount, layerTag } from './dom.mjs';

export function renderQuests(root, game, ui) {
  const journal = game.quests.journal();
  mount(root,
    h('h3', { class: 'panel__title' }, 'Quests', h('span', { class: 'panel__count' }, journal.active.length)),
    h('div', { class: 'quests' },
      journal.active.length ? journal.active.map((quest) =>
        h('article', { class: `quest quest--${quest.type}` },
          h('header', {},
            h('span', { class: 'quest__title' }, quest.title),
            layerTag(quest.layer)
          ),
          h('p', { class: 'quest__summary' }, quest.summary),
          h('ul', { class: 'quest__objectives' }, quest.objectives.map((o) =>
            h('li', { class: o.done ? 'is-done' : '' },
              h('span', { class: 'quest__mark' }, o.done ? '✓' : '·'),
              o.text,
              o.needed > 1 ? h('span', { class: 'quest__progress' }, `${o.count}/${o.needed}`) : null
            )
          ))
        )
      ) : h('p', { class: 'muted' }, 'Nichts offen. Das ist selten und meistens kurz.'),

      journal.available.length
        ? h('div', { class: 'quests__available' },
            h('h4', {}, 'Verfügbar'),
            journal.available.map((q) => h('button', { class: 'chip chip--quest', onclick: () => ui.startQuest(q.id) }, q.title))
          )
        : null
    )
  );
}

export function renderLog(root, game) {
  const entries = game.store.s.log.slice(-40).reverse();
  mount(root,
    h('h3', { class: 'panel__title' }, 'Protokoll'),
    h('div', { class: 'log' }, entries.map((entry) =>
      h('p', { class: `log__line log__line--${entry.kind}` },
        h('span', { class: 'log__time' }, `T${entry.day}`),
        entry.text
      )
    ))
  );
}
