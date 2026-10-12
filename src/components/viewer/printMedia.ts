// Impression du média lui-même, jamais de la page de l'application (VIEW-17).
// L'image est posée seule dans un conteneur que la feuille de style d'impression (index.css)
// est la seule à montrer ; elle occupe la page entière, proportions gardées.
// Le conteneur reste en place tant que la visionneuse est ouverte : la fenêtre d'impression
// redessine la page quand on change un réglage (orientation…), l'image doit encore y être.

import { mediaUrl, type MediaItem } from "@/lib/api";

const HOLDER_ID = "impression-media";

export function removePrintHolder() {
  document.getElementById(HOLDER_ID)?.remove();
}

export async function printImage(item: MediaItem): Promise<void> {
  removePrintHolder();
  const holder = document.createElement("div");
  holder.id = HOLDER_ID;
  const img = new Image();
  img.alt = item.fileName;
  img.src = mediaUrl(item);
  holder.append(img);
  document.body.append(holder);
  // L'image doit être décodée avant d'ouvrir la fenêtre d'impression, sinon la page est vide.
  await img.decode().catch(() => undefined);
  window.print();
}
