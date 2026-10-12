// Explications en clair des codes d'erreur Windows les plus courants (VIEW-28), affichées en
// plus du message de Windows lui-même.

const EXPLANATIONS: Record<number, string> = {
  2: "Le fichier a été déplacé, renommé ou supprimé en dehors de MyBoard.",
  3: "Le dossier du fichier n'existe plus : il a été renommé ou supprimé, ou le disque qui le contient est débranché.",
  5: "Windows refuse l'accès à ce fichier (droits insuffisants, ou fichier bloqué par un antivirus).",
  15: "Le lecteur indiqué n'existe pas : disque externe ou réseau débranché ?",
  21: "Le disque n'est pas prêt : disque externe en veille, ou lecteur vide.",
  32: "Le fichier est utilisé par un autre programme.",
  53: "Le chemin réseau est introuvable : l'ordinateur ou le partage réseau ne répond pas.",
  1155: "Aucune application n'est associée à ce type de fichier. Choisis-en une dans les paramètres de Windows.",
  1223: "L'opération a été annulée.",
};

/** Explication d'un code d'erreur Windows, ou `null` si MyBoard n'en a pas pour ce code. */
export function explainWindowsError(code: number | null): string | null {
  return code === null ? null : (EXPLANATIONS[code] ?? null);
}

/** Erreur renvoyée par une commande d'ouverture du cœur Rust (`{ code, message }`). */
export function asOpenFailure(error: unknown): { code: number | null; message: string } {
  if (error && typeof error === "object" && "message" in error) {
    const { code, message } = error as { code?: number | null; message: unknown };
    return { code: code ?? null, message: String(message) };
  }
  return { code: null, message: String(error) };
}
