// Barre latérale de la bibliothèque (apparence v8) : recherche et tags de la page.
// La recherche et la liste des tags arrivent en phase 2 (SRCH-01, SRCH-10) : ici,
// la structure est en place mais le champ est désactivé.
// Hauteur MAXIMALE (pas fixe) : avec peu de contenu, le pied de page reste visible en bas (GEN-05).

import { Search } from "lucide-react";

export function Sidebar() {
  return (
    <aside
      data-zone="barre-laterale"
      className="sticky top-14 hidden max-h-[calc(100vh-3.5rem)] w-72 shrink-0 overflow-y-auto border-r border-border bg-card/40 px-4 py-5 md:block"
    >
      <section data-zone="barre-laterale.recherche">
        <h3 className="mb-2 px-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Recherche</h3>
        <div className="flex gap-2" title="Recherche par tags : phase 2">
          <input
            disabled
            placeholder="Ajouter un tag à la recherche…"
            className="h-[38px] min-w-0 flex-1 cursor-not-allowed rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-60"
          />
          <button
            type="button"
            disabled
            aria-label="Rechercher"
            className="grid h-[38px] w-[38px] shrink-0 cursor-not-allowed place-items-center rounded-lg bg-[#d9a94e] text-[#1a1408] opacity-60"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      </section>

      <section data-zone="barre-laterale.tags" className="mt-6">
        <h3 className="mb-2 flex items-center justify-between px-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Tags
        </h3>
        <p className="px-1 text-sm text-muted-foreground">Aucun tag.</p>
      </section>
    </aside>
  );
}
