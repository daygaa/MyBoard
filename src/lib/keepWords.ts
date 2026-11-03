// Aucun mot coupé dans les pop-ins (GEN-22 ; retour T3, points TAGM-16.3 et TAGM-15.9) : un nom cité reste sur une
// seule ligne avec ses guillemets (espaces et traits d'union insécables), sauf s'il est plus long qu'une ligne
// (`overflow-wrap`, là où il s'affiche) ; « ? », « ! », « : » et « ; » ne partent jamais seuls à la ligne. La copie
// d'un texte de pop-in rend les caractères ordinaires (`copyPlain`).

/** Espace et trait d'union insécables. */
const NBSP = " ";
const NBHY = "‑";

/** Nom d'un bloc, sans guillemets. */
export const whole = (text: string) => text.replace(/ /g, NBSP).replace(/-/g, NBHY);

/** « nom », jamais coupé ni séparé de ses guillemets. */
export const quote = (text: string) => `«${NBSP}${whole(text)}${NBSP}»`;

/** Texte d'une pop-in (message du cœur Rust, d'une erreur…) : chaque « … » d'un bloc, ponctuation double attachée au
 *  mot qui la précède. */
export const keepQuoted = (text: string) => text.replace(/«[  ]([^«»]*?)[  ]»/g, (_, inner: string) => quote(inner)).replace(/ ([?!:;])/g, `${NBSP}$1`);

/** Copie d'un texte de pop-in : traits d'union et espaces ordinaires, pour coller un tag dans un champ. */
export function copyPlain(e: React.ClipboardEvent) {
  const text = window.getSelection()?.toString();
  if (!text) return;
  e.preventDefault();
  e.clipboardData.setData("text/plain", text.replace(/‑/g, "-").replace(/ /g, " "));
}
