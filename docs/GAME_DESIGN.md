# Game Design

## Der Kernloop

```
Ereignis -> Mimon reagiert -> Mimonolog -> neue Information -> neue Gegner ->
neue Heet-Mehls -> neue NWO-Aktivitaet -> neue Quest -> Eskalation -> Crashout -> neue Lore
```

Die Welt ist nie statisch: der Event-Scheduler (`src/events/`) feuert bei jedem
Zeittick gewichtete Ereignisse, deren Wahrscheinlichkeit von METT, NWO INFLUENCE,
Tageszeit, Ort und offenen Quests abhaengt.

## Die vier Meter

### REAL-AUTHENTISCH (0-100)

| Bereich | Stufe |
|---|---|
| 0-20 | FEKER |
| 20-40 | VERDAECHTIG |
| 40-60 | NORMAL |
| 60-80 | AUTHENTISCH |
| 80-100 | REAL-AUTHENTISCH |

Steuert, wer Mimon glaubt, welche Dialogoptionen sichtbar sind und welche Quests
freigeschaltet werden. Steigt durch Konsistenz, Belege, eingehaltene Zusagen.
Faellt durch Clickbait, widersprochene Theorien und ignorierte Mamer-Anrufe.

### CRASHOUT (0-100)

| Bereich | Stufe | Wirkung |
|---|---|---|
| 0-20 | RUHIG | normale Dialoge |
| 20-40 | GENERVT | schaerferer Tonfall, kuerzere Saetze |
| 40-60 | MIMONOLOG | Monologe werden laenger, Abschweifungen haeufiger |
| 60-80 | ANSAGE | direkte Anschuldigungen, NPCs weichen zurueck |
| 80-95 | MASSIVER CRASHOUT | Grossbuchstaben, Kamera-Shake, Musikwechsel |
| 95-100 | MAXIMUM CRASHOUT | UI-Verzerrung, erzwungener Monolog, Weltreaktion |

Trigger: Heet-Mehls, NWO, falsche Anschuldigungen, Mamer, Polizei, Hatebox,
Olligo, Trittbrettfahrer, Provokation, verlorene Gegenstaende, Fehlinformation.
Der Meter faellt langsam ueber Zeit (Decay) und schneller in der Wohnung.

### METT (Ressource)

Mett ist Aufmerksamkeit in materieller Form. Es entsteht aus Reichweite und
Eskalation und wird ausgegeben fuer Fideo-Boosts, Alchemie-Zutaten,
Archiv-Freischaltungen und Informationen von Kontaktpersonen.

**Der Trade-off:** Mett-Gewinn erhoeht die Heeter-Spawnrate und die
NWO-Aufmerksamkeit. Wer viel Mett macht, wird gesehen.

### NWO INFLUENCE (0-100)

| Bereich | Stufe |
|---|---|
| 0-20 | GERUECHT |
| 20-40 | PRAESENZ |
| 40-60 | STRUKTUR |
| 60-80 | ZUGRIFF |
| 80-99 | DURCHDRINGUNG |
| 100 | DIE NWO SIEHT ALLES |

Hoehere Influence bedeutet: mehr Agenten in der Welt, mehr Fahrzeuge vor dem
Fenster, mehr NWO-Mail, freigeschaltete Orte, neue Storyzweige — und eine
sichtbar veraenderte Welt. 100 % ist ein Story-Meilenstein, kein Game Over.

## Vertrauen

Jeder wichtige NPC hat `trust` 0-100. Trust ist keine Anzeige, sondern ein
Schalter: welches Gespraech eine Figur fuehrt, haengt davon ab.

| Figur | verprellt | vertraut |
|---|---|---|
| Mamer | redet nicht mehr ueber seine Sachen — als Entscheidung, nicht als Vorwurf | erzaehlt, was sie nie erzaehlt hat |
| Reiter Wixler | hat "gerade nichts" und nennt eine Bedingung | sagt einmal ohne Umweg, wofuer er bezahlt wird |
| Toni | sagt nichts mehr zum letzten Fideo | — |
| Kommissarin Devrim | verlangt Belege, bevor sie zuhoert | nimmt auf, was sie sonst nicht aufnimmt |
| Honig | will nicht hineingezogen werden | — |
| Myrrmoasta | sagt nichts, solange die Kamera laeuft | — |

Quest-Gespraeche haben Vorrang vor beidem: eine laufende Mission wird nicht
davon aufgehalten, dass jemand beleidigt ist.

## Dialogentscheidungen

Statt JA/NEIN gibt es acht Grundtonarten, die als `tone` an jeder Dialogoption
haengen und jeweils eigene Effekte tragen:

`ruhig` · `mimonolog` · `beschuldigen` · `nwo_kontaktieren` · `mamer_fragen` ·
`polizei` · `thema_wechseln` · `eskalieren`

## Der Mimonolog

Ein Mimonolog ist kein Textblock, sondern eine generierte Beat-Folge:

```
OPENER -> RESTATEMENT -> FRAGE -> THEORIE -> [ABSCHWEIFUNG] ->
[SELBSTKORREKTUR -> RUECKKEHR] -> BELEG -> [ANSCHULDIGUNG] ->
[ESKALATION] -> SCHLUSS
```

Die Beat-Auswahl ist eine gewichtete Zustandsmaschine, deren Gewichte von
Crashout-Stufe, Mimonolog-Skill, NWO-Influence und Heeter-Aggro abhaengen.
EHDZHUSTEN wird probabilistisch zwischen Beats eingeschoben — nicht jedes Mal.

Vokabular wird **kontextabhaengig** eingesetzt: jeder Lexikoneintrag hat
Kontext-Tags, und benutzte Begriffe bekommen einen Cooldown. Dadurch entsteht
Rhythmus statt Begriffs-Spam. Details: `docs/CONTENT_GUIDE.md`.

## Heeter & Heet-Mehls

Heeter sind persistente Gegner mit `aggro`, `taktik` und `enttarnt`-Status. Sie
schreiben Kommentare, schicken Heet-Mehls, laden veraenderte Fideos hoch, legen
Fake-Accounts an und beeinflussen andere NPCs.

Jedes Heet-Mehl kennt fuenf Antworten:

1. ignorieren · 2. beantworten · 3. oeffentlich vorlesen ·
4. zur Polizei bringen · 5. zur NWO bringen

Jede Option hat andere Effekte auf Crashout, Mett, Authentizitaet, NWO-Trust und
Heeter-Aggro. Es gibt keine dominante Strategie.

## Fideo-System

Ein Fideo hat Titel, Thema, Laenge, Wut, Authentizitaet und NWO-Bezug. Aus diesen
Parametern errechnen sich Reichweite, Abonnenten-Delta, Mett-Ertrag,
Kommentar-Tonalitaet und die Wahrscheinlichkeit, neue Heeter anzuziehen.

Hohe Wut + niedrige Authentizitaet = viel Mett, schneller Ruf-Verlust.
Hohe Authentizitaet + Belege = wenig Mett, stabile Abonnenten, NWO-Aufmerksamkeit.

## Alchemie

Skill 1-100 mit Zutaten, Rezepten, Buechern, Laborstufen und Essenzen.
Das Spiel liefert **keine realen chemischen Anleitungen** — alle Rezepte sind
symbolisch-mystisch (Planetenzeichen, Kelche, Essenzen) und ohne realen Bezug.

## Die drei Regionen

| Region | Charakter |
|---|---|
| **Berlin** | Der Alltag: Wohnung, Strasse, Kiosk, Polizeistation. Hier faellt der Crashout am schnellsten und hier steht das Fenster. |
| **Hamburg** | Kaelter und ordentlicher. Ankunft, Pension Nordlicht, Kontor 4, Trockendock 3, Hafenrand, Lagerhalle 9. Alles wirkt legitim, und genau das ist das Beunruhigende. |
| **Der Untergrund** | Kein Bezirk, sondern ein Ort: U-7, zwoelf Meter tief, mit zehn Bereichen hinter getrennten Freigaben. |

Die Fahrt nach Hamburg kostet ueber anderthalb Stunden Spielzeit — und Zeit
treibt Ereignisse. Der Norden ist deshalb kein Katzensprung, sondern eine
Entscheidung.

## Akte

| Akt | Inhalt |
|---|---|
| 1 | Die ersten Heeter |
| 2 | Die NWO wird zum Feindbild |
| 3 | Mamer rueckt in den Mittelpunkt |
| 4 | Immer mehr vermeintliche NWO-Verbindungen |
| 5 | NWO Productions taucht auf |
| 6 | ALCHEMIMON beginnt |
| 7 | Mimon glaubt, mit der NWO zusammenzuarbeiten |
| 8 | Alchemie und das NWO-Labor |
| 9 | Olligo / Operation Hades |
| 10 | ISLAMIMON |
| 11 | RECHTSEXTREMIMON |
| 12 | BAPHOMIMON |
| 13 | Pressesprecher |
| 14 | Fenster |
| 15 | Der letzte Mimonolog |

## Enden

| Ende | Bedingung |
|---|---|
| A REAL-AUTHENTISCH | Authentizitaet >= 85, Hauptquest abgeschlossen |
| B NWO | NWO-Reputation >= 80, Pressesprecher-Posten angenommen |
| C HEETER | Heeter-Aggro >= 80, Authentizitaet <= 25 |
| D ALCHIMIST | Alchemie >= 75, Labor abgeschlossen, Tagebuch komplett |
| E CHAOS | Crashout erreicht 100 im Finale |
| SECRET DROMEDAR | verstecktes Raetsel geloest |

## Balance-Zielverteilung

40 % Story · 20 % Open World · 15 % Dialog/Mimonolog · 10 % NWO · 10 % Memes ·
5 % Easter Eggs. `npm run lore` misst die tatsaechliche Verteilung des Contents
gegen dieses Ziel.
