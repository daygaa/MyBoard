// Zone qui défile sous la barre de titre MyBoard (NAV-04) : en-tête, pages, pied de page. La
// fenêtre elle-même ne défile plus, pour que la barre de défilement commence sous la barre de titre.

export const SCROLLER_ID = "defilement";

export function scroller(): HTMLElement {
  return document.getElementById(SCROLLER_ID) ?? document.documentElement;
}

/** Durée du retour en haut fluide : rapide, puis ralenti sur la fin (retour T3, points AUT.19 et TAGM-04.13). */
const GLIDE_MS = 250;
/** Avance maximale de la glissade en une image (deux images à 60 Hz). */
const MAX_STEP_MS = 34;
let glide = 0;

/** Retour en haut de la page, d'un coup (changement de page de l'application). */
export function scrollToTop() {
  cancelAnimationFrame(glide);
  scroller().scrollTo(0, 0);
}

/** Retour en haut de la page en glissant (nouveau filtre, tri, recherche…) : la vitesse baisse jusqu'à
 *  l'arrêt (courbe « ease-out »). La molette ne l'interrompt pas : une molette en roue libre reprend après
 *  (GEN-24). */
export function glideToTop() {
  cancelAnimationFrame(glide);
  const area = scroller();
  const from = area.scrollTop;
  if (from <= 0) return;
  // Horloge propre à la glissade : elle part de la 1re image (l'heure reçue peut précéder l'appel, et un temps
  // négatif enverrait la page en bas) et n'avance pas de plus de deux images par image : après une image lente
  // (tri de milliers de tags, nouvelles lignes à dessiner), elle reprend au lieu de sauter.
  let previous = -1;
  let clock = 0;
  const step = (now: number) => {
    if (previous >= 0) clock += Math.min(now - previous, MAX_STEP_MS);
    previous = now;
    const t = Math.min(1, clock / GLIDE_MS);
    area.scrollTop = from * (1 - t) ** 3;
    if (t < 1) glide = requestAnimationFrame(step);
  };
  glide = requestAnimationFrame(step);
}
