// Noms de tags et termes de recherche, côté interface (mêmes règles que src-tauri/src/tags.rs).

/** Nom normalisé : minuscules, espaces → « _ » (SRCH-05, D-016). Un « - » au début et un
 *  « * » à la fin sont réservés à la recherche (exclusion, joker). */
export function normalizeTag(raw: string): string {
  return raw.trim().split(/\s+/).join("_").toLowerCase().replace(/^-+/, "").replace(/\*+$/, "");
}

/** Nom affiché : « long_hair » → « long hair » (comme la v8, D-016). */
export function displayTag(name: string): string {
  return name.replace(/_/g, " ");
}

/** Termes tapés dans la recherche : séparés par des espaces, chacun normalisé en gardant
 *  son « - » (exclusion, SRCH-03) et son « * » final (joker, SRCH-04). */
export function parseTerms(text: string): string[] {
  const terms: string[] = [];
  for (const raw of text.split(/\s+/)) {
    const exclude = raw.startsWith("-");
    const prefix = raw.endsWith("*");
    const name = normalizeTag(raw);
    if (name) terms.push(`${exclude ? "-" : ""}${name}${prefix ? "*" : ""}`);
  }
  return terms;
}

/** Terme décomposé pour l'affichage d'une pastille. */
export function splitTerm(term: string): { exclude: boolean; name: string; prefix: boolean } {
  const exclude = term.startsWith("-");
  const prefix = term.endsWith("*");
  return { exclude, prefix, name: term.slice(exclude ? 1 : 0, prefix ? -1 : undefined) };
}
