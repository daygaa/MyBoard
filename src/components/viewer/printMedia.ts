// Impression du média lui-même, jamais de la page de l'application (VIEW-17).
// L'image est posée seule dans un conteneur que la feuille de style d'impression (index.css)
// est la seule à montrer ; elle occupe la page entière, proportions gardées.
// Le conteneur reste en place tant que la visionneuse est ouverte : la fenêtre d'impression
// redessine la page quand on change un réglage (orientation…), l'image doit encore y être.
// Rotation d'affichage (VIEW-60) : l'image est imprimée telle qu'affichée, tournée dans un canevas.

import { mediaUrl, turnsOf, type MediaItem } from "@/lib/api";

const HOLDER_ID = "impression-media";
/** Adresse de l'image tournée, libérée avec le conteneur. */
let turnedUrl: string | null = null;

export function removePrintHolder() {
  document.getElementById(HOLDER_ID)?.remove();
  if (turnedUrl) URL.revokeObjectURL(turnedUrl);
  turnedUrl = null;
}

/** L'image décodée, tournée de `turns` quarts de tour (PNG, sans perte). */
async function turned(img: HTMLImageElement, turns: number): Promise<string | null> {
  const [w, h] = [img.naturalWidth, img.naturalHeight];
  const canvas = document.createElement("canvas");
  [canvas.width, canvas.height] = turns % 2 ? [h, w] : [w, h];
  const ctx = canvas.getContext("2d");
  if (!ctx || !w || !h) return null;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((turns * Math.PI) / 2);
  ctx.drawImage(img, -w / 2, -h / 2);
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/png"));
  return blob ? URL.createObjectURL(blob) : null;
}

export async function printImage(item: MediaItem): Promise<void> {
  removePrintHolder();
  const holder = document.createElement("div");
  holder.id = HOLDER_ID;
  const img = new Image();
  img.alt = item.fileName;
  const turns = turnsOf(item);
  // Canevas lisible (`media://` permet toutes les origines) : sinon, rien à en tirer.
  if (turns) img.crossOrigin = "anonymous";
  img.src = mediaUrl(item);
  // L'image doit être décodée avant d'ouvrir la fenêtre d'impression, sinon la page est vide.
  await img.decode().catch(() => undefined);
  if (turns) {
    turnedUrl = await turned(img, turns);
    if (turnedUrl) {
      img.src = turnedUrl;
      await img.decode().catch(() => undefined);
    }
  }
  holder.append(img);
  document.body.append(holder);
  window.print();
}
