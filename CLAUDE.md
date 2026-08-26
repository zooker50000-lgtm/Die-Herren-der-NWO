# Hinweise für die Arbeit an diesem Projekt

MIMON BARAKA UNIVERSE — fiktionales Satire-Adventure. Engine in reinem ESM,
**kein Build-Step, keine Runtime-Dependencies**. Dieselben `.mjs`-Dateien laufen
im Browser und in Node.

## Vor jeder Änderung

```bash
npm test           # 75 Tests, ~3 Sekunden
npm run validate   # Content-Datenbank auf Konsistenz
```

## Nach inhaltlichen Änderungen

```bash
npm run solve      # beweist, dass das Spiel noch durchspielbar ist
npm run contrast   # nur nach Änderungen an web/styles/main.css
```

`npm run solve` ist das wichtigste Werkzeug des Projekts. Es sucht zu jedem
offenen Questziel die passende Handlung und meldet, woran es hängt. Fast jeder
schwere Fehler in diesem Repo wurde damit gefunden, nicht durch Lesen.

## Regeln, die nicht gebrochen werden dürfen

1. **Kein hartcodierter Content.** Lore, Figuren, Quests, Dialoge, Orte, Items
   und Ereignisse leben ausschließlich in `data/*.json`.
2. **Jeder Eintrag braucht ein `layer`.** Siehe `docs/LORE_LAYERS.md`. Im
   Zweifel `FICTIONAL_GAME_CONTENT` — erfundenes wird nie zu Quellenlore.
3. **Keine Behauptungen über reale, namensgleiche Personen.** Keine privaten
   Daten. Keine realen chemischen Anleitungen in der Alchemie.
4. **ISLAMIMON und RECHTSEXTREMIMON zeigen die Methode, nie eine Position.**
   Die Satire zielt auf die Manipulatoren. Ein Test prüft das mit.
5. **Die Engine bleibt headless.** `src/` kennt kein DOM und keine Konsole.
6. **Ein Effekt-Format für alles** (`src/core/effects.mjs`), eine
   Bedingungsprüfung für alles (`src/core/conditions.mjs`).
7. **Wertegrenzen stehen in `STAT_BOUNDS`** (`src/core/state.mjs`) und werden
   im Store erzwungen. Statusänderungen meldet nur der Store.

## Häufige Fallen (alle schon einmal passiert)

* Ein neuer Dialog braucht `npc`, `channels`, `priority` und ggf. `requires` —
  sonst ist er nie erreichbar. Vor-Ort-Dialoge brauchen eine Figur, die auch an
  einem Ort steht.
* Questziele zählen Ereignisse. Wer den gesuchten Gegenstand schon vorher hat,
  könnte das Ziel nie erfüllen — dafür gibt es `QuestEngine.seedObjective()`.
* Verklemmungen: ein Ort darf nicht den Abschluss der Quest verlangen, die man
  dort erst erledigt. Ein Rezept muss freigeschaltet sein, bevor eine Quest
  seine Stufe verlangt.
* Jeder Gegenstand, den eine Quest verlangt, braucht eine Quelle im Spiel.
* Ortsverbindungen gelten beidseitig, aber trag sie trotzdem in beide Richtungen
  ein — der Validator warnt sonst.

## Sprache

Code-Kommentare, Commit-Nachrichten und Dokumentation auf Deutsch, passend zum
Projekt. Spieltext folgt `docs/CONTENT_GUIDE.md` — besonders die Regeln, wie
Mimon spricht und dass keine zwei Figuren gleich klingen.
