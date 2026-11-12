// Recréer un nom qui est dans la corbeille des tags (TAGM-19, réponse du 05/11) : avant « Créer un nouveau tag », la
// pop-in « Voulez-vous restaurer « chat » ? » rappelle à quoi il était lié. « Oui » le restaure (tout comme avant) ;
// « Non » (Échap) laisse créer un nouveau tag de ce nom (restaurer l'ancien plus tard réunira les deux, sans annonce).

import { api } from "./api";
import { formatNumber, plural } from "./format";
import { restoreTrash } from "./tagManager";
import { ask, media, q } from "./tagRules";

/** `absent` : le nom n'est pas dans la corbeille ; `restored` : restauré ; `declined` : « Non ». */
export type TrashOffer = "absent" | "restored" | "declined";

export async function offerRestore(name: string): Promise<TrashOffer> {
  const found = await api.trashFind(name).catch(() => null);
  if (!found) return "absent";
  const rules = `${formatNumber(found.rules)} ${plural(found.rules, "règle de parents", "règles de parents")}`;
  const synonyms = `${formatNumber(found.synonyms)} ${plural(found.synonyms, "synonyme")}`;
  const yes = await ask({
    title: `Voulez-vous restaurer ${q(found.name)} ?`,
    message: `${q(found.name)} a été déplacé dans la corbeille, il était lié à ${media(found.media)}, ${rules} et avait ${synonyms}, voulez-vous le restaurer ?`,
    confirmLabel: "Oui",
    cancelLabel: "Non",
    // La restauration est attendue ci-dessous (la pop-in commune lance `run` sans l'attendre).
    run: () => Promise.resolve(),
  });
  if (!yes) return "declined";
  return (await restoreTrash([found.id], true)) !== undefined ? "restored" : "declined";
}
