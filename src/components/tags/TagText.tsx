// Tags cités (GEN-32, principe général du 17/11) : tout tag cité passe par `q()` (lib/tagRules), qui le marque
// (`TAG_MARK`) ; toute pop-in (`Modal`, `ConfirmDialog`, pop-in d'erreur) et tout menu le met en forme d'office : couleur
// de sa catégorie (nom fusionné : un gris à lui, plus clair que le texte, retour 32.1), police du gestionnaire (chasse
// fixe), sans guillemets. Un « nom » non marqué (bouton, case, dossier…), ou un tag qui n'existe pas (encore), garde
// ses guillemets. Le reste du texte suit les règles des pop-ins (aucun mot coupé, GEN-22).

import { Fragment } from "react";
import { useQuery } from "@tanstack/react-query";

import { useCategories } from "@/hooks/useCategories";
import { api } from "@/lib/api";
import { TAG_MARK, keepQuoted, quote, whole } from "@/lib/keepWords";
import { normalizeTag } from "@/lib/tags";

/** Nom fusionné cité : gris plus clair que le texte des pop-ins (#8b8d96), pour ne pas s'y confondre (retour 32.1). */
export const MERGED_CITED = "#b9bcc6";

/** Espace ordinaire ou insécable. */
const SPACE = "[ \\u00a0]";
/** « tag » marqué, capturé ; son nom seul. */
const MARKED = new RegExp(`(«${SPACE}${TAG_MARK}[^«»${TAG_MARK}]*${TAG_MARK}${SPACE}»)`);
const INNER = new RegExp(`^«${SPACE}${TAG_MARK}(.*)${TAG_MARK}${SPACE}»$`);

function CitedTag({ inner }: { inner: string }) {
  // Passé par `quote()` : espaces et traits d'union insécables, rendus ordinaires pour retrouver le tag.
  const plain = inner.replace(/‑/g, "-").replace(/ /g, " ").trim();
  const name = normalizeTag(plain);
  const { data: tag } = useQuery({ queryKey: ["tag", name], queryFn: () => api.findTag(name), enabled: name !== "", staleTime: 30_000 });
  const { color } = useCategories();
  if (!tag) return <>{quote(plain)}</>;
  const merged = tag.alias !== undefined && normalizeTag(tag.alias) !== normalizeTag(tag.name);
  return (
    <span data-zone="tag-cite" className="font-mono" style={{ color: merged ? MERGED_CITED : color(tag.categoryId) }}>
      {whole(plain)}
    </span>
  );
}

/** Texte d'une pop-in ou d'un menu, tags cités en couleur. */
export function TagText({ text }: { text: string }) {
  if (!text.includes(TAG_MARK)) return <>{keepQuoted(text)}</>;
  return text.split(MARKED).map((part, i) => {
    const inner = INNER.exec(part)?.[1];
    return <Fragment key={i}>{inner !== undefined ? <CitedTag inner={inner} /> : keepQuoted(part)}</Fragment>;
  });
}

/** Mise en forme d'office des pop-ins (`renderText` par défaut de Modal, donc de ConfirmDialog). */
export const tagText = (text: string) => <TagText text={text} />;

/** Même chose pour un contenu qui peut déjà être un élément. */
export const tagNode = (value: React.ReactNode) => (typeof value === "string" ? <TagText text={value} /> : value);
