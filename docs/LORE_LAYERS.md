# Lore-Layer

Jeder Content-Eintrag in `data/` traegt ein Pflichtfeld `layer`. Die Layer duerfen
inhaltlich nicht vermischt werden — sie beantworten die Frage "woher stammt das?".

| Layer | Bedeutung | Beispiel |
|---|---|---|
| `SOURCE_BASED_LORE` | Aus der dokumentierten Chronik uebernommen. Wird nicht ausgeschmueckt. | Die Catchphrase "DIE NWO SIEHT ALLES", die vier NWO-Productions-Serien und ihre Episodenzahlen. |
| `IN_UNIVERSE_AUDIO_LORE` | Inhalt der Hoerspiele. Gilt im Spiel als wahr, ausserhalb als Hoerspiel. | Episodenhandlungen von ALCHEMIMON und BAPHOMIMON. |
| `MEME_LORE` | Meme-/Fan-Ebene. Wird als Meme behandelt, nicht als Ereignis. | Dromedar, Kelchninja, "Genau genau genau". |
| `FICTIONAL_GAME_CONTENT` | Fuer dieses Spiel erfunden. Alles, was Gameplay braucht, aber nicht belegt ist. | Questabläufe, Laborräume, NPC-Nebendialoge, Rezepte. |

## Regeln

1. **Im Zweifel `FICTIONAL_GAME_CONTENT`.** Nichts wird zu "offizieller Lore"
   befoerdert, nur weil es gut klingt.
2. **Layer wandern nicht nach oben.** Ein erfundener Eintrag wird niemals
   nachtraeglich zu `SOURCE_BASED_LORE`.
3. **`SOURCE_BASED_LORE` wird nicht erweitert.** Wer ein Detail hinzudichtet,
   legt einen neuen Eintrag als `FICTIONAL_GAME_CONTENT` an und verlinkt per
   `derivedFrom` auf den Quelleintrag.
4. **Keine realen Behauptungen.** Kein Eintrag stellt Behauptungen ueber reale,
   namensgleiche Personen auf. Keine privaten Daten, keine Geruechte als Fakten.
5. **Memes bleiben Memes.** `MEME_LORE` wird nie als historisches Ereignis
   dargestellt — im Spiel taucht es als Meme, Poster, Achievement oder
   Ladebildschirm auf.

## Im Code

`src/lore/codex.mjs` gruppiert nach Layer, und die UI zeigt den Layer im Kodex
als kleines Etikett. `npm run validate` schlaegt fehl bei fehlendem oder
unbekanntem Layer und bei einem `derivedFrom`, das ins Leere zeigt.

`npm run lore` gibt die Verteilung ueber alle Layer aus.
