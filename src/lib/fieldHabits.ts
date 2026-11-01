// Habitudes de saisie communes à toute l'application (demandes du 02/11) :
// - Échap dans un champ de saisie : le champ perd le focus (GEN-27, retour T3, point AUT.27), en dernier recours : ce
//   qui est ouvert par-dessus (liste de suggestions, pop-in, menu, visionneuse) passe avant (lib/escape.ts, qui arrête
//   la touche) ; un champ qui donne à Échap un rôle à lui (renommer dans la ligne : annuler) le garde. Les boutons 4 / 5
//   de la souris n'y touchent pas ;
// - texte d'une case à cocher (le <label> qui l'entoure) : un double ou triple clic coche ou décoche la case sans
//   surligner le texte ; un clic glissé le surligne toujours (GEN-17, retour T3, point AUT.28).

import { hasEscapeLayer } from "./escape";

const editable = (target: EventTarget | null): target is HTMLElement =>
  target instanceof HTMLElement && (["INPUT", "TEXTAREA"].includes(target.tagName) || target.isContentEditable);

window.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || e.defaultPrevented || hasEscapeLayer() || !editable(e.target)) return;
  e.target.blur();
});

window.addEventListener(
  "mousedown",
  (e) => {
    if (e.detail < 2 || !(e.target instanceof Element)) return;
    const label = e.target.closest("label");
    if (label?.querySelector('[role="checkbox"], input[type="checkbox"]')) e.preventDefault();
  },
  true,
);
