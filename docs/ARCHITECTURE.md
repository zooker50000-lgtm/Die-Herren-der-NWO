# Architektur

## Grundprinzipien

1. **Die Engine ist headless.** `src/` kennt kein DOM und keine Konsole. Clients
   (`web/`, `src/cli/`) haengen sich ueber den Event-Bus und lesende
   State-Zugriffe an. Dadurch ist jedes System ohne Browser testbar.
2. **Content ist Daten, kein Code.** Lore, Charaktere, Quests, Dialoge, Items,
   Events und Locations liegen ausschliesslich in `data/*.json`. Kein System
   enthaelt hartcodierte Lore.
3. **Ein Effekt-Format fuer alles.** Dialogoptionen, Quest-Rewards, Events,
   Heet-Mehl-Reaktionen und Item-Nutzung benutzen dasselbe `effects`-Objekt und
   denselben Applikator (`src/core/effects.mjs`).
4. **Alles laeuft ueber den Bus.** Systeme reden nicht direkt miteinander, sie
   feuern und lauschen auf Events. Neue Systeme koennen ohne Aenderung
   bestehender Systeme andocken.
5. **Deterministisch bei gleichem Seed.** Der RNG ist ein seedbarer Mulberry32.
   Der Seed ist Teil des Savegames, wodurch Spielverlaeufe reproduzierbar sind.

## Schichten

```
        +-------------------------------------------------+
        |  Clients:  web/ (DOM)        src/cli/ (stdio)    |
        +--------------------+----------------------------+
                             |  liest State / hoert Bus
        +--------------------v----------------------------+
        |  src/game.mjs  - Kompositionswurzel              |
        |  baut Systeme, verdrahtet Bus, oeffnet API       |
        +--------------------+----------------------------+
                             |
   +------------+------------+-----------+-------------+---------+
   | systems/   | dialogue/  | quests/   | nwo/        | world/  |
   | crashout   | engine     | engine    | influence   | travel  |
   | mett       | mimonolog  | objectives| surveillance| window  |
   | authentic. | lexicon    |           | terminal    |         |
   +------------+------------+-----------+-------------+---------+
   | emails/    | youtube/   | alchemy/  | inventory/  | events/ |
   | lore/      | save/      | audio/    | characters/ |         |
   +------------+------------+-----------+-------------+---------+
                             |
        +--------------------v----------------------------+
        |  src/core/  bus | rng | state | clock | effects  |
        +--------------------+----------------------------+
                             |
        +--------------------v----------------------------+
        |  src/data/loader  ->  data/*.json                |
        +-------------------------------------------------+
```

## Kernbausteine (`src/core/`)

| Modul | Aufgabe |
|---|---|
| `bus.mjs` | Publish/Subscribe mit Wildcards (`quest.*`), Verlaufspuffer, `once`. |
| `rng.mjs` | Seedbarer RNG: `int`, `pick`, `weighted`, `chance`, `shuffle`, `fork`. |
| `state.mjs` | Zentraler, serialisierbarer Zustandsbaum + `patch`-Benachrichtigungen. |
| `clock.mjs` | Spielzeit in Minuten, Tagesphasen, `advance()` treibt Ticks. |
| `effects.mjs` | Einheitlicher Effekt-Applikator (siehe unten). |
| `conditions.mjs` | Einheitliche Bedingungspruefung (`requires`) fuer alle Systeme. |
| `registry.mjs` | Nachschlagetabellen ueber die geladenen Daten (by id / by tag). |

## Das Effekt-Format

Ein einziges deklaratives Objekt, ueberall verwendbar:

```jsonc
{
  "crashout": 12,                  // Meter-Delta
  "mett": 40,
  "authenticity": -5,
  "nwoInfluence": 3,
  "subscribers": 250,
  "alchemyXp": 30,
  "trust":   { "mamer": 5, "reiter_wixler": -10 },
  "flags":   ["hat_fahrzeug_gesehen"],
  "unflags": ["glaubt_an_zufall"],
  "items":   ["nwo_usb_stick"],
  "removeItems": ["heet_mehl_001"],
  "lore":    ["nwo_die_nwo_sieht_alles"],
  "quests":  { "start": ["der_erste_heeter"], "advance": ["heet_mehl:gelesen"] },
  "spawnHeeter": 1,
  "spawnEmail": "heet_mehl_pool:hatebox",
  "monolog":  { "topic": "fahrzeug", "intensity": "hoch" },
  "sfx":     ["nwo_sting"],
  "log":     "Mimon notiert etwas in das magische Tagebuch."
}
```

`applyEffects(ctx, effects)` gibt eine Liste der tatsaechlich ausgefuehrten
Teil-Effekte zurueck, damit die UI sie anzeigen kann ("+40 METT").

## Bedingungen (`requires`)

```jsonc
{
  "flags": ["kennt_reiter"],
  "notFlags": ["reiter_entlarvt"],
  "quests": { "completed": ["das_nwo_labor"], "active": ["operation_hades"] },
  "stats":  { "authenticity": { "min": 60 }, "crashout": { "max": 40 } },
  "trust":  { "reiter_wixler": { "min": 55 } },
  "items":  ["nwo_ausweis"],
  "act":    { "min": 6 },
  "chapter": "chapter_2"
}
```

Alle Felder sind optional und werden UND-verknuepft.

## Ereignisnamen

Namensraum-Konvention `bereich.ereignis`:

```
game.started        state.patched        clock.tick        clock.phase
dialogue.opened     dialogue.line        dialogue.choice   dialogue.closed
monolog.started     monolog.beat         monolog.finished  monolog.ehdzhusten
crashout.changed    crashout.tier        crashout.maximum
mett.changed        authenticity.tier    subscribers.changed
nwo.influence       nwo.tier             nwo.sees_all      nwo.terminal
email.received      email.read           email.answered    email.reported
fideo.published     fideo.comment        heeter.spawned    heeter.defeated
quest.started       quest.objective      quest.completed   quest.failed
world.travel        world.interact       window.observed
alchemy.brewed      alchemy.levelup      item.gained       item.lost
lore.unlocked       achievement.unlocked ending.reached
save.written        save.loaded          event.fired
```

## Determinismus & Savegames

Der gesamte Spielzustand liegt in `state.mjs` als plain JSON. Ein Savegame ist
`{ version, seed, rngCursor, state }`. `src/save/migrations.mjs` hebt aeltere
Staende auf die aktuelle Version, damit Archive nicht brechen, wenn neue Systeme
hinzukommen.

## Warum kein Build-Step

Das Projekt kommt ohne Bundler, Transpiler und Runtime-Dependencies aus:
Browser und Node fuehren dieselben `.mjs`-Dateien direkt aus. Das haelt die
Einstiegshuerde bei null und macht die Engine in CI ohne Installation testbar.
Ein Bundler kann spaeter als reine Optimierung ergaenzt werden, ohne dass sich
am Quellcode etwas aendert.
