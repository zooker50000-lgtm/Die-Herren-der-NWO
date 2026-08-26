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
| Quests | 71, davon 69-70 in einem Durchlauf abschliessbar |
| Dialoge | 38 Graphen, alle ueber einen Kanal erreichbar |
| Episoden | 51 von 51 mit eigener Quest — alle vier Serien vollstaendig |
| Mimonolog | 12 Beat-Typen, 232 Vorlagen ueber drei Sprachstufen |
| Orte | 16, alle von Mimons Wohnung aus erreichbar |
| Durchspielbarkeit | Akt 15 und ein Ende, geprueft ueber drei Seeds |

## Naechste konkrete Schritte

1. Hamburg ausbauen: bisher zwei Orte, gedacht als eigener Bezirk.
2. Dialogzweige fuer niedrigen Trust bei allen Hauptfiguren ergaenzen —
   aktuell reagieren die Figuren kaum darauf, wenn man sie verprellt hat.
3. Gesampelte Audioassets ergaenzen; das Soundboard-Interface bleibt gleich.
5. Tastatur-Navigation und Barrierefreiheit in der Web-UI (die Meter sind
   bisher nur farblich unterschieden).
