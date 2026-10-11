// En-tête collé en haut : menu burger à gauche, logo au centre exact (NAV-01),
// statistiques (NAV-03) et bouton Importer à droite.
// Fond opaque (la v8 utilisait un flou d'arrière-plan, coûteux pendant le défilement : D-008).

import { Film, Image as ImageIcon, Menu, Tag, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useStats } from "@/hooks/useLibraryData";
import { formatCount } from "@/lib/format";
import { navigate } from "@/lib/router";
import { useUI } from "@/stores/ui";

export function Header() {
  const burgerOpen = useUI((s) => s.burgerOpen);
  const toggleBurger = useUI((s) => s.toggleBurger);
  const { data: stats } = useStats();

  return (
    <header data-zone="entete" className="sticky top-0 z-40 border-b border-border bg-background">
      {/* Trois colonnes : les deux côtés ont la même largeur, le logo est donc au centre exact. */}
      <div className="grid min-h-14 grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 sm:gap-4 sm:px-4 lg:px-6">
        <div className="flex items-center">
          <Button
            data-zone="entete.menu"
            variant="ghost"
            size="icon"
            aria-label={burgerOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={burgerOpen}
            onClick={toggleBurger}
            className={burgerOpen ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        <button
          type="button"
          data-zone="entete.logo"
          onClick={() => navigate("library")}
          className="flex items-center gap-2.5"
          aria-label="MyBoard — accueil"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[#e3b75f] to-[#b88838] shadow-sm ring-2 ring-[#d9a94e]/40">
            <span className="block h-2.5 w-2.5 rounded-full bg-[#1a1408]" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-foreground">
            My<span className="text-[#d9a94e]">Board</span>
          </span>
        </button>

        <div className="flex items-center justify-end gap-3 sm:gap-4">
          <div data-zone="entete.stats" className="hidden items-center gap-3 text-xs text-muted-foreground lg:flex">
            <span className="inline-flex items-center gap-1.5" title="Images">
              <ImageIcon className="h-3.5 w-3.5 text-[#d9a94e]/80" />
              <span className="tabular-nums">{formatCount(stats?.images ?? 0)}</span>
            </span>
            <span className="inline-flex items-center gap-1.5" title="Vidéos">
              <Film className="h-3.5 w-3.5 text-[#d9a94e]/80" />
              <span className="tabular-nums">{formatCount(stats?.videos ?? 0)}</span>
            </span>
            <span className="inline-flex items-center gap-1.5" title="Tags">
              <Tag className="h-3.5 w-3.5 text-[#d9a94e]/80" />
              <span className="tabular-nums">{formatCount(stats?.tags ?? 0)}</span>
            </span>
          </div>

          <Button
            data-zone="entete.importer"
            size="sm"
            onClick={() => navigate("import")}
            className="shrink-0 gap-1.5 bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f] focus-visible:ring-[#d9a94e]/40"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Importer</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
