// Menu « Exporter ▾ » du gestionnaire de tags (TAGM-10) : code de partage des tags affichés (filtre en
// cours), de tous les tags ou des tags cochés, copié dans le presse-papiers ; message « N tags copiés ».

import type { RulesIndex } from "@/hooks/useTagRules";
import { api, type Category, type ManagedTag } from "@/lib/api";
import { openMenuAt } from "@/lib/contextMenu";
import { formatNumber, plural } from "@/lib/format";
import { encodeTags } from "@/lib/shareCode";
import { showGridBadge } from "@/stores/badge";

type Lists = { visible: ManagedTag[]; filtered: boolean; all: ManagedTag[]; checked: ManagedTag[] };

function exportList(tags: ManagedTag[], categories: Category[], rules: RulesIndex) {
  const { code, aliases, parents } = encodeTags(tags, categories, rules);
  const extra = [aliases && `${formatNumber(aliases)} ${plural(aliases, "synonyme")}`, parents && `${formatNumber(parents)} ${plural(parents, "règle")}`].filter(Boolean);
  const copied = `${formatNumber(tags.length)} ${plural(tags.length, "tag copié", "tags copiés")}${extra.length ? ` (avec ${extra.join(" et ")})` : ""}`;
  void api.writeClipboardText(code).then(() => showGridBadge(copied));
}

export function openExportMenu(e: React.MouseEvent<HTMLButtonElement>, { visible, filtered, all, checked }: Lists, categories: Category[], rules: RulesIndex) {
  const r = e.currentTarget.getBoundingClientRect();
  const run = (tags: ManagedTag[]) => () => exportList(tags, categories, rules);
  openMenuAt(
    r.left,
    r.bottom + 4,
    [
      { label: `Tags affichés (${formatNumber(visible.length)})`, disabled: !filtered, run: run(visible) },
      { label: `Tous les tags (${formatNumber(all.length)})`, run: run(all) },
      ...(checked.length ? [{ label: `Tags cochés (${formatNumber(checked.length)})`, run: run(checked) }] : []),
    ],
    e.detail === 0,
  );
}
