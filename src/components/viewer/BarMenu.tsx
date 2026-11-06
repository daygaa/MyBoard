// Petit menu d'un bouton de la barre de lecture, ouvert au-dessus de lui : vitesses (VIEW-29), sous-titres
// (VIEW-52). Fermé par Échap, un clic ailleurs ou quand les commandes se cachent (VIEW-49). Un clic sur un
// bouton ou dans la barre du bas agit en plus ; sur la vidéo ou le fond gris autour, il ferme seulement le
// menu (ni pause, ni fermeture de la visionneuse).

import { useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { useEscape } from "@/lib/escape";
import { swallowClick } from "@/lib/swallowClick";
import { cn } from "@/lib/utils";
import { ViewerChrome } from "./viewerChrome";

/** `separated` : trait au-dessus de l'entrée (commandes après la liste des choix). */
export type BarMenuItem = { key: string; label: string; active: boolean; onSelect: () => void; separated?: boolean };

type Props = {
  zone: string;
  title: string;
  /** Contenu du bouton. */
  children: ReactNode;
  items: BarMenuItem[];
  disabled?: boolean;
  buttonClassName: string;
  itemClassName?: string;
};

export function BarMenu({ zone, title, children, items, disabled = false, buttonClassName, itemClassName }: Props) {
  const { idle } = useContext(ViewerChrome);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEscape(open, () => setOpen(false));
  useEffect(() => {
    if (idle || disabled) setOpen(false);
  }, [idle, disabled]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: globalThis.PointerEvent) => {
      // Boutons 4 et 5 : pile d'Échap (escape.ts).
      if (e.button > 2 || !(e.target instanceof Element) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
      if (e.button === 0 && e.target.closest('[data-zone="visionneuse.video"]')) swallowClick(e);
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [open]);
  return (
    <div ref={menuRef} className="relative">
      <button type="button" data-zone={zone} disabled={disabled} onClick={() => setOpen(!open)} title={title} className={buttonClassName}>
        {children}
      </button>
      {open && (
        <ul data-zone={`${zone}.menu`} className="absolute right-0 bottom-full z-30 mb-1 rounded-md border border-border bg-popover p-1 shadow-lg">
          {items.map((item) => (
            <li key={item.key} className={cn(item.separated && "mt-1 border-t border-border pt-1")}>
              <button
                type="button"
                onClick={() => {
                  item.onSelect();
                  setOpen(false);
                }}
                className={cn("w-full rounded px-3 py-1 text-xs whitespace-nowrap hover:bg-secondary", item.active ? "text-[#d9a94e]" : "text-foreground", itemClassName)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
