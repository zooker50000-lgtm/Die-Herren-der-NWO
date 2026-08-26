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

## Phase 4 - Die spaeten Arcs  (Status: BAPHOMIMON vollstaendig, Rest teilweise)

BAPHOMIMON ist mit allen drei Episoden spielbar, ebenso Operation Hades,
Pressesprecher und Fenster. ISLAMIMON und RECHTSEXTREMIMON haben Struktur,
Episodenliste und Kernmissionen; die uebrigen Episoden sind der naechste
inhaltliche Schritt.

## Phase 5 - Feinschliff  (Status: weitgehend umgesetzt)

Easter Eggs (Dromedar-Raetsel, Kelchninja, NANO, Ehdzhusten), geheime Enden,
dynamische Ereignisse und das synthetisierte Soundboard sind umgesetzt.
Offen: gesampelte Audioassets und die letzte UI/UX-Politur.

## Gemessener Stand

`npm run lore` und `npm run solve` liefern die Zahlen, nicht das Bauchgefuehl:

| Kennzahl | Stand |
|---|---|
| Quests | 55, davon 54 in einem Durchlauf abschliessbar |
| Dialoge | 32 Graphen, alle ueber einen Kanal erreichbar |
| Episoden | 51 gelistet, 35 mit eigener Quest (ALCHEMIMON und BAPHOMIMON vollstaendig) |
| Orte | 16, alle von Mimons Wohnung aus erreichbar |
| Durchspielbarkeit | Akt 15 und ein Ende, geprueft ueber drei Seeds |

## Naechste konkrete Schritte

1. Restliche 16 Episoden als Quests ausformulieren: ALCHEMIMON (21/21) und
   BAPHOMIMON (3/3) sind vollstaendig, ISLAMIMON (5/15) und
   RECHTSEXTREMIMON (6/12) haben Luecken.
2. Hamburg ausbauen: bisher zwei Orte, gedacht als eigener Bezirk.
3. Dialogzweige fuer niedrigen Trust bei allen Hauptfiguren ergaenzen —
   aktuell reagieren die Figuren kaum darauf, wenn man sie verprellt hat.
4. Gesampelte Audioassets ergaenzen; das Soundboard-Interface bleibt gleich.
5. Tastatur-Navigation und Barrierefreiheit in der Web-UI (die Meter sind
   bisher nur farblich unterschieden).
