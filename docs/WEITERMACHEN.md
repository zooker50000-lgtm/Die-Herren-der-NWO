# Übergabe: hier geht es weiter

Stand: alle fünf Entwicklungsphasen sind umgesetzt, das Spiel ist von Akt 1 bis
zum Ende durchspielbar. Dieses Dokument ist der Einstiegspunkt für die nächste
Sitzung — es sagt, was fertig ist, was offen ist und wo man anfängt.

## Aktueller Stand in Zahlen

| | |
|---|---|
| Quests | 79, davon 78 in einem Durchlauf abschließbar |
| Episoden | 51 von 51 mit eigener Quest (alle vier Serien vollständig) |
| Dialoge | 49 Graphen, alle über einen Kanal erreichbar |
| Figuren | 28, davon 24 mit eigenem Gespräch |
| Orte | 20 in drei Regionen, alle im Durchlauf besucht |
| Ereignisse | 21, davon 6 nur im Norden |
| Mimonolog | 12 Beat-Typen, 232 Vorlagen über drei Sprachstufen |
| Tests | 75, Laufzeit rund 3 Sekunden |

Geprüft mit `npm test`, `npm run validate`, `npm run solve` und
`npm run contrast`. Alles grün.

## Was offen ist, in der Reihenfolge, in der ich es angehen würde

### 1. Open World ausbauen (der größte Hebel)

`npm run lore` zeigt: Welt liegt bei 12 % statt der angepeilten 20 %, Dialog bei
27 % statt 15 %. Die Abweichung beim Dialog ist gewollt (der Mimonolog ist der
Kern des Spiels), die bei der Welt nicht. Konkret fehlt:

* **Mehr Interaktionen pro Ort.** Viele Orte haben zwei bis drei; die Wohnung
  hat neun und fühlt sich deshalb lebendig an. Vorbild ist `mimons_wohnung` in
  `data/locations.json`.
* **Tageszeit nutzen.** Nur wenige Interaktionen und Ereignisse hängen an
  `phase`. Ein Ort, der nachts anders ist als tagsüber, kostet wenig Content und
  bringt viel.
* **Ein dritter Bezirk** wäre denkbar, ist aber weniger wichtig als Tiefe in den
  bestehenden zwanzig Orten.

### 2. Fideo-System vertiefen

Bisher entscheiden Thema, Länge, Wut und Belege (`src/youtube/fideos.mjs`,
`data/media.json`). Naheliegende Ergänzungen, die zur Welt passen:

* **Schnitt** — schneller Schnitt bringt Reichweite, kostet Authentizität.
* **Titelbild** — reißerisch oder nüchtern.
* **Upload-Uhrzeit** — nachts hochgeladene Fideos erreichen andere Kommentare.

Alles drei sind Parameter in `publish()` und Faktoren in der Reichweitenformel;
die Kommentar-Pools in `data/media.json` können darauf reagieren.

### 3. Die Heeter zu einem Netz machen

Aktuell sind Heeter unabhängige Einträge in `state.heeters` mit einem
Aggro-Wert. Sie reagieren nicht aufeinander. Interessant wäre:

* Ein Heeter **übernimmt** einen anderen, wenn dessen Aggro fällt.
* Ein Heeter **verrät** einen anderen, wenn man ihn zur Polizei bringt.
* Aus zwei Heetern mit hoher Aggro entsteht ein **gemeinsamer Kanal**.

Ansatzpunkt: `src/emails/index.mjs`, Methode `adjustHeeter()`, plus neue
Ereignisse in `data/events.json`.

### 4. Audio

Das Soundboard synthetisiert alles zur Laufzeit (`src/audio/soundboard.mjs`),
das Repository enthält bewusst keine Binärassets. Gesampelte Sounds würden über
dieselbe Schnittstelle laufen — `play(id)` bleibt gleich, in `data/audio.json`
käme pro Eintrag ein `src` dazu. Die Musikregeln (`musicRules`) sind definiert,
aber es läuft noch keine Musik: `Soundboard.syncMusic()` meldet nur den Wechsel
per Ereignis, spielt aber nichts ab.

### 5. Kleinere offene Enden

* **ISLAMIMON und RECHTSEXTREMIMON** haben je eine Episode, die inhaltlich noch
  dünn ist (jeweils zwei Ziele ohne eigenen Dialog). Wer Zeit hat: eigene Szenen
  dafür schreiben, so wie bei `anrufer_ohne_filter`.
* **Der Dönerladen und der Park** haben je nur eine Nebenfunktion.
* **Low-Trust-Zweige** gibt es für sechs Figuren, High-Trust nur für zwei
  (Mamer, Reiter). Devrim und Myrrmoasta wären die nächsten Kandidaten.

## Wie man anfängt

```bash
npm test && npm run validate    # Ausgangslage bestätigen
npm run solve                   # zeigt, was gerade nicht lösbar ist
npm run lore                    # zeigt die Inhaltsverteilung
```

`npm run solve` ist der beste Startpunkt für jede inhaltliche Arbeit: Wenn dort
etwas unter „Nicht lösbar" steht, ist es auch im echten Spiel blockiert.

Die verbindlichen Regeln stehen in `CLAUDE.md` und `docs/CONTENT_GUIDE.md`.
Beide vor der ersten Änderung lesen — besonders die Content-Grenzen für die
beiden Manipulations-Arcs.
