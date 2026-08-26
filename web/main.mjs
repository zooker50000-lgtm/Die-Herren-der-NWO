/** Bootstrap des Browser-Clients. */
import { Game } from '../src/game.mjs';
import { UI } from '../src/ui/app.mjs';

const boot = document.getElementById('boot');
const app = document.getElementById('app');

const game = await Game.create({ dataOptions: { baseUrl: '../data/' } });
let ui = null;

function launch() {
  boot.hidden = true;
  app.hidden = false;
  ui = new UI(game);
  ui.render();
  // WebAudio darf erst nach einer Nutzeraktion starten.
  game.audio.unlock();
  window.mimon = { game, ui };   // Debug-Zugriff in der Konsole
}

document.getElementById('boot-start').addEventListener('click', () => {
  game.start();
  launch();
});

document.getElementById('boot-load').addEventListener('click', async () => {
  const slots = await game.save.list();
  const used = slots.filter((s) => !s.empty);
  if (!used.length) {
    game.start();
    launch();
    ui.toast('Kein Archiv gefunden. Neues Spiel gestartet.', 'info');
    return;
  }
  const result = await game.save.load(used[0].slot);
  if (!result.ok) { alert(result.reason); return; }
  game.resume();
  launch();
  ui.toast(`${used[0].label} geladen.`, 'gold');
});
