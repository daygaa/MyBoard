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
// Images rangées par leur empreinte (contenu), jamais par le numéro du média : un numéro libéré par une suppression
// est repris par le média importé suivant, qui aurait affiché l'image d'un autre (retour du 10/11). Taille comptée :
// largeur × hauteur × 4 octets. Fichier lu directement sur le disque par la fenêtre (D-053) :
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
const entries = new Map<string, Entry>();
let total = 0;
/** Images à préparer, dans l'ordre de priorité. */
let queue: Job[] = [];
/** Copies en cours dans le fil à part. */
const busy = new Map<string, Job>();
let keep = new Set<string>();
let worker: Worker | null = null;
/** En attente d'une copie (scène affichée sans copie) : prévenues quand elle est prête, ou impossible (null). */
const waiting = new Map<string, Set<(bitmap: ImageBitmap | null) => void>>();

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

/** Image « légère » (VIEW-53, rafale, retour AUT.7.5) : au plus 4K (8,3 Mpx) et 4 Mo, copie prête vite ; les
 *  autres n'ont que leur miniature pendant une rafale (69 % des images de la base d'essai sont légères). */
const LIGHT_PIXELS = 3840 * 2160;
const LIGHT_BYTES = 4 * 1024 * 1024;
export const isLight = (item: MediaItem) => (item.width ?? 0) * (item.height ?? 0) <= LIGHT_PIXELS && item.size <= LIGHT_BYTES;

function notify(id: string, bitmap: ImageBitmap | null) {
  for (const cb of waiting.get(id) ?? []) cb(bitmap);
  waiting.delete(id);
}

function forget(id: string) {
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
    busy.set(job.item.hash, job);
    worker ??= createWorker();
    worker.postMessage({ id: job.item.hash, url: directUrl(job.item), fallback: mediaUrl(job.item), w: job.w, h: job.h });
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
  w.onmessage = (e: MessageEvent<{ id: string; bitmap: ImageBitmap | null }>) => {
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
export const readyBitmap = (id: string): ImageBitmap | null => entries.get(id)?.bitmap ?? null;

/** Prévient quand la copie de cette image est prête (ou impossible : null) ; renvoie de quoi se désabonner. */
export function whenReady(id: string, cb: (bitmap: ImageBitmap | null) => void): () => void {
  const set = waiting.get(id) ?? new Set();
  set.add(cb);
  waiting.set(id, set);
  return () => waiting.get(id)?.delete(cb);
}

/** Prépare ces images, dans cet ordre de priorité, et les marque comme les plus récentes ; elles ne seront
 *  pas oubliées tant qu'elles sont autour du média affiché. GIF animés et autres sortes de médias : ignorés.
 *  `burst` (rafale) : seulement les images légères ; celles déjà dépassées finissent leur copie (vite prête,
 *  gardée) au lieu de relancer le fil à chaque appui. */
export function warm(items: MediaItem[], burst = false) {
  if (burst) items = items.filter(isLight);
  keep = new Set(items.map((i) => i.hash));
  const fresh: Job[] = [];
  for (const item of items) {
    const old = entries.get(item.hash);
    if (old) {
      // Plus récente : remise en fin de liste ; en attente de préparation : reprend sa place dans la file.
      entries.delete(item.hash);
      entries.set(item.hash, old);
      const queued = queue.find((j) => j.item.hash === item.hash);
      if (queued) fresh.push(queued);
      continue;
    }
    const size = copySize(item);
    if (!size) continue;
    entries.set(item.hash, { bitmap: null, bytes: size.w * size.h * 4 });
    total += size.w * size.h * 4;
    fresh.push({ item, ...size });
  }
  // Ce qui n'est plus autour du média affiché attendra : oublié s'il n'était pas encore préparé.
  for (const job of queue) if (!keep.has(job.item.hash)) forget(job.item.hash);
  // Copies en cours d'images dépassées : abandonnées (fil relancé) ; celles encore utiles reprennent en tête.
  // Rafale : les copies d'images légères vont au bout.
  const stale = [...busy.values()].filter((j) => !keep.has(j.item.hash));
  if (stale.length > 0 && (!burst || stale.some((j) => !isLight(j.item)))) {
    worker?.terminate();
    worker = null;
    done = 0;
    for (const j of stale) forget(j.item.hash);
    const still = [...busy.values()].filter((j) => keep.has(j.item.hash));
    busy.clear();
    fresh.unshift(...still.filter((j) => !fresh.includes(j)));
  }
  queue = fresh;
  trim();
  next();
}
