// Squelette de l'application : en-tête, menu burger, page courante, pied de page.

import { ImportPage } from "@/components/import/ImportPage";
import { BurgerMenu } from "@/components/layout/BurgerMenu";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { LibraryPage } from "@/components/library/LibraryPage";
import { Viewer } from "@/components/viewer/Viewer";
import { useBackendEvents } from "@/hooks/useBackendEvents";
import { useRoute } from "@/lib/router";

export function App() {
  useBackendEvents();
  const route = useRoute();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <BurgerMenu />
      <div className="flex flex-1 flex-col">{route === "import" ? <ImportPage /> : <LibraryPage />}</div>
      <Footer />
      <Viewer />
    </div>
  );
}
