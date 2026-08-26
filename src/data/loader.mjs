/**
 * Plattformunabhängiger Datenlader.
 * Im Browser über fetch, in Node über fs — die Engine merkt keinen Unterschied.
 */

export const DATA_FILES = [
  'vocabulary', 'characters', 'nwo', 'locations', 'items', 'lore',
  'series', 'quests', 'dialogue', 'events', 'emails', 'alchemy',
  'media', 'endings', 'audio'
];

const isNode = typeof process !== 'undefined' && process.versions?.node;

export async function loadData({ baseUrl = '../../data/', files = DATA_FILES } = {}) {
  const entries = await Promise.all(files.map(async (name) => [name, await loadFile(baseUrl, name)]));
  return Object.fromEntries(entries);
}

async function loadFile(baseUrl, name) {
  if (isNode && !/^https?:/.test(baseUrl)) {
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const target = path.resolve(here, baseUrl, `${name}.json`);
    return JSON.parse(await readFile(target, 'utf8'));
  }
  const url = new URL(`${name}.json`, new URL(baseUrl, globalThis.location?.href ?? 'http://localhost/'));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Datendatei nicht ladbar: ${name}.json (${res.status})`);
  return res.json();
}
