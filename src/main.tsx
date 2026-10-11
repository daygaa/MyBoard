import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Police à chasse fixe de la v8 (poids, dimensions…), embarquée : aucune connexion internet.
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";
import "@fontsource/geist-mono/600.css";
import "./index.css";

import { App } from "./App";

const queryClient = new QueryClient({
  defaultOptions: {
    // Données locales : pas de relecture automatique au retour sur la fenêtre.
    queries: { refetchOnWindowFocus: false, retry: false },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
