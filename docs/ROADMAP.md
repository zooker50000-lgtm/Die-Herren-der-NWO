# Roadmap

Die Phasen folgen der Entwicklungsprioritaet aus dem Design-Auftrag.

## Phase 1 - Prototyp  (Status: umgesetzt)

Mimon, Wohnung, Computer, Heet-Mehl, Dialogsystem, Mimonolog-Generator,
Crashout-Meter, NWO-System, Speichern.

## Phase 2 - Welt & Figuren  (Status: umgesetzt)

Open World mit Locationgraph, NPCs mit eigenen Stimmen, Polizei, Mamer, Hatebox,
NWO Productions, Quest-Engine mit Objectives und Requirements.

## Phase 3 - Alchemie & Labor  (Status: umgesetzt)

ALCHEMIMON als Story-Arc, Alchemie-Skill mit Rezepten und Laborstufen,
NWO-Labor als Endgame-Ort, Magisches Tagebuch als Sammelsystem, NWO-Terminal.

## Phase 4 - Die spaeten Arcs  (Status: Gerueste + Kernmissionen)

ISLAMIMON, RECHTSEXTREMIMON, BAPHOMIMON, Operation Hades, Pressesprecher,
Fenster. Struktur, Episodenliste und Kernquests stehen; die vollstaendige
Episoden-Ausarbeitung ist der naechste inhaltliche Schritt.

## Phase 5 - Feinschliff  (Status: teilweise)

Easter Eggs (umgesetzt), geheime Enden (umgesetzt), dynamische Ereignisse
(umgesetzt), Sounddesign (synthetisiertes Soundboard umgesetzt, gesampelte
Assets offen), Performance und UI/UX-Politur (laufend).

## Gemessener Stand

`npm run lore` und `npm run solve` liefern die Zahlen, nicht das Bauchgefuehl:

| Kennzahl | Stand |
|---|---|
| Quests | 47, davon 43-44 in einem Durchlauf abschliessbar |
| Dialoge | 32 Graphen, alle ueber einen Kanal erreichbar |
| Episoden | 51 gelistet, 27 mit eigener Quest |
| Orte | 16, alle von Mimons Wohnung aus erreichbar |
| Durchspielbarkeit | Akt 15 und ein Ende, geprueft ueber drei Seeds |

## Naechste konkrete Schritte

1. Restliche 24 Episoden als Quests ausformulieren — ALCHEMIMON und BAPHOMIMON
   sind weitgehend bespielbar, ISLAMIMON und RECHTSEXTREMIMON haben Luecken.
2. Hamburg ausbauen: bisher zwei Orte, gedacht als eigener Bezirk.
3. Dialogzweige fuer niedrigen Trust bei allen Hauptfiguren ergaenzen —
   aktuell reagieren die Figuren kaum darauf, wenn man sie verprellt hat.
4. Gesampelte Audioassets ergaenzen; das Soundboard-Interface bleibt gleich.
5. Tastatur-Navigation und Barrierefreiheit in der Web-UI (die Meter sind
   bisher nur farblich unterschieden).
