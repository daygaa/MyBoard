// Pop-in « Créer un nouveau tag » (VIEW-22, v8 ✓) : le tag tapé n'existe pas encore,
// on choisit sa catégorie avant de le créer. Nom long (VIEW-46) : à la ligne dans la largeur de
// la pop-in, 2 lignes au plus puis « … » (nom complet dans une bulle au survol) ; la pop-in grandit
// vers le haut, les boutons restent à leur place.
// Avec `refusal` (bouton « Créer un tag » du gestionnaire, retour T3, point TAGM-04.8), le nom se tape
// dans la pop-in ; un nom déjà pris est refusé (« Créer » grisé, raison sous le champ). Un nom qui est dans la corbeille
// des tags (TAGM-19) : « Voulez-vous restaurer … ? » d'abord (à l'ouverture, ou à « Créer » quand le nom se tape dans la
// pop-in) ; « Oui » le restaure et la suite se fait avec lui, « Non » crée un nouveau tag.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { normalizeTag } from "@/lib/tags";
import { offerRestore } from "@/lib/tagTrash";
import { titleIfCut } from "@/lib/utils";
import { CategorySelect, useDefaultCategory } from "./CategorySelect";

/** Guillemets autour du nom, dans la police du texte. */
const QUOTE = "font-sans font-normal text-muted-foreground";

type Props = {
  /** Nom du tag à créer ; `null` = pop-in fermée. */
  name: string | null;
  onCancel: () => void;
  onCreate: (categoryId: number, name: string) => void;
  /** Nom tapé dans la pop-in (`name` = sa valeur de départ) : raison d'un refus (nom déjà pris), `null`
   *  si le nom (normalisé) est libre. */
  refusal?: (name: string) => string | null;
  /** Nom restauré depuis la corbeille (TAGM-19) ; sans cette fonction, `onCreate` suit (le tag existe alors, avec
   *  sa catégorie d'origine : la suite le reprend). */
  onRestored?: (name: string) => void;
};

const LABEL = "mb-2 text-xs font-medium text-muted-foreground";

export function CreateTagDialog({ name, onCancel, onCreate, refusal, onRestored }: Props) {
  const fallback = useDefaultCategory();
  // Nom donné à l'ouverture : la corbeille est consultée avant de montrer la pop-in.
  const [checked, setChecked] = useState<string | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const category = chosen ?? fallback;
  const [typed, setTyped] = useState<string | null>(null);
  const final = refusal ? normalizeTag(typed ?? name ?? "") : (name ?? "");
  const refused = refusal && final ? refusal(final) : null;
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const [lift, setLift] = useState(0);
  // Avec un nom court, la phrase tient sur 2 lignes : chaque ligne de plus fait remonter la pop-in
  // d'une demi-ligne, ce qui garde son bas (et ses boutons) au même endroit.
  useLayoutEffect(() => {
    const p = descriptionRef.current;
    if (p) setLift(Math.max(0, p.offsetHeight - 2 * parseFloat(getComputedStyle(p).lineHeight)) / 2);
  }, [name, checked]);
  const restored = (tag: string) => (onRestored ? onRestored(tag) : onCreate(category ?? 0, tag));
  useEffect(() => {
    if (name === null) setChecked(null);
    if (name === null || refusal) return;
    let live = true;
    void offerRestore(name).then((offer) => {
      if (!live) return;
      if (offer === "restored") restored(name);
      else setChecked(name);
    });
    return () => {
      live = false;
    };
    // Une fois par ouverture (la suite, `restored`, ne change pas pendant ce temps).
  }, [name, refusal]);
  const close = () => {
    setChosen(null);
    setTyped(null);
    onCancel();
  };
  const create = () => {
    if (category === null || !final || refused) return;
    const finish = () => {
      setChosen(null);
      setTyped(null);
    };
    // Nom tapé dans la pop-in : la corbeille est consultée à « Créer ».
    if (refusal) {
      void offerRestore(final).then((offer) => {
        finish();
        if (offer === "restored") restored(final);
        else onCreate(category, final);
      });
      return;
    }
    finish();
    onCreate(category, final);
  };
  return (
    <Modal
      open={name !== null && (refusal !== undefined || checked === name)}
      onEnter={create}
      onClose={close}
      zone="creation-tag"
      title="Créer un nouveau tag"
      lift={lift}
      description={
        refusal ? (
          <p ref={descriptionRef}>Choisis son nom et sa catégorie.</p>
        ) : (
          <p ref={descriptionRef}>
            Le tag{" "}
            <code
              onMouseEnter={(e) => titleIfCut(e.currentTarget)}
              className="max-w-full overflow-hidden align-top font-mono font-semibold text-foreground [overflow-wrap:anywhere]"
              // Boîte dans la ligne, coupée à 2 lignes par « … » (propriétés sans équivalent Tailwind).
              style={{ display: "-webkit-inline-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2 }}
            >
              {/* Guillemets dans la boîte : jamais séparés du nom (GEN-22). */}
              <span className={QUOTE}>«&nbsp;</span>
              {name}
              <span className={QUOTE}>&nbsp;»</span>
            </code>{" "}
            n'existe pas encore. Choisis une catégorie avant de le créer.
          </p>
        )
      }
      footer={
        <>
          <Button variant="ghost" onClick={close} className="text-foreground hover:bg-secondary hover:text-foreground">
            Annuler
          </Button>
          <Button
            data-zone="creation-tag.creer"
            disabled={category === null || !final || refused !== null}
            onClick={create}
            className="bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f] disabled:hover:bg-[#d9a94e]"
          >
            <Plus className="h-4 w-4" />
            Créer
          </Button>
        </>
      }
    >
      {refusal && (
        <div className="mb-4">
          <p className={LABEL}>Nom</p>
          {/* Entrée crée : la pop-in laisse Entrée aux champs (GEN-20). */}
          <input
            data-zone="creation-tag.nom"
            autoFocus
            value={typed ?? name ?? ""}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.repeat) return;
              e.preventDefault();
              create();
            }}
            placeholder="Nom du tag…"
            spellCheck={false}
            className="h-[38px] w-full rounded-lg border border-border bg-background px-3 font-mono text-sm text-foreground outline-none placeholder:font-sans placeholder:text-muted-foreground/60 focus:border-[#d9a94e]/60"
          />
          {refused && <p className="mt-1.5 text-xs text-rose-300">{refused}</p>}
        </div>
      )}
      <p className={LABEL}>Catégorie</p>
      <CategorySelect zone="creation-tag.categorie" value={category} onChange={setChosen} className="w-full" />
    </Modal>
  );
}
