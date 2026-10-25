// Écouteurs d'un champ à pastilles (SEL-12) posés une fois : saisie du navigateur (`beforeinput`),
// sélection du navigateur (↑ / ↓ dans un champ sur plusieurs lignes…) et commandes du menu d'édition du
// clic droit (CTX-03). Ils appellent toujours les dernières fonctions du champ (`handlers`).

import { useEffect, type RefObject } from "react";

import { registerEditable, type EditCommands } from "@/lib/textMenus";

export type PillHandlers = {
  beforeInput: (e: InputEvent) => void;
  selectionChange: () => void;
  edit: EditCommands;
};

export function usePillListeners(editor: RefObject<HTMLDivElement | null>, handlers: RefObject<PillHandlers>) {
  useEffect(() => {
    const el = editor.current;
    if (!el) return;
    const beforeInput = (e: InputEvent) => handlers.current.beforeInput(e);
    const selectionChange = () => handlers.current.selectionChange();
    el.addEventListener("beforeinput", beforeInput);
    document.addEventListener("selectionchange", selectionChange);
    const unregister = registerEditable(el, () => handlers.current.edit);
    return () => {
      el.removeEventListener("beforeinput", beforeInput);
      document.removeEventListener("selectionchange", selectionChange);
      unregister();
    };
  }, [editor, handlers]);
}
