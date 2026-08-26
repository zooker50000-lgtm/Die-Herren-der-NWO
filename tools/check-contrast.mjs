#!/usr/bin/env node
/**
 * Prueft die Farbtokens gegen WCAG AA (4.5:1) auf allen Hintergruenden und
 * schlaegt aufgehellte Werte vor, wenn ein Paar durchfaellt.
 */
import { readFileSync } from 'node:fs';
const css = readFileSync('web/styles/main.css', 'utf8');
// Nur der :root-Block - spaetere Bloecke ueberschreiben nur Zustaende.
const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
const T = Object.fromEntries([...root.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6});/g)].map(m => [m[1], m[2]]));

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const rgb = (hex) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const lum = (hex) => { const [r, g, b] = rgb(hex); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const hex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

/** Aufhellen, bis das Verhaeltnis passt - Farbton bleibt erhalten. */
function aufhellen(farbe, hintergrund, ziel) {
  let c = rgb(farbe);
  for (let i = 0; i < 60 && ratio(hex(c), hintergrund) < ziel; i++) {
    c = c.map(v => v + (255 - v) * 0.04);
  }
  return hex(c);
}

const paare = [
  ['text', 'bg'], ['text', 'bg-2'], ['text', 'bg-3'],
  ['muted', 'bg'], ['muted', 'bg-2'], ['muted', 'bg-3'],
  ['gold', 'bg-2'], ['gold', 'bg-3'], ['red', 'bg-2'], ['red', 'bg-3'],
  ['blue', 'bg-2'], ['blue', 'bg-3'], ['green', 'bg-2'], ['violet', 'bg-2'], ['violet', 'bg-3']
];
const ZIEL = 4.5;
const vorschlaege = new Map();
for (const [vg, hg] of paare) {
  const r = ratio(T[vg], T[hg]);
  const ok = r >= ZIEL;
  if (!ok) {
    const besser = aufhellen(T[vg], T[hg], ZIEL);
    const alt = vorschlaege.get(vg);
    if (!alt || lum(besser) > lum(alt)) vorschlaege.set(vg, besser);
  }
  console.log(`${ok ? 'OK  ' : 'FAIL'} --${vg.padEnd(7)} auf --${hg.padEnd(5)} ${T[vg]}/${T[hg]}  ${r.toFixed(2)}:1`);
}
if (vorschlaege.size) {
  console.log('\nVorschlaege:');
  for (const [token, farbe] of vorschlaege) {
    console.log(`  --${token}: ${T[token]} -> ${farbe}   (${paare.filter(([v]) => v === token).map(([, h]) => ratio(farbe, T[h]).toFixed(2)).join(', ')})`);
  }
  process.exit(1);
}
console.log('\nAlle Paare erfuellen WCAG AA.');
