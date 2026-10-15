// Ouvertures externes depuis la visionneuse (Explorateur, application par défaut, copie dans le
// presse-papiers, lien d'une note) : en cas d'échec, le message d'erreur avec le code Windows
// s'affiche (VIEW-28). Renvoie vrai si l'action a réussi. Curseur d'attente pendant l'appel (GEN-13).

import { whileBusy } from "@/lib/busy";
import { asOpenFailure } from "@/lib/windowsErrors";
import { useViewer } from "@/stores/viewer";

export async function runExternal(action: string, call: () => Promise<void>): Promise<boolean> {
  try {
    await whileBusy(call);
    useViewer.getState().setError(null);
    return true;
  } catch (error) {
    useViewer.getState().setError({ action, ...asOpenFailure(error) });
    return false;
  }
}
