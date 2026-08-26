# MIMON BARAKA UNIVERSE

Ein fiktionales, satirisches Open-World-/Story-Adventure ueber Heeter, Heet-Mehls,
Mett, Fideos, Alchemie, Mimonologe — und die NWO.

> **DIE NWO SIEHT ALLES.**

---

## Was das hier ist

Ein vollstaendig datengetriebenes Spielprojekt: Engine in modernem JavaScript (ESM),
Content in JSON. Kein Build-Step, keine Runtime-Dependencies. Das Spiel laeuft

* im **Browser** (vollstaendige UI mit HUD, Wohnung, Computer, NWO-Terminal), und
* im **Terminal** (CLI-Client fuer die gleiche Engine).

Beide Clients benutzen exakt dieselbe Engine — die Engine selbst ist headless und
kennt weder DOM noch Konsole.

## Schnellstart

```bash
npm start          # startet den lokalen Dev-Server -> http://localhost:5173
npm run play       # spielt dieselbe Engine im Terminal
npm test           # 73 Tests (node:test, keine Dependencies)
npm run validate   # prueft die gesamte Content-Datenbank auf Konsistenz
npm run lore       # Lore-Report: Verteilung ueber die Layer, Inhaltsmischung
npm run simulate   # zufaelliger Durchlauf: findet Abstuerze und tote Wege
npm run solve      # zielgerichteter Durchlauf: beweist, dass das Spiel durchspielbar ist
```

Die beiden Durchlaeufe sind keine Spielereien, sondern die wichtigsten
Werkzeuge des Projekts: `solve` sucht zu jedem offenen Questziel die passende
Handlung und meldet, woran es haengt. Genau so wurden die Verklemmungen um das
NWO-Labor, die Lagerhalle und den Kelchninja gefunden — Stellen, an denen die
Hauptgeschichte nicht weiterging. Der Durchlauf laeuft als Test mit.

Node >= 20 wird benoetigt (ESM + `node:test` + JSON-Import).

## Projektstruktur

```
data/          Die gesamte Lore-, Charakter-, Quest- und Weltdatenbank (JSON)
src/core/      Event-Bus, RNG, State-Store, Clock, Effects, Registry
src/data/      Loader + Schema-Validierung (browser- und node-faehig)
src/systems/   Crashout, Mett, Real-Authentisch, Abonnenten, Trust
src/dialogue/  Dialog-Engine + Mimonolog-Generator + Lexikon
src/quests/    Quest-Engine, Objectives, Requirements
src/nwo/       Influence, Surveillance, NWO-Terminal, Fraktionen
src/emails/    Heet-Mehl-System, Heeter-Simulation
src/youtube/   Fideo-Produktion, Kommentare, Juhtub
src/alchemy/   Alchemie-Skill, Rezepte, Labor
src/world/     Locations, Reisen, Interaktionen, das Fenster
src/events/    Dynamischer Ereignis-Scheduler
src/lore/      Kodex, Unlocks, Lore-Layer
src/inventory/ Inventar + Magisches Tagebuch
src/save/      MIMON-ARCHIV (Save-System)
src/audio/     Soundboard (WebAudio-synthetisiert, keine Binaerassets)
src/ui/        Browser-UI (Screens, HUD, Computer, Terminal)
src/cli/       Terminal-Client
web/           Statische Shell fuer den Browser-Client
tools/         Dev-Server, Datenvalidierung, Lore-Report, Durchlaeufe
test/          Engine-Tests
docs/          Architektur, Game-Design, Content-Guide, Roadmap
```

Details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
[`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md),
[`docs/CONTENT_GUIDE.md`](docs/CONTENT_GUIDE.md),
[`docs/LORE_LAYERS.md`](docs/LORE_LAYERS.md),
[`docs/ROADMAP.md`](docs/ROADMAP.md).

## Der Gameplay-Loop

```
Ereignis -> Mimon reagiert -> Mimonolog -> neue Information -> neue Gegner
   -> neue Heet-Mehls -> neue NWO-Aktivitaet -> neue Quest -> Eskalation
   -> Crashout -> neue Lore -> Ereignis ...
```

Vier Meter treiben alles an:

| Meter | Bedeutung |
|---|---|
| **REAL-AUTHENTISCH** | Wer glaubt dir? Welche Dialoge und Quests oeffnen sich? |
| **CRASHOUT** | Wie nah ist die Eskalation? Aendert Musik, Kamera, UI, NPC-Verhalten. |
| **METT** | Aufmerksamkeit als Ressource. Mehr Mett = mehr Reichweite = mehr Heeter. |
| **NWO INFLUENCE** | Wie tief ist die Organisation in deiner Welt? Bei 100%: DIE NWO SIEHT ALLES. |

## Wie man Figuren erreicht

Jeder Dialog haengt an einer Figur und an einem Kanal: **vor Ort**, **Telefon**
oder **online**. Welches Gespraech eine Figur gerade fuehrt, entscheidet die
Vermittlung aus Prioritaet und Voraussetzungen — deshalb sagt Mamer im dritten
Akt etwas anderes als im zehnten, und deshalb ist Hatebox nur ueber das
Heet-Mehl-Postfach zu stellen und nie auf der Strasse.

## Lore-Layer

Jeder Content-Eintrag traegt ein `layer`-Feld, damit die Ebenen niemals vermischt werden:

* `SOURCE_BASED_LORE` — aus der dokumentierten Chronik uebernommen
* `IN_UNIVERSE_AUDIO_LORE` — Inhalte der NWO-Productions-Hoerspiele
* `MEME_LORE` — Meme-/Fan-Ebene
* `FICTIONAL_GAME_CONTENT` — eigens fuer dieses Spiel erfunden

`npm run validate` bricht ab, wenn ein Eintrag kein Layer hat.

## Hinweis

Dies ist ein Comedy-/Satire-Spielprojekt. Alle Figuren, Organisationen, Orte und
Ereignisse innerhalb von `data/` sind Bestandteile der fiktiven Spielwelt und keine
Aussagen ueber reale Personen. Siehe [`DISCLAIMER.md`](DISCLAIMER.md).
