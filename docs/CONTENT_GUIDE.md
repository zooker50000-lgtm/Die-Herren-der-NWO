# Content-Guide

Wie neuer Content geschrieben wird, damit sich die Welt konsistent anfuehlt.

## Das Wichtigste zuerst

Die Welt nimmt sich **selbst ernst**. Der Humor entsteht aus der Absurditaet der
Situationen und der Figuren — nicht daraus, dass das Spiel seine eigene Fiktion
erklaert. Keine Augenzwinkern-Kommentare, keine Meta-Hinweise im Spieltext.

## Wie Mimon spricht

Mimon spricht nicht in NPC-Saetzen. Rhythmusregeln:

* Er **bestaetigt zuerst**, dann kommt der Inhalt: "JA. JA, NATUERLICH."
* Er verschiebt jede konkrete Frage auf die **Bedeutungsebene**:
  "Das ist ja das Interessante an der ganzen Geschichte."
* Er stellt seine eigene Frage, statt zu antworten:
  "Dann muss man sich doch fragen: WARUM?"
* Er **korrigiert sich selbst** und faengt neu an: "Nein. Moment. Falsch."
* Er kehrt zum Thema zurueck und markiert es: "Wo war ich? GENAU."
* Er **belegt** mit eigenem Material: Fideos, Tagebuch, Aufnahmen.
* Er hat immer eine **groessere Struktur** im Blick, in die das Detail passt.
* Er **gibt kurz nach** und nimmt es sofort zurueck: "Ja, gut, das kann man so
  sehen. Aber." Das ist der Beat `KONZESSION` — er macht den Monolog
  glaubwuerdiger als reines Dagegenhalten.

Was Mimon **nicht** tut: kurze Antworten geben, Ironie ueber sich selbst,
moderne Netzsprache, Zustimmung ohne Einschraenkung.

## Neue Beat-Vorlagen

Die Vorlagen stehen in `data/vocabulary.json` unter `beats`, getrennt nach
Stufe (`calm`, `annoyed`, `loud`). Regeln:

* Jede Stufe braucht **mindestens drei** Vorlagen pro Beat, sonst faellt die
  Wiederholung im Spiel auf. Ein Test prueft das.
* Ein neuer Beat-Typ muss in `flow.<stufe>.transitions` als Ziel auftauchen,
  sonst wird er nie gespielt — auch das prueft ein Test.
* Die Stufe entscheidet ueber den Ton, nicht ueber den Inhalt: derselbe Beat
  sagt in `calm` und `loud` dasselbe, nur anders laut.
* Platzhalter am Satzanfang werden automatisch grossgeschrieben; nach einem
  Doppelpunkt bleibt es klein. Die Vorlage muss sich darum nicht kuemmern.

## Vokabular

`data/vocabulary.json` ist die einzige Quelle fuer Mimons Begriffe. Jeder Eintrag
hat `contexts` (wann passt der Begriff?), `weight` und `cooldown`.

**Begriffe werden nicht gespammt.** Der Generator setzt einen Begriff nur ein,
wenn seine Kontext-Tags zum Thema passen, und sperrt ihn danach fuer `cooldown`
Beats. Wer einen neuen Begriff hinzufuegt, gibt ihm ehrliche Kontext-Tags — ein
Begriff mit `contexts: ["*"]` wird abgelehnt.

## Jede Figur klingt anders

Keine zwei NPCs benutzen dieselben Satzmuster. In `data/characters.json` hat jede
Figur `voice`:

```jsonc
"voice": {
  "register": "trocken",           // Grundton
  "sentenceLength": "kurz",        // kurz | mittel | lang | wechselnd
  "tics": ["Junge,", "hm."],       // wiederkehrende Marker
  "avoids": ["nwo_jargon"],        // was diese Figur nie sagt
  "addressesMimon": "Simon"        // wie sie Mimon anspricht
}
```

Mamer ist **keine dumme Nebenfigur**. Sie ist nuechtern, hat eigene Urteile,
widerspricht mit Gruenden und weiss Dinge, die Mimon nicht weiss.

## Wo Grenzen liegen

* Keine Behauptungen ueber reale, namensgleiche Personen.
* Keine privaten Daten, keine Adressen, keine Klarnamen ausserhalb der Spielwelt.
* Keine realen chemischen Anleitungen. Alchemie ist symbolisch: Kelche,
  Essenzen, Planetenzeichen, Farbstufen.
* Die Arcs ISLAMIMON und RECHTSEXTREMIMON handeln davon, **wie Mimon manipuliert
  wird** — die Satire zielt auf die Manipulatoren. Kein Eintrag reproduziert
  extremistische oder herabwuerdigende Inhalte; Ideologie erscheint nur als
  das, was Trolle Mimon einfluestern, und wird im Arc als Manipulation entlarvt.
* Geruechte werden nie als Tatsachen dargestellt.

## Checkliste vor dem Commit

- [ ] `layer` gesetzt und ehrlich gewaehlt (siehe `docs/LORE_LAYERS.md`)
- [ ] `id` ist `snake_case` und eindeutig
- [ ] Alle `requires`-Referenzen existieren
- [ ] Alle `effects`-Ziele existieren (Items, Quests, Lore, Charaktere)
- [ ] Neue Figur hat `voice` und klingt nicht wie eine bestehende
- [ ] `npm run validate` und `npm test` laufen durch
