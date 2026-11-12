// Squelette de l'application : barre de titre MyBoard (NAV-04), puis la zone qui défile (en-tête,
// page courante, pied de page) ; menu burger, visionneuse, menu du clic droit (CTX-01) et message
// d'échec d'une action lancée de la grille (CTX-19) et restauration des données en fin d'import
// (DEL-05) par-dessus ; bilan de l'import (IMP-45), fichiers disparus (LIB-05), bandeau des emplacements inaccessibles
// sous l'en-tête (LIB-14) ; badge du travail sur les tags en arrière-plan (TAGM-23).

import { useEffect, useRef } from "react";

import { ImportPage } from "@/components/import/ImportPage";
import { ImportReport } from "@/components/import/ImportReport";
import { RestoreDialog } from "@/components/import/RestoreDialog";
import { BurgerMenu } from "@/components/layout/BurgerMenu";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { TagJobBadge } from "@/components/layout/TagJobBadge";
import { TitleBar } from "@/components/layout/TitleBar";
import { DeleteFailedDialog } from "@/components/library/DeleteFailedDialog";
import { LibraryPage } from "@/components/library/LibraryPage";
import { MissingDialog } from "@/components/library/MissingDialog";
import { OfflineBanner } from "@/components/library/OfflineBanner";
import { RuleAskHost } from "@/components/tagmanager/RuleAskHost";
import { TagManagerPage } from "@/components/tagmanager/TagManagerPage";
import { ContextMenuHost } from "@/components/ui/context-menu";
import { ErrorDialog } from "@/components/viewer/ErrorDialog";
import { Viewer } from "@/components/viewer/Viewer";
import { useBackendEvents } from "@/hooks/useBackendEvents";
import { useRoute, useTagTab } from "@/lib/router";
import { SCROLLER_ID } from "@/lib/scroller";
import { cn } from "@/lib/utils";

export function App() {
  useBackendEvents();
  const route = useRoute();
  // Onglet « Synonymes et parents » : la page tient dans la fenêtre, chaque tableau a sa barre de défilement
  // (demande du 26/10) ; ailleurs, la page défile.
  const tagTab = useTagTab();
  const fitted = route === "tags" && tagTab === "rules";
  const scrollArea = useRef<HTMLDivElement>(null);
  // Défilement au clavier (Espace, Page suivante…) dès l'ouverture : la zone prend le focus.
  useEffect(() => scrollArea.current?.focus({ preventScroll: true }), []);

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <div
        ref={scrollArea}
        id={SCROLLER_ID}
        data-zone="defilement"
        tabIndex={-1}
        className="app-scroll min-h-0 flex-1 overflow-y-auto outline-none"
      >
        <div className={cn("flex flex-col", fitted ? "h-full" : "min-h-full")}>
          <Header />
          <OfflineBanner />
          <div className={cn("flex flex-1 flex-col", fitted && "min-h-0")}>{route === "import" ? <ImportPage /> : route === "tags" ? <TagManagerPage /> : <LibraryPage />}</div>
          <Footer />
        </div>
      </div>
      <BurgerMenu />
      <Viewer />
      <ContextMenuHost />
      <ErrorDialog />
      {/* Pop-ins des synonymes et des règles : aussi pour « Renommer… » depuis un menu du clic droit (lot R6-1). */}
      <RuleAskHost />
      <DeleteFailedDialog />
      <ImportReport />
      <RestoreDialog />
      <MissingDialog />
      {/* Avancement de la corbeille des tags en arrière-plan (TAGM-23). */}
      <TagJobBadge />
    </div>
  );
}
