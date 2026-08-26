#!/usr/bin/env node
/**
 * Lore-Report: zeigt, wie sich der Content über die vier Layer verteilt und
 * wie nah die Inhaltsmischung am Balance-Ziel aus docs/GAME_DESIGN.md liegt.
 */
import { loadData } from '../src/data/loader.mjs';
import { LAYERS } from '../src/data/validate.mjs';

const data = await loadData();

const groups = [
  ['Lore-Einträge', data.lore.entries],
  ['Figuren', data.characters.characters],
  ['Quests', data.quests.quests],
  ['Items', data.items.items],
  ['Orte', data.locations.locations],
  ['Events', data.events.events],
  ['Serien', data.series.series],
  ['Rezepte', data.alchemy.recipes],
  ['Enden', data.endings.endings]
];

const pad = (text, width) => String(text).padEnd(width);
const kurz = { SOURCE_BASED_LORE: 'QUELLE', IN_UNIVERSE_AUDIO_LORE: 'HÖRSPIEL', MEME_LORE: 'MEME', FICTIONAL_GAME_CONTENT: 'SPIEL' };

console.log('\nLORE-LAYER\n');
console.log(pad('', 16) + LAYERS.map((l) => pad(kurz[l], 10)).join('') + 'gesamt');

const total = Object.fromEntries(LAYERS.map((l) => [l, 0]));
for (const [name, list] of groups) {
  const counts = Object.fromEntries(LAYERS.map((l) => [l, list.filter((e) => e.layer === l).length]));
  for (const l of LAYERS) total[l] += counts[l];
  console.log(pad(name, 16) + LAYERS.map((l) => pad(counts[l] || '·', 10)).join('') + list.length);
}
console.log(pad('SUMME', 16) + LAYERS.map((l) => pad(total[l], 10)).join('') + Object.values(total).reduce((a, b) => a + b, 0));

// --- Inhaltsmischung gegen das Balance-Ziel ------------------------------

const ZIEL = { story: 40, welt: 20, dialog: 15, nwo: 10, memes: 10, easter_eggs: 5 };
const questTyp = { main: 'story', mamer: 'story', nwo: 'nwo', heeter: 'story', alchemie: 'story', mett: 'memes', crashout: 'memes', easter_egg: 'easter_eggs' };

const gewicht = { story: 0, welt: 0, dialog: 0, nwo: 0, memes: 0, easter_eggs: 0 };
for (const q of data.quests.quests) gewicht[questTyp[q.type] ?? 'story'] += 2;
gewicht.welt += data.locations.locations.length * 2;
gewicht.dialog += Object.values(data.dialogue.dialogues).reduce((n, d) => n + Object.keys(d.nodes).length, 0) * 0.4;
gewicht.dialog += Object.keys(data.vocabulary.topics).length;
gewicht.nwo += data.nwo.terminal.files.length + data.nwo.factions.length;
gewicht.memes += data.lore.entries.filter((e) => e.layer === 'MEME_LORE').length * 2;
gewicht.easter_eggs += data.endings.achievements.filter((a) => a.secret).length * 2;

const summe = Object.values(gewicht).reduce((a, b) => a + b, 0);
console.log('\nINHALTSMISCHUNG (Ziel laut docs/GAME_DESIGN.md)\n');
for (const [bereich, ziel] of Object.entries(ZIEL)) {
  const ist = Math.round((gewicht[bereich] / summe) * 100);
  const balken = '█'.repeat(Math.round(ist / 2)).padEnd(25, '░');
  const abweichung = ist - ziel;
  console.log(`${pad(bereich, 14)}${balken} ${String(ist).padStart(3)}%  Ziel ${String(ziel).padStart(2)}%  ${abweichung > 0 ? '+' : ''}${abweichung}`);
}

// --- Spielbarkeit der Serien --------------------------------------------

console.log('\nSERIEN\n');
const questIds = new Set(data.quests.quests.map((q) => q.id));
for (const s of data.series.series) {
  const spielbar = s.episodes.filter((e) => e.quest && questIds.has(e.quest)).length;
  console.log(`${pad(s.title, 20)} ${String(spielbar).padStart(2)}/${s.episodeCount} Episoden mit Quest`);
}
console.log('');
