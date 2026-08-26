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

## Phase 4 - Die spaeten Arcs  (Status: umgesetzt)

Alle vier Serien sind vollstaendig als Quests spielbar: ALCHEMIMON 21/21,
ISLAMIMON 15/15, RECHTSEXTREMIMON 12/12, BAPHOMIMON 3/3. Dazu Operation
Hades, Pressesprecher und Fenster.

## Phase 5 - Feinschliff  (Status: weitgehend umgesetzt)

Easter Eggs (Dromedar-Raetsel, Kelchninja, NANO, Ehdzhusten), geheime Enden,
dynamische Ereignisse und das synthetisierte Soundboard sind umgesetzt.
Offen: gesampelte Audioassets und die letzte UI/UX-Politur.

## Gemessener Stand

`npm run lore` und `npm run solve` liefern die Zahlen, nicht das Bauchgefuehl:

| Kennzahl | Stand |
|---|---|
| Quests | 74, davon 73 in einem Durchlauf abschliessbar |
| Dialoge | 49 Graphen, alle ueber einen Kanal erreichbar |
| Episoden | 51 von 51 mit eigener Quest — alle vier Serien vollstaendig |
| Mimonolog | 12 Beat-Typen, 232 Vorlagen ueber drei Sprachstufen |
| Vertrauen | sechs Figuren mit eigenem Zweig fuer niedriges Vertrauen, zwei fuer hohes |
| Orte | 20 in drei Regionen, alle von Mimons Wohnung aus erreichbar |
| Figuren | 28, davon 24 mit eigenem Gespraech |
| Durchspielbarkeit | Akt 15 und ein Ende, geprueft ueber drei Seeds |

## Naechste konkrete Schritte

1. Gesampelte Audioassets ergaenzen; das Soundboard-Interface bleibt gleich.
2. Tastatur-Navigation und Barrierefreiheit in der Web-UI (die Meter sind
   bisher nur farblich unterschieden).
3. Eigene Ereignisse fuer Hamburg — bisher greift dort die Berliner
   Ereignistabelle mit.
