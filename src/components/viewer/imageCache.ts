// Images de la visionneuse gardées en mémoire (VIEW-53) : celles déjà vues et les voisines préparées
// (2 après, 1 avant), dans la limite de 1 Go (choix de l'utilisateur, 06/11), les plus anciennes oubliées
// au-delà. Gardées tant que MyBoard est ouvert, même visionneuse fermée.
//
// Chaque image est gardée DÉCODÉE, à la taille de l'écran (au plus 1920 × 1080 sur l'écran de
// l'utilisateur, soit 8 Mo ; une petite image à sa taille réelle) : la visionneuse l'affiche aussitôt, nette,
// puis l'original prend le relais une fois décodé, sans que rien ne change à l'écran (ImageStage). Mesuré
// le 06/11 : le moteur de WebView2 ne garde pas décodées les très grandes images (160 à 240 Mo chacune) ; une
// copie à la taille de l'écran, elle, reste. Copies faites une à une dans un fil à part
// (imageCache.worker.ts) : la page n'est jamais bloquée. Taille comptée : largeur × hauteur × 4 octets.

import { mediaUrl, type MediaItem } from "@/lib/api";

/** Mémoire réservée aux images gardées (choix de l'utilisateur). */
const BUDGET = 1024 * 1024 * 1024;

type Entry = { bitmap: ImageBitmap | null; bytes: number };

/** Ordre d'utilisation : la plus ancienne en premier (Map garde l'ordre d'ajout). */
const entries = new Map<number, Entry>();
let total = 0;
/** Images à préparer, dans l'ordre ; une seule à la fois dans le fil à part. */
let queue: { item: MediaItem; w: number; h: number }[] = [];
let busy: number | null = null;
let keep = new Set<number>();
let worker: Worker | null = null;

/** Taille de la copie : l'image entière dans l'écran (en pixels réels), jamais agrandie. */
function copySize(item: MediaItem): { w: number; h: number } | null {
  const w = item.width ?? 0;
  const h = item.height ?? 0;
  if (!w || !h) return null;
  const dpr = window.devicePixelRatio || 1;
  const k = Math.min(1, (window.screen.width * dpr) / w, (window.screen.height * dpr) / h);
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

function forget(id: number) {
  const e = entries.get(id);
  if (!e) return;
  entries.delete(id);
  total -= e.bytes;
  e.bitmap?.close();
}

/** Oublie les plus anciennes au-delà de la limite, sauf le média affiché et ses voisins. */
function trim() {
  for (const id of [...entries.keys()]) {
    if (total <= BUDGET) return;
    if (!keep.has(id)) forget(id);
  }
}

function next() {
  if (busy !== null) return;
  const job = queue.shift();
  if (!job) return;
  busy = job.item.id;
  worker ??= createWorker();
  worker.postMessage({ id: job.item.id, url: mediaUrl(job.item), w: job.w, h: job.h });
}

function createWorker(): Worker {
  const w = new Worker(new URL("./imageCache.worker.ts", import.meta.url), { type: "module" });
  w.onmessage = (e: MessageEvent<{ id: number; bitmap: ImageBitmap | null }>) => {
    const { id, bitmap } = e.data;
    busy = null;
    const entry = entries.get(id);
    if (!entry || !bitmap) {
      bitmap?.close();
      if (entry && !bitmap) forget(id);
    } else {
      entry.bitmap = bitmap;
      trim();
    }
    next();
  };
  return w;
}

/** Copie décodée prête d'une image (à la taille de l'écran), ou null. */
export const readyBitmap = (id: number): ImageBitmap | null => entries.get(id)?.bitmap ?? null;

/** Prépare ces images, dans cet ordre (les premières d'abord), et les marque comme les plus récentes ;
 *  elles ne seront pas oubliées tant qu'elles sont autour du média affiché. GIF animés et autres
 *  sortes de médias : ignorés. */
export function warm(items: MediaItem[]) {
  keep = new Set(items.map((i) => i.id));
  // Ce qui n'est plus autour du média affiché attendra : la file ne garde que les nouveaux voisins.
  queue = queue.filter((j) => keep.has(j.item.id));
  for (const item of items) {
    if (item.kind !== "image" || item.ext === "gif") continue;
    const old = entries.get(item.id);
    if (old) {
      // Plus récente : remise en fin de liste.
      entries.delete(item.id);
      entries.set(item.id, old);
      continue;
    }
    const size = copySize(item);
    if (!size) continue;
    const bytes = size.w * size.h * 4;
    entries.set(item.id, { bitmap: null, bytes });
    total += bytes;
    queue.push({ item, ...size });
  }
  // Retirées de la file sans avoir été préparées : oubliées (elles reviendront si on y retourne).
  for (const [id, e] of [...entries]) if (!e.bitmap && busy !== id && !queue.some((j) => j.item.id === id)) forget(id);
  trim();
  next();
}
