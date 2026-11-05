// Retrait d'un tag d'un ou de plusieurs médias : pop-in qui propose de retirer aussi les parents que sa chaîne de
// règles y avait posés (TAGM-22, cas P-08 du test complet de la refonte ; réponses du 04/11). Ceux qu'une autre règle
// justifie encore, ou qui étaient là avant la règle, ne sont pas proposés ; rien à proposer : pas de pop-in. Le tag
// retiré reste retiré dans tous les cas ; « Non » (Échap) garde les parents.

import { api, type ChainParents, type MediaKind } from "./api";
import { ask, media, q, runTagAction } from "./tagRules";

const THIS: Record<MediaKind, string> = { image: "cette image", video: "cette vidéo", document: "ce document", audio: "ce fichier audio" };

/** « « a » », « « a » et « b » », « « a », « b » et « c » ». */
const list = (names: string[]) => (names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`);

/** Ce qui partirait, à demander AVANT de retirer les tags : leur retrait efface la note qui donne l'origine de la
 *  chaîne (« chat » posé par « essai chaton »). */
export const previewChain = (mediaIds: number[], tagIds: number[]): Promise<ChainParents | null> =>
  mediaIds.length === 0 || tagIds.length === 0 ? Promise.resolve(null) : api.chainParents(mediaIds, tagIds).catch(() => null);

/** Sélection : chaque parent avec le nombre de médias d'où il partirait, ceux au même nombre regroupés, dans l'ordre
 *  de la chaîne (réponse du 05/11) : « « essai chat » à 4 médias, « essai animal » et « essai etre vivant » à
 *  2 médias ». */
function perCount(found: ChainParents) {
  const groups: { n: number; names: string[] }[] = [];
  found.parents.forEach((name, i) => {
    const n = found.counts[i] ?? found.media;
    const group = groups.find((g) => g.n === n);
    if (group) group.names.push(q(name));
    else groups.push({ n, names: [q(name)] });
  });
  return groups.map((g) => `${list(g.names)} à ${media(g.n)}`).join(", ");
}

/** Après le retrait : la pop-in, s'il y a des parents à proposer. `kind` : un seul média (visionneuse) ; sans lui,
 *  les médias d'une sélection. */
export async function offerChainRemoval(found: ChainParents | null, mediaIds: number[], tagIds: number[], kind?: MediaKind): Promise<void> {
  if (!found || found.parents.length === 0) return;
  const one = found.parents.length === 1;
  const origins = found.origins.map(q);
  const several = origins.length > 1;
  const chains = several ? `les chaînes de parents de ${list(origins)}` : `la chaîne de parents de ${origins[0]}`;
  const question = `Voulez-vous aussi ${one ? "le" : "les"} retirer ?`;
  const message = kind
    ? `${list(found.parents.map(q))} ${one ? "a été ajouté" : "ont été ajoutés"} à ${THIS[kind]} via ${chains}. ${question}`
    : `Dans la sélection, ${chains} ${several ? "ont" : "a"} ajouté ${perCount(found)}. ${question}`;
  await ask({
    title: one ? "Retirer aussi ce parent ?" : "Retirer aussi ces parents ?",
    message,
    confirmLabel: "Oui",
    cancelLabel: "Non",
    run: () => runTagAction("Retirer les parents", () => api.removeChainParents(mediaIds, tagIds)),
  });
}
