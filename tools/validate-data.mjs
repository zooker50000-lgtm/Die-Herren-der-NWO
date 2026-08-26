#!/usr/bin/env node
import { loadData } from '../src/data/loader.mjs';
import { validateData } from '../src/data/validate.mjs';

const data = await loadData();
const { ok, errors, warnings } = validateData(data);

for (const w of warnings) console.warn(`  warn  ${w}`);
for (const e of errors) console.error(`  FEHLER  ${e}`);

const counts = {
  Figuren: data.characters.characters.length,
  Quests: data.quests.quests.length,
  Dialoge: Object.keys(data.dialogue.dialogues).length,
  Orte: data.locations.locations.length,
  Items: data.items.items.length,
  'Lore-Einträge': data.lore.entries.length,
  Events: data.events.events.length,
  Episoden: data.series.series.reduce((n, s) => n + s.episodes.length, 0)
};
console.log('\n' + Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join('  |  '));
console.log(ok ? `\nDatenbank konsistent (${warnings.length} Hinweise).` : `\n${errors.length} Fehler.`);
process.exit(ok ? 0 : 1);
