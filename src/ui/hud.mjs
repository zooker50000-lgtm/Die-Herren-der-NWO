/** Kopfzeile: Uhrzeit, Akt, Ort und die vier Meter. */
import { h, mount, meter, num } from './dom.mjs';

export function renderHud(root, game) {
  const s = game.snapshot();
  const m = s.meters;

  document.body.dataset.crashout = m.crashout.tier.id;
  document.body.dataset.nwo = m.nwo.tier.id;

  mount(root,
    h('div', { class: 'hud__identity' },
      h('h1', {}, 'MIMON BARAKA'),
      h('div', { class: 'hud__sub' },
        h('span', {}, s.time),
        h('span', { class: 'hud__dot' }, '·'),
        h('span', {}, `AKT ${s.act.n}: ${s.act.title}`),
        h('span', { class: 'hud__dot' }, '·'),
        h('span', { class: 'hud__place' }, s.location.name)
      )
    ),
    h('div', { class: 'hud__meters' },
      meter('REAL-AUTHENTISCH', m.authenticity.value, 100, 'auth'),
      meter('CRASHOUT', m.crashout.value, 100, 'crashout'),
      meter('NWO TRUST', m.nwo.value, 100, 'nwo'),
      meter('METT', Math.min(m.mett.value, 3000), 3000, 'mett')
    ),
    h('div', { class: 'hud__tiers' },
      h('span', { class: 'hud__tier hud__tier--auth' }, m.authenticity.tier.label),
      h('span', { class: 'hud__tier hud__tier--crashout' }, m.crashout.tier.label),
      h('span', { class: 'hud__tier hud__tier--nwo' }, m.nwo.tier.label),
      h('span', { class: 'hud__tier' }, `${num(m.mett.value)} METT`),
      h('span', { class: 'hud__tier hud__tier--muted' }, `${num(m.subscribers)} Abos`),
      h('span', { class: 'hud__tier hud__tier--muted' }, `Überwachung: ${m.surveillance.label}`)
    )
  );
}
