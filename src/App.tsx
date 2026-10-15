// Squelette de l'application : barre de titre MyBoard (NAV-04), puis la zone qui défile (en-tête,
// page courante, pied de page) ; menu burger, visionneuse, menu du clic droit (CTX-01) et message
// d'échec d'une action lancée de la grille (CTX-19) par-dessus.

import { useEffect, useRef } from "react";

import { ImportPage } from "@/components/import/ImportPage";
import { BurgerMenu } from "@/components/layout/BurgerMenu";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { TitleBar } from "@/components/layout/TitleBar";
import { LibraryPage } from "@/components/library/LibraryPage";
import { ContextMenuHost } from "@/components/ui/context-menu";
import { ErrorDialog } from "@/components/viewer/ErrorDialog";
import { Viewer } from "@/components/viewer/Viewer";
import { useBackendEvents } from "@/hooks/useBackendEvents";
import { useRoute } from "@/lib/router";
import { SCROLLER_ID } from "@/lib/scroller";

export function App() {
  useBackendEvents();
  const route = useRoute();
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
        <div className="flex min-h-full flex-col">
          <Header />
          <div className="flex flex-1 flex-col">{route === "import" ? <ImportPage /> : <LibraryPage />}</div>
          <Footer />
        </div>
      </div>
      <BurgerMenu />
      <Viewer />
      <ContextMenuHost />
      <ErrorDialog />
    </div>
  );
}
