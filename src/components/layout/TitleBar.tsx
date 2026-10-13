// Barre de titre MyBoard (NAV-04), à la place de celle de Windows : icône et « MyBoard », flèches
// précédent / suivant (= boutons 4 / 5 de la souris, grisées quand ils ne feraient rien), puis
// réduire / agrandir / fermer. Toute la barre sert à déplacer la fenêtre (aimantation aux bords
// comprise), double-clic = agrandir / rétablir (gérés par Tauri : `data-tauri-drag-region`).
// Toujours visible, visionneuse comprise ; cachée en plein écran.

import { useEffect, useState, type ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ChevronLeft, ChevronRight, Copy, Minus, Square, X } from "lucide-react";

import { useBackForward } from "@/hooks/useBackForward";
import { goBack, goForward } from "@/lib/escape";
import { cn } from "@/lib/utils";
import { useViewer } from "@/stores/viewer";

/** Fenêtre agrandie ? (icône du bouton du milieu) */
function useMaximized(): boolean {
  const [maximized, setMaximized] = useState(true);
  useEffect(() => {
    const window_ = getCurrentWindow();
    const read = () => void window_.isMaximized().then(setMaximized);
    read();
    const stop = window_.onResized(read);
    return () => void stop.then((unlisten) => unlisten());
  }, []);
  return maximized;
}

function ArrowButton({ label, enabled, onClick, children }: { label: string; enabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={!enabled}
      onClick={onClick}
      className={cn(
        "grid h-6 w-7 place-items-center rounded transition",
        enabled ? "text-zinc-300 hover:bg-white/10 hover:text-white" : "cursor-default text-zinc-600",
      )}
    >
      {children}
    </button>
  );
}

/** Bouton de fenêtre à la manière de Windows : 46 px de large, toute la hauteur de la barre. */
function WindowButton({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "grid h-full w-[46px] place-items-center text-zinc-300 transition-colors",
        // Fermer : rouge de Windows au survol (choix de l'utilisateur, NAV-04).
        danger ? "hover:bg-[#e81123] hover:text-white" : "hover:bg-white/10 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

export function TitleBar() {
  const fullscreen = useViewer((s) => s.fullscreenShown);
  const maximized = useMaximized();
  const can = useBackForward();
  if (fullscreen) return null;
  const window_ = getCurrentWindow();

  return (
    <div
      data-zone="barre-titre"
      data-tauri-drag-region="deep"
      className="relative z-[130] flex h-[var(--titlebar-h)] shrink-0 items-center border-b border-border bg-[#0d0e12] select-none"
    >
      <div className="flex items-center gap-2 pr-2 pl-3">
        <span className="grid h-4 w-4 place-items-center rounded-full bg-gradient-to-br from-[#e3b75f] to-[#b88838]">
          <span className="block h-1.5 w-1.5 rounded-full bg-[#1a1408]" />
        </span>
        <span className="text-xs font-semibold tracking-tight text-zinc-300">
          My<span className="text-[#d9a94e]">Board</span>
        </span>
      </div>
      <div data-zone="barre-titre.navigation" className="flex items-center gap-0.5">
        <ArrowButton label="Précédent (bouton 4 de la souris)" enabled={can.back} onClick={goBack}>
          <ChevronLeft className="h-4 w-4" />
        </ArrowButton>
        <ArrowButton label="Suivant (bouton 5 de la souris)" enabled={can.forward} onClick={goForward}>
          <ChevronRight className="h-4 w-4" />
        </ArrowButton>
      </div>
      <div className="flex-1 self-stretch" />
      <div data-zone="barre-titre.fenetre" className="flex h-full">
        <WindowButton label="Réduire" onClick={() => void window_.minimize()}>
          <Minus className="h-4 w-4" />
        </WindowButton>
        <WindowButton label={maximized ? "Niveau inférieur" : "Agrandir"} onClick={() => void window_.toggleMaximize()}>
          {maximized ? <Copy className="h-3.5 w-3.5 -scale-x-100" /> : <Square className="h-3.5 w-3.5" />}
        </WindowButton>
        <WindowButton label="Fermer" danger onClick={() => void window_.close()}>
          <X className="h-4 w-4" />
        </WindowButton>
      </div>
    </div>
  );
}
