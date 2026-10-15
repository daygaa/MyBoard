// Alt + ← / Alt + → : précédent / suivant de MyBoard (GEN-18), comme les boutons 4 / 5 de la souris
// et les flèches de la barre de titre (convention de l'Explorateur Windows). Le retour du navigateur
// sur ces touches est retiré par le cœur Rust (webview_settings.rs), comme les autres raccourcis du
// navigateur sans objet dans une application.

import { goBack, goForward } from "./escape";

window.addEventListener(
  "keydown",
  (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    e.preventDefault();
    if (e.key === "ArrowLeft") goBack();
    else goForward();
  },
  true,
);
