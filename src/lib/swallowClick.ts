// Clic « avalé » : il ferme un menu ouvert et ne fait rien d'autre (menu du clic droit CTX-01, menu
// des vitesses VIEW-49) — ni l'appui, ni le « click » qui suit n'atteignent l'élément visé.

export const swallow = (e: Event) => {
  e.preventDefault();
  e.stopImmediatePropagation();
};

/** À appeler sur un `pointerdown` (phase de capture) : avale l'appui et le clic qui le termine. */
export function swallowClick(e: PointerEvent) {
  swallow(e);
  const click = e.button === 1 ? "auxclick" : "click";
  window.addEventListener(click, swallow, { capture: true, once: true });
  // Pas de clic à la fin (souris relâchée hors de la fenêtre…) : rien à avaler ensuite.
  window.addEventListener("pointerup", () => setTimeout(() => window.removeEventListener(click, swallow, true)), { capture: true, once: true });
}
