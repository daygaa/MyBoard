// Ouvertures externes depuis la visionneuse (Explorateur, application par défaut, lien d'une
// note) : en cas d'échec, le message d'erreur avec le code Windows s'affiche (VIEW-28).

import { asOpenFailure } from "@/lib/windowsErrors";
import { useViewer } from "@/stores/viewer";

export async function runExternal(action: string, call: () => Promise<void>): Promise<void> {
  try {
    await call();
    useViewer.getState().setError(null);
  } catch (error) {
    useViewer.getState().setError({ action, ...asOpenFailure(error) });
  }
}
