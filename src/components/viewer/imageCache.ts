// Images de la visionneuse gardées en mémoire (VIEW-53) : celles déjà vues et les voisines préparées
// (2 après, 1 avant), dans la limite de 150 Mo (choix de l'utilisateur, 07/11, retour AUT.7.4 : 1 Go puis 300 Mo,
// c'était trop de mémoire vive ; 20 à 45 images lourdes gardées), les plus anciennes oubliées au-delà. Gardées en mémoire vive tant que MyBoard est ouvert, même visionneuse fermée ; rien sur le disque.
//
// Chaque image est gardée DÉCODÉE, à la taille de l'écran (au plus 1920 × 1080 sur l'écran de
// l'utilisateur, soit 8 Mo ; une petite image à sa taille réelle) : la visionneuse l'affiche aussitôt, nette
// (ImageStage). Mesuré le 06/11 : le moteur de WebView2 ne garde pas décodées les très grandes images (160 à
// 240 Mo chacune) ; une copie à la taille de l'écran, elle, reste. Copies faites dans un fil à part
// (imageCache.worker.ts), la page n'est jamais bloquée, 3 à la fois (retour AUT.7.1 : une à une, elles ne
// suivaient pas une navigation rapide sur des fichiers de 25 Mo, 0,5 s de décodage chacun), l'image affichée
// d'abord ; en passant à une autre image, les copies en cours d'images déjà dépassées sont abandonnées (le fil
// est relancé) : l'image où l'on s'arrête n'attend pas qu'elles finissent (mesuré : 1,5 s au lieu de 0,6 s).
// Taille comptée : largeur × hauteur × 4 octets. Fichier lu directement sur le disque par la fenêtre (D-053) :
// 43 ms pour 28 Mo au lieu de 0,4 s par `media://`, qui bloquait aussi miniatures, tags et touches.

import { directUrl, mediaUrl, type MediaItem } from "@/lib/api";

/** Mémoire réservée aux images gardées (choix de l'utilisateur). */
const BUDGET = 150 * 1024 * 1024;
/** Copies préparées en même temps (processeur à 8 cœurs de l'utilisateur). */
const PARALLEL = 3;
/** Le fil à part est arrêté après 1 s sans copie à faire, ou après 4 copies dès qu'il n'en a plus en cours (puis
 *  relancé au besoin) : le moteur garde en mémoire chaque fichier qu'il a lu (20 à 28 Mo) tant que le fil vit
 *  (mesuré : jusqu'à 600 Mo, retour AUT.7.4). */
const IDLE_MS = 1000;
const RECYCLE = 4;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
/** Copies terminées par le fil actuel. */
let done = 0;

type Entry = { bitmap: ImageBitmap | null; bytes: number };
type Job = { item: MediaItem; w: number; h: number };

/** Ordre d'utilisation : la plus ancienne en premier (Map garde l'ordre d'ajout). */
const entries = new Map<number, Entry>();
let total = 0;
/** Images à préparer, dans l'ordre de priorité. */
let queue: Job[] = [];
/** Copies en cours dans le fil à part. */
const busy = new Map<number, Job>();
let keep = new Set<number>();
let worker: Worker | null = null;
/** En attente d'une copie (scène affichée sans copie) : prévenues quand elle est prête, ou impossible (null). */
const waiting = new Map<number, Set<(bitmap: ImageBitmap | null) => void>>();

/** Taille de la copie : l'image entière dans l'écran (en pixels réels), jamais agrandie. */
function copySize(item: MediaItem): { w: number; h: number } | null {
  const w = item.width ?? 0;
  const h = item.height ?? 0;
  if (!w || !h || item.kind !== "image" || item.ext === "gif") return null;
  const dpr = window.devicePixelRatio || 1;
  const k = Math.min(1, (window.screen.width * dpr) / w, (window.screen.height * dpr) / h);
  const size = { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
  return size.w * size.h * 4 <= BUDGET ? size : null;
}

/** Une copie peut-elle être faite pour cette image ? (GIF animés, dimensions inconnues : non.) */
export const canCopy = (item: MediaItem) => copySize(item) !== null;

function notify(id: number, bitmap: ImageBitmap | null) {
  for (const cb of waiting.get(id) ?? []) cb(bitmap);
  waiting.delete(id);
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

/** Copies en attente : l'original de l'image ouverte depuis la grille se décode seul (ImageStage). */
let paused = false;

/** Met en attente (ou relance) les copies : à l'ouverture, elles ralentissaient le décodage de l'image ouverte
 *  (mesuré : 0,45 s au lieu de 0,35 s). */
export function pauseCopies(on: boolean) {
  paused = on;
  if (!on) next();
}

function next() {
  while (!paused && busy.size < PARALLEL && queue.length > 0) {
    const job = queue.shift()!;
    busy.set(job.item.id, job);
    worker ??= createWorker();
    worker.postMessage({ id: job.item.id, url: directUrl(job.item), fallback: mediaUrl(job.item), w: job.w, h: job.h });
  }
  clearTimeout(idleTimer);
  if (busy.size === 0 && queue.length === 0) idleTimer = setTimeout(stopWorker, IDLE_MS);
}

function stopWorker() {
  if (busy.size > 0) return;
  worker?.terminate();
  worker = null;
  done = 0;
}

function createWorker(): Worker {
  const w = new Worker(new URL("./imageCache.worker.ts", import.meta.url), { type: "module" });
  w.onmessage = (e: MessageEvent<{ id: number; bitmap: ImageBitmap | null }>) => {
    const { id, bitmap } = e.data;
    busy.delete(id);
    if (++done >= RECYCLE) stopWorker();
    const entry = entries.get(id);
    if (!entry || !bitmap) {
      bitmap?.close();
      if (entry && !bitmap) forget(id);
      notify(id, null);
    } else {
      entry.bitmap = bitmap;
      trim();
      notify(id, bitmap);
    }
    next();
  };
  return w;
}

/** Copie décodée prête d'une image (à la taille de l'écran), ou null. */
export const readyBitmap = (id: number): ImageBitmap | null => entries.get(id)?.bitmap ?? null;

/** Prévient quand la copie de cette image est prête (ou impossible : null) ; renvoie de quoi se désabonner. */
export function whenReady(id: number, cb: (bitmap: ImageBitmap | null) => void): () => void {
  const set = waiting.get(id) ?? new Set();
  set.add(cb);
  waiting.set(id, set);
  return () => waiting.get(id)?.delete(cb);
}

/** Prépare ces images, dans cet ordre de priorité, et les marque comme les plus récentes ; elles ne seront
 *  pas oubliées tant qu'elles sont autour du média affiché. GIF animés et autres sortes de médias : ignorés. */
export function warm(items: MediaItem[]) {
  keep = new Set(items.map((i) => i.id));
  const fresh: Job[] = [];
  for (const item of items) {
    const old = entries.get(item.id);
    if (old) {
      // Plus récente : remise en fin de liste ; en attente de préparation : reprend sa place dans la file.
      entries.delete(item.id);
      entries.set(item.id, old);
      const queued = queue.find((j) => j.item.id === item.id);
      if (queued) fresh.push(queued);
      continue;
    }
    const size = copySize(item);
    if (!size) continue;
    entries.set(item.id, { bitmap: null, bytes: size.w * size.h * 4 });
    total += size.w * size.h * 4;
    fresh.push({ item, ...size });
  }
  // Ce qui n'est plus autour du média affiché attendra : oublié s'il n'était pas encore préparé.
  for (const job of queue) if (!keep.has(job.item.id)) forget(job.item.id);
  // Copies en cours d'images dépassées : abandonnées (fil relancé) ; celles encore utiles reprennent en tête.
  const stale = [...busy.keys()].filter((id) => !keep.has(id));
  if (stale.length > 0) {
    worker?.terminate();
    worker = null;
    done = 0;
    for (const id of stale) forget(id);
    const still = [...busy.values()].filter((j) => keep.has(j.item.id));
    busy.clear();
    fresh.unshift(...still.filter((j) => !fresh.includes(j)));
  }
  queue = fresh;
  trim();
  next();
}
