// Zone qui défile sous la barre de titre MyBoard (NAV-04) : en-tête, pages, pied de page. La
// fenêtre elle-même ne défile plus, pour que la barre de défilement commence sous la barre de titre.

export const SCROLLER_ID = "defilement";

export function scroller(): HTMLElement {
  return document.getElementById(SCROLLER_ID) ?? document.documentElement;
}

/** Retour en haut de la page. */
export function scrollToTop() {
  scroller().scrollTo(0, 0);
}
