// Rotation d'un média (VIEW-60). L'image tourne à l'écran dès chaque rotation (R, Maj+R, ↺ ↻, menu ; R maintenu : à
// chaque répétition de la touche, sans limite, retour 60.9) ; le fichier est écrit une seule fois, 0,5 s après la
// dernière rotation, avec tous les quarts de tour d'un coup (retours 60.7 et 60.10, réponses Q66 C et Q67 A) : un tour
// complet n'écrit rien. Visionneuse fermée ou fenêtre quittée avant : écrit tout de suite. Pendant l'écriture, l'image
// reste tournée à l'écran ; la fiche à jour (nouvelle empreinte) prend ensuite sa place.

import { create } from "zustand";

import { api, markTurned, type MediaItem } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { usePreviews } from "@/stores/previews";
import { useViewer } from "@/stores/viewer";
import { runExternal } from "./externalOpen";
import { adoptTurned } from "./imageCache";

/** Attente après la dernière rotation avant d'écrire le fichier (réponse Q67 A). */
const SETTLE_MS = 500;

type Turns = {
  /** Quarts de tour (sens horaire, 1 à 3) affichés en plus de la fiche, par média : pas encore écrits, ou en cours. */
  ahead: Record<number, number>;
  /** Médias dont une rotation est en cours d'écriture. */
  writing: Record<number, true>;
};

const useTurns = create<Turns>(() => ({ ahead: {}, writing: {} }));

/** Quarts de tour à ajouter à l'affichage de ce média (0 à 3). */
export const useTurnsAhead = (id: number) => useTurns((s) => s.ahead[id] ?? 0);

/** Une rotation de ce média est en cours d'écriture : ses adresses d'avant peuvent ne plus répondre (nouvelle empreinte). */
export const writingTurns = (id: number) => useTurns.getState().writing[id] === true;

const mod4 = (n: number) => ((n % 4) + 4) % 4;

function addAhead(s: Turns, id: number, quarters: number): Turns["ahead"] {
  const ahead = { ...s.ahead };
  const turns = mod4((ahead[id] ?? 0) + quarters);
  if (turns) ahead[id] = turns;
  else delete ahead[id];
  return ahead;
}

/** Quarts de tour affichés, pas encore envoyés, par média. */
const unsent = new Map<number, number>();
let writes: Promise<void> = Promise.resolve();
let settle: ReturnType<typeof setTimeout> | undefined;
/** R (ou Maj+R) enfoncé : rien n'est écrit avant son relâchement ; l'attente de 0,5 s part de là. Sinon, avec la
 *  répétition de Windows (1re répétition ~500 ms après l'appui), une écriture partait pendant l'appui. */
let held = false;

/** Quart de tour (R, Maj+R, ↺ ↻, menu) : à l'écran tout de suite ; fichier écrit 0,5 s après la dernière rotation. */
export function rotateMedia(item: MediaItem, clockwise: boolean) {
  const q = clockwise ? 1 : 3;
  unsent.set(item.id, mod4((unsent.get(item.id) ?? 0) + q));
  useTurns.setState((s) => ({ ahead: addAhead(s, item.id, q) }));
  later();
}

function later() {
  clearTimeout(settle);
  if (!held) settle = setTimeout(writeTurns, SETTLE_MS);
}

/** R enfoncé (`true`) ou relâché (`false`). */
export function holdTurnKey(down: boolean) {
  if (held === down) return;
  held = down;
  later();
}

/** Les quarts de tour affichés sont écrits, d'un coup par média : 0,5 s après la dernière rotation, ou tout de suite
 *  (visionneuse fermée, fenêtre quittée). */
export function writeTurns() {
  clearTimeout(settle);
  held = false;
  for (const [id, quarters] of unsent) {
    unsent.delete(id);
    if (quarters) write(id, quarters);
  }
}

const LABELS: Record<number, string> = { 1: "Tourner à droite", 2: "Tourner d'un demi-tour", 3: "Tourner à gauche" };

function write(id: number, quarters: number) {
  writes = writes.then(async () => {
    useTurns.setState((s) => ({ writing: { ...s.writing, [id]: true } }));
    const result: { item?: MediaItem } = {};
    const ok = await runExternal(LABELS[quarters], async () => {
      result.item = await api.rotateMedia(id, quarters);
    });
    const updated = ok ? result.item : undefined;
    const viewer = useViewer.getState();
    const before = updated && viewer.open && viewer.item?.id === id ? viewer.item : null;
    const turned = updated && (!before || updated.hash !== before.hash);
    if (turned) {
      // Fichier tourné : nouvelle empreinte, adresses neuves (rien de gardé par la fenêtre n'est resservi, retour 60.8),
      // grands aperçus à refaire.
      markTurned(id);
      usePreviews.getState().forget([id]);
    }
    if (before && updated && turned) {
      // La visionneuse recharge le média : copie de l'image déjà tournée (sans repasser par la miniature, retour
      // 60.2) ; vidéo en pause : elle le reste (retour 60.3).
      adoptTurned(before, updated, quarters);
      if (document.querySelector<HTMLVideoElement>('[data-zone="visionneuse.video"] video')?.paused) pausedTurn = { id, hash: updated.hash };
    }
    // Échec : l'image revient à son vrai sens. Réussite : ces quarts de tour sont maintenant dans la fiche.
    useTurns.setState((s) => {
      const writing = { ...s.writing };
      delete writing[id];
      return { ahead: addAhead(s, id, -quarters), writing };
    });
    if (before && updated) viewer.show(viewer.index, updated, viewer.total);
    if (updated) void queryClient.invalidateQueries({ queryKey: ["media"] });
  });
}

/** Vidéo en pause dont le fichier vient d'être tourné : rechargée, elle reste en pause (retour 60.3). */
let pausedTurn: { id: number; hash: string } | null = null;
export const startsPaused = (item: MediaItem) => pausedTurn?.id === item.id && pausedTurn.hash === item.hash;
export function clearStartsPaused(item: MediaItem) {
  if (startsPaused(item)) pausedTurn = null;
}
