/** Minimale DOM-Helfer. Kein Framework, keine Abhängigkeiten. */

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'html') el.innerHTML = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(3)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

export function mount(node, ...children) { clear(node).append(...children.flat(3).filter(Boolean)); return node; }

export function $(selector, root = document) { return root.querySelector(selector); }

/** Nummer mit deutscher Tausendertrennung. */
export function num(value) { return Math.round(value ?? 0).toLocaleString('de-DE'); }

/** Meter-Balken als Element. */
export function meter(label, value, max, variant) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  return h('div', { class: `meter meter--${variant}` },
    h('span', { class: 'meter__label' }, label),
    h('span', { class: 'meter__track' }, h('span', { class: 'meter__fill', style: { width: `${percent}%` } })),
    h('span', { class: 'meter__value' }, num(value))
  );
}

/** Kleines Etikett, z. B. für Lore-Layer. */
export function tag(text, kind = '') {
  return h('span', { class: `tag ${kind ? 'tag--' + kind : ''}` }, text);
}

export function layerTag(layer) {
  const short = {
    SOURCE_BASED_LORE: 'QUELLE',
    IN_UNIVERSE_AUDIO_LORE: 'HÖRSPIEL',
    MEME_LORE: 'MEME',
    FICTIONAL_GAME_CONTENT: 'SPIEL'
  }[layer] ?? layer;
  return tag(short, layer?.toLowerCase());
}

/** Einfacher Debouncer für Neuzeichnungen. */
export function debounce(fn, ms = 16) {
  let handle = null;
  return (...args) => {
    if (handle) cancelAnimationFrame(handle);
    handle = requestAnimationFrame(() => { handle = null; fn(...args); });
  };
}
