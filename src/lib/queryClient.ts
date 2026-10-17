// Client des requêtes (React Query), partagé : les actions lancées hors des composants (menus du clic
// droit, suppression, favoris) relisent elles aussi les données qui en dépendent.

import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    // Données locales : pas de relecture automatique au retour sur la fenêtre.
    queries: { refetchOnWindowFocus: false, retry: false },
  },
});
