// Menu burger dépliant à gauche (NAV-02), apparence v8.
// Ordre : Bibliothèque · Importer · Favoris · Gestionnaire de tags · Dossiers · Paramètres (dernier).
// Les fonctions des phases suivantes sont visibles mais grisées, avec la mention « bientôt ».

import type { ComponentType } from "react";
import { LibraryBig, Plus, Settings, Star, Tags, Upload, X } from "lucide-react";

import { useEscape } from "@/lib/escape";
import { navigate, useRoute, type Route } from "@/lib/router";
import { cn } from "@/lib/utils";
import { useUI } from "@/stores/ui";

type Item = { label: string; icon: ComponentType<{ className?: string }>; route?: Route };

const ITEM_CLASS = "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition";

function NavItem({ item, onDone }: { item: Item; onDone: () => void }) {
  const route = useRoute();
  const Icon = item.icon;
  if (!item.route) {
    return (
      <button type="button" disabled title="Bientôt disponible" className={cn(ITEM_CLASS, "cursor-not-allowed text-muted-foreground/60")}>
        <Icon className="h-4 w-4 text-[#d9a94e]/60" />
        {item.label}
        <span className="ml-auto text-[10px] text-muted-foreground/50">bientôt</span>
      </button>
    );
  }
  const target = item.route;
  return (
    <button
      type="button"
      onClick={() => {
        navigate(target);
        onDone();
      }}
      className={cn(ITEM_CLASS, "text-foreground hover:bg-secondary", route === target && "bg-secondary")}
    >
      <Icon className="h-4 w-4 text-[#d9a94e]" />
      {item.label}
    </button>
  );
}

export function BurgerMenu() {
  const open = useUI((s) => s.burgerOpen);
  const setOpen = useUI((s) => s.setBurgerOpen);
  const close = () => setOpen(false);

  // Échap (et le bouton 4 de la souris, VIEW-03) ferme le menu.
  useEscape(open, close);

  return (
    <>
      {/* Fond assombri opaque (pas de flou : D-008) ; un clic dessus ferme le menu. */}
      <div
        aria-hidden
        onClick={close}
        className={cn(
          // Sous la barre de titre (NAV-04) et l'en-tête.
          "fixed inset-0 top-[calc(var(--titlebar-h)+3.5rem)] z-20 bg-black/30 transition-opacity duration-300",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        data-zone="menu"
        aria-label="Menu de navigation"
        aria-hidden={!open}
        inert={!open}
        className={cn(
          "fixed top-[calc(var(--titlebar-h)+3.5rem)] bottom-0 left-0 z-30 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-border bg-card shadow-2xl shadow-black/40 transition-transform duration-300",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">Navigation</span>
          <button
            type="button"
            onClick={close}
            aria-label="Fermer le menu"
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav data-zone="menu.navigation" className="space-y-0.5 p-2">
          <NavItem item={{ label: "Bibliothèque", icon: LibraryBig, route: "library" }} onDone={close} />
          <NavItem item={{ label: "Importer des médias", icon: Upload, route: "import" }} onDone={close} />
          <NavItem item={{ label: "Favoris", icon: Star }} onDone={close} />
          <NavItem item={{ label: "Gestionnaire de Tags", icon: Tags }} onDone={close} />
        </nav>

        <div data-zone="menu.dossiers" className="mt-2 border-t border-border p-2">
          <div className="flex items-center justify-between px-3 py-1.5">
            <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Dossiers</h3>
            <button
              type="button"
              disabled
              title="Bientôt disponible"
              className="inline-flex cursor-not-allowed items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground/60"
            >
              <Plus className="h-3.5 w-3.5" /> Nouveau
            </button>
          </div>
          <p className="px-3 py-3 text-xs text-muted-foreground">Aucun dossier pour le moment.</p>
        </div>

        <nav data-zone="menu.parametres" className="border-t border-border p-2">
          <NavItem item={{ label: "Paramètres", icon: Settings }} onDone={close} />
        </nav>
      </aside>
    </>
  );
}
