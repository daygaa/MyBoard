// Tags cités dans le texte d'une pop-in (GEN-32, demande du 15/11) : chaque « nom » qui est un tag de la bibliothèque
// prend la couleur de sa catégorie (gris pour un nom fusionné) et la police du gestionnaire (chasse fixe), sans
// guillemets ; un « nom » qui n'est pas un tag (bouton, case, dossier…) garde ses guillemets. Le reste du texte suit
// les règles des pop-ins (aucun mot coupé, GEN-22).

import { Fragment } from "react";
import { useQuery } from "@tanstack/react-query";

import { FALLBACK_COLOR, useCategories } from "@/hooks/useCategories";
import { api } from "@/lib/api";
import { keepQuoted, quote, whole } from "@/lib/keepWords";
import { normalizeTag } from "@/lib/tags";

/** « nom » (espaces ordinaires ou insécables), capturé. */
const QUOTED = /(«[  ][^«»]*?[  ]»)/;
const INNER = /^«[  ](.*)[  ]»$/;

function QuotedName({ inner }: { inner: string }) {
  // Les textes déjà passés par `quote()` ont des espaces et traits d'union insécables : rendus ordinaires.
  const plain = inner.replace(/‑/g, "-").replace(/ /g, " ").trim();
  const name = normalizeTag(plain);
  const { data: tag } = useQuery({ queryKey: ["tag", name], queryFn: () => api.findTag(name), enabled: name !== "", staleTime: 30_000 });
  const { color } = useCategories();
  if (!tag) return <>{quote(plain)}</>;
  const merged = tag.alias !== undefined && normalizeTag(tag.alias) !== normalizeTag(tag.name);
  return (
    <span data-zone="tag-cite" className="font-mono" style={{ color: merged ? FALLBACK_COLOR : color(tag.categoryId) }}>
      {whole(plain)}
    </span>
  );
}

/** Texte d'une pop-in, tags cités en couleur. */
export function TagText({ text }: { text: string }) {
  return text.split(QUOTED).map((part, i) => {
    const inner = INNER.exec(part)?.[1];
    return <Fragment key={i}>{inner !== undefined ? <QuotedName inner={inner} /> : keepQuoted(part)}</Fragment>;
  });
}

/** Mise en forme des pop-ins des tags (`renderText` de Modal et ConfirmDialog). */
export const tagText = (text: string) => <TagText text={text} />;

/** Même chose pour un contenu qui peut déjà être un élément. */
export const tagNode = (value: React.ReactNode) => (typeof value === "string" ? <TagText text={value} /> : value);
