// Aperçu des règles d'un import (retour T3, point TAGM-18.9 ; réponses du 04/11) : sous le cadre des tags, un cadre avec
// « Groupes de synonymes » puis « Règles de parents », une ligne par règle créée ou modifiée, avec le mot qui dit ce qui
// se passe (Nouveau, Complété, Réunis, Modifié ; Nouvelle). Un nom fusionné après l'import porte « (F) », en gris ; une
// règle dont un tag est fusionné, « (mise de côté) » (retour T3, point TAGM-18.11).
// Chaque nom reste d'un bloc (GEN-22).

import { Fragment, type ReactNode } from "react";

import { whole } from "@/lib/keepWords";
import type { GroupLine, ImportReport, LineName } from "@/lib/rulesApi";
import { displayTag } from "@/lib/tags";
import { cn } from "@/lib/utils";

const KIND: Record<GroupLine["kind"], string> = { new: "Nouveau", completed: "Complété", joined: "Réunis", changed: "Modifié" };

function Name({ name, star = false }: { name: LineName; star?: boolean }) {
  return (
    <span className={cn("font-mono", name.merged ? "text-muted-foreground" : "text-foreground")}>
      {star && "★ "}
      {whole(displayTag(name.name))}
      {name.merged && " (F)"}
    </span>
  );
}

/** « ★ principal = nom = nom ». */
function Group({ principal, names }: { principal: LineName; names: LineName[] }) {
  return (
    <>
      <Name name={principal} star />
      {names.map((n) => (
        <Fragment key={n.name}>
          {" = "}
          <Name name={n} />
        </Fragment>
      ))}
    </>
  );
}

/** « , + nom, nom » : ce que l'import ajoute à un groupe existant. */
function Added({ names }: { names: LineName[] }) {
  return names.length ? (
    <>
      {", + "}
      {names.map((n, i) => (
        <Fragment key={n.name}>
          {i > 0 && ", "}
          <Name name={n} />
        </Fragment>
      ))}
    </>
  ) : null;
}

function Line({ word, children }: { word: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-0.5">
      <span className="w-16 shrink-0 text-muted-foreground">{word}</span>
      <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
    </div>
  );
}

export function ImportRulesPreview({ report }: { report: ImportReport }) {
  if (report.groupLines.length === 0 && report.ruleLines.length === 0) return null;
  return (
    <div data-zone="import-tags.apercu-regles" className="mt-3">
      <p className="text-sm text-foreground">Règles :</p>
      <div className="mt-1 max-h-56 space-y-2 overflow-y-auto overscroll-contain rounded-lg border border-border p-2 text-sm select-text">
        {report.groupLines.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground">Groupes de synonymes</p>
            {report.groupLines.map((g) => (
              <Line key={g.principal.name} word={KIND[g.kind]}>
                {g.kind === "new" ? (
                  <Group principal={g.principal} names={g.added} />
                ) : (
                  <>
                    <Group principal={g.principal} names={g.names} />
                    {g.joined.map((j) => (
                      <Fragment key={j.principal.name}>
                        {", + "}
                        <Group principal={j.principal} names={j.names} />
                      </Fragment>
                    ))}
                    <Added names={g.added} />
                  </>
                )}
              </Line>
            ))}
          </div>
        )}
        {report.ruleLines.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground">Règles de parents</p>
            {report.ruleLines.map((r) => (
              <Line key={`${r.child}→${r.parent}`} word="Nouvelle">
                <span className="font-mono text-foreground">
                  {whole(displayTag(r.child))} → {whole(displayTag(r.parent))}
                </span>
                {!r.enabled && <span className="text-muted-foreground"> (éteinte)</span>}
                {r.aside && <span className="text-muted-foreground"> (mise de côté)</span>}
              </Line>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
