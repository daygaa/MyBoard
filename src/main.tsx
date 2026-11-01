import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";

// Police à chasse fixe de la v8 (poids, dimensions…), embarquée : aucune connexion internet.
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";
import "@fontsource/geist-mono/600.css";
import "./index.css";
// Alt + ← / → : précédent / suivant de MyBoard (GEN-18).
import "./lib/browserKeys";
// Échap retire le focus d'un champ ; double clic sur le texte d'une case sans surlignage (GEN-27, GEN-17).
import "./lib/fieldHabits";

import { App } from "./App";
import { queryClient } from "./lib/queryClient";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
