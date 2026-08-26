/**
 * Die Bühne: der zentrale Bereich. Zeigt je nach Lage Szene, Dialog,
 * Mimonolog oder ein wartendes Ereignis.
 */
import { h, mount, layerTag } from './dom.mjs';

export function renderStage(root, game, ui) {
  const pending = game.events.view();
  if (pending) return renderEvent(root, game, ui, pending);
  if (game.dialogue.isOpen && ui.dialogueView) return renderDialogue(root, game, ui);
  if (ui.monolog) return renderMonolog(root, game, ui);
  return renderScene(root, game, ui);
}

function renderScene(root, game, ui) {
  const here = game.world.here;
  const npcs = game.world.npcsHere();
  const interactables = game.world.interactables();
  const labor = here?.id === 'nwo_labor';

  mount(root,
    h('div', { class: 'scene' },
      h('div', { class: 'scene__head' },
        h('h2', {}, here?.name ?? '—'),
        layerTag(here?.layer)
      ),
      h('p', { class: 'scene__text' }, here?.description ?? ''),

      npcs.length ? h('div', { class: 'scene__npcs' },
        h('h3', {}, 'Hier'),
        h('div', { class: 'chips' }, npcs.map((npc) =>
          h('button', {
            class: 'chip chip--npc',
            style: { '--chip-color': npc.color },
            onclick: () => ui.talkTo(npc.id)
          },
            h('span', { class: 'chip__name' }, npc.name),
            h('span', { class: 'chip__meta' }, `Vertrauen ${game.store.trust(npc.id, npc.trust)}`)
          )
        ))
      ) : null,

      h('div', { class: 'scene__actions' },
        h('h3', {}, 'Hier möglich'),
        h('div', { class: 'chips' },
          interactables.map((it) => h('button', { class: 'chip', onclick: () => ui.interact(it) }, it.label)),
          h('button', { class: 'chip chip--monolog', onclick: () => ui.toggleOverlay('monolog') },
            'Mimonolog halten',
            h('span', { class: 'chip__meta' }, game.meters.crashoutTier.label)),
          labor ? game.world.labAreas().map((area) => h('button', {
            class: `chip ${area.unlocked ? '' : 'chip--locked'}`,
            onclick: () => ui.enterLabArea(area.id)
          }, area.label, area.visited ? ' ✓' : '')) : null
        )
      ),

      h('div', { class: 'scene__exits' },
        h('h3', {}, 'Wege'),
        h('div', { class: 'chips' }, game.world.exits().map((exit) =>
          h('button', {
            class: `chip chip--exit ${exit.unlocked ? '' : 'chip--locked'}`,
            onclick: () => ui.travel(exit.id)
          }, exit.name, h('span', { class: 'chip__meta' }, exit.unlocked ? `${exit.minutes} Min.` : 'verschlossen'))
        ))
      )
    )
  );
}

function renderDialogue(root, game, ui) {
  const view = ui.dialogueView;
  const character = view.speaker && view.speaker !== 'mimon' ? game.registry.character(view.speaker) : null;

  mount(root,
    h('div', { class: 'dialogue' },
      h('div', { class: 'dialogue__speaker', style: { '--speaker-color': character?.color ?? 'var(--gold)' } },
        h('span', { class: 'dialogue__name' }, view.speakerName || 'Mimon'),
        character?.voice?.register ? h('span', { class: 'dialogue__voice' }, character.voice.register) : null
      ),
      view.monolog
        ? monologBlock(view.monolog)
        : h('p', { class: 'dialogue__line' }, view.text ?? ''),

      view.choices.length
        ? h('div', { class: 'choices' }, view.choices.map((choice) =>
            h('button', {
              class: `choice choice--${choice.tone} ${choice.available ? '' : 'choice--locked'}`,
              disabled: !choice.available,
              title: choice.available ? choice.preview.join(' · ') : choice.blockedBy.join(' · '),
              onclick: () => ui.choose(choice.index)
            },
              h('span', { class: 'choice__tone' }, choice.toneLabel),
              h('span', { class: 'choice__text' }, choice.text),
              choice.preview.length ? h('span', { class: 'choice__preview' }, choice.preview.join(' · ')) : null
            )
          ))
        : h('div', { class: 'choices' },
            h('button', { class: 'choice choice--continue', onclick: () => ui.continueDialogue() },
              view.canContinue ? 'Weiter' : 'Beenden')
          )
    )
  );
}

function renderMonolog(root, game, ui) {
  mount(root,
    h('div', { class: 'dialogue' },
      h('div', { class: 'dialogue__speaker', style: { '--speaker-color': 'var(--gold)' } },
        h('span', { class: 'dialogue__name' }, 'Mimon'),
        h('span', { class: 'dialogue__voice' }, `Mimonolog · ${ui.monolog.tier}`)
      ),
      monologBlock(ui.monolog),
      h('div', { class: 'choices' },
        h('button', { class: 'choice choice--continue', onclick: () => ui.closeMonolog() }, 'Fertig')
      )
    )
  );
}

export function monologBlock(monolog) {
  return h('div', { class: `monolog monolog--${monolog.tier}` },
    monolog.beats.map((beat, i) => h('p', {
      class: `monolog__beat monolog__beat--${beat.type.toLowerCase()}`,
      style: { animationDelay: `${i * 60}ms` }
    }, beat.text)),
    h('div', { class: 'monolog__meta' },
      `${monolog.meta.beatCount} Beats · ${monolog.meta.words} Wörter` +
      (monolog.meta.ehdzhusten ? ` · ${monolog.meta.ehdzhusten}× Ehdzhusten` : '') +
      (monolog.meta.digressions ? ` · ${monolog.meta.digressions} Abschweifungen` : '')
    )
  );
}

function renderEvent(root, game, ui, event) {
  mount(root,
    h('div', { class: 'event' },
      h('div', { class: 'event__head' }, h('h2', {}, event.title), layerTag(event.layer)),
      h('p', { class: 'event__text' }, event.text),
      h('div', { class: 'choices' }, event.choices.map((choice) =>
        h('button', { class: `choice choice--${choice.tone}`, onclick: () => ui.respondEvent(choice.index) },
          h('span', { class: 'choice__tone' }, choice.tone.replace('_', ' ')),
          h('span', { class: 'choice__text' }, choice.text)
        )
      ))
    )
  );
}
