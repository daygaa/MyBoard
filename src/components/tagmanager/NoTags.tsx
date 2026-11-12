// Gestionnaire sans aucun tag (TAGM-24, réponse Q8 A du 12/11) : à la place du tableau, un texte au milieu qui invite à
// créer un tag, avec le bouton « Créer un tag » (le même que celui de l'en-tête), comme la bibliothèque sans média.

import type { ComponentProps } from "react";

import { NewTagButton } from "./NewTagButton";

export function NoTags(props: ComponentProps<typeof NewTagButton>) {
  return (
    <div data-zone="gestionnaire-tags.vide" className="grid select-text place-items-center rounded-2xl border border-dashed border-border py-24 text-center">
      <p className="text-lg font-medium text-foreground">Aucun tag pour le moment</p>
      <p className="mt-1 text-sm text-muted-foreground">Créez votre premier tag pour commencer à classer vos médias.</p>
      <div className="mt-5">
        <NewTagButton {...props} zone="gestionnaire-tags.vide.creer" big />
      </div>
    </div>
  );
}
