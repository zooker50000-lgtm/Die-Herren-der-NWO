/**
 * Dialog-Engine. Läuft einen Dialoggraphen ab und liefert der UI jeweils
 * den aktuellen Knoten samt gefilterter Auswahl.
 *
 * Ein Knoten mit `monolog` ruft den Mimonolog-Generator auf, statt eine
 * feste Zeile auszugeben — dadurch klingt Mimon nie zweimal gleich.
 */
import { meets, explain } from '../core/conditions.mjs';
import { applyEffects, describeEffects } from '../core/effects.mjs';

export const TONES = {
  ruhig: { label: 'Ruhig antworten', crashout: -2 },
  mimonolog: { label: 'Mimonolog starten', crashout: 3 },
  beschuldigen: { label: 'Heeter beschuldigen', crashout: 6 },
  nwo_kontaktieren: { label: 'NWO kontaktieren', crashout: 2 },
  mamer_fragen: { label: 'Mamer fragen', crashout: -3 },
  polizei: { label: 'Polizei kontaktieren', crashout: 0 },
  thema_wechseln: { label: 'Thema wechseln', crashout: 1 },
  eskalieren: { label: 'Komplett eskalieren', crashout: 12 }
};

export class DialogueEngine {
  constructor(ctx) {
    this.ctx = ctx;
    this.active = null;
  }

  get isOpen() { return Boolean(this.active); }

  open(dialogueId, { npc } = {}) {
    const dialogue = this.ctx.registry.dialogue(dialogueId);
    if (!dialogue) throw new Error(`Unbekannter Dialog: ${dialogueId}`);
    this.active = { id: dialogueId, dialogue, nodeId: null, history: [], npc: npc ?? dialogue.npc };
    this.ctx.bus.emit('dialogue.opened', { dialogue: dialogueId, npc: this.active.npc });
    return this.enter(dialogue.start);
  }

  /** Knoten betreten: Effekte genau einmal pro Besuch anwenden. */
  enter(nodeId) {
    this.active.nodeId = nodeId;
    const node = this.active.dialogue.nodes[nodeId];
    if (node?.effects) {
      applyEffects(this.ctx, node.effects, { dialogue: this.active.id, node: nodeId });
    }
    return this.current();
  }

  /** Aktueller Knoten, aufbereitet für die Anzeige. */
  current() {
    if (!this.active) return null;
    const node = this.active.dialogue.nodes[this.active.nodeId];
    if (!node) return this.close();

    const speakerId = node.speaker ?? this.active.npc;
    const view = {
      dialogue: this.active.id,
      nodeId: this.active.nodeId,
      speaker: speakerId,
      speakerName: speakerId === 'mimon'
        ? 'Mimon'
        : speakerId === 'narrator' ? '' : this.ctx.registry.characterName(speakerId),
      text: node.text ?? null,
      monolog: null,
      choices: [],
      canContinue: Boolean(node.next)
    };

    if (node.monolog) {
      view.monolog = this.ctx.monolog.generate(node.monolog);
      view.text = null;
    }

    view.choices = (node.choices ?? []).map((choice, index) => ({
      index,
      text: choice.text,
      tone: choice.tone,
      toneLabel: TONES[choice.tone]?.label ?? choice.tone,
      available: meets(this.ctx.store.s, choice.requires),
      blockedBy: explain(this.ctx.store.s, choice.requires),
      preview: describeEffects(choice.effects, this.ctx.registry)
    }));

    this.ctx.bus.emit('dialogue.line', view);
    return view;
  }

  /** Eine Antwortoption wählen. */
  choose(index) {
    if (!this.active) return null;
    const node = this.active.dialogue.nodes[this.active.nodeId];
    const choice = node?.choices?.[index];
    if (!choice) throw new Error(`Ungültige Auswahl: ${index}`);
    if (!meets(this.ctx.store.s, choice.requires)) return this.current();

    const tone = TONES[choice.tone];
    if (tone?.crashout) this.ctx.store.addStat('crashout', tone.crashout, { min: 0, max: 100 });

    applyEffects(this.ctx, choice.effects, { dialogue: this.active.id, node: this.active.nodeId, tone: choice.tone });
    this.active.history.push({ node: this.active.nodeId, choice: index, tone: choice.tone });
    this.ctx.bus.emit('dialogue.choice', {
      dialogue: this.active.id,
      npc: this.active.npc,
      node: this.active.nodeId,
      tone: choice.tone,
      text: choice.text
    });

    return this.goto(choice.next ?? 'END');
  }

  /** Weiter bei Knoten ohne Auswahl. */
  continue() {
    if (!this.active) return null;
    const node = this.active.dialogue.nodes[this.active.nodeId];
    return this.goto(node?.next ?? 'END');
  }

  goto(nodeId) {
    if (!nodeId || nodeId === 'END') return this.close();
    return this.enter(nodeId);
  }

  close() {
    if (!this.active) return null;
    const { id, npc, history } = this.active;
    const dialogue = this.active.dialogue;
    this.active = null;

    const played = this.ctx.store.s.dialogue.played;
    if (!played.includes(id)) { played.push(id); this.ctx.store.touch('dialogue'); }
    this.ctx.bus.emit('dialogue.closed', {
      dialogue: id,
      npc,
      faction: npc ? this.ctx.registry.character(npc)?.faction : undefined,
      layer: dialogue.layer,
      turns: history.length,
      tones: history.map((h) => h.tone)
    });
    return null;
  }
}
