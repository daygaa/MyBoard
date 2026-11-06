// Barre de progression du lecteur vidéo (VIEW-29), temps au survol. Repère mis à jour à chaque image affichée
// pendant la lecture (VIS.4).
// Sauts (VIEW-55, D-054) : un clic saute à l'instant exact. En glissant le curseur, un seul saut à la fois (le
// suivant part quand l'image du précédent est prête : avant, chaque mouvement annulait le saut en cours et la vidéo
// restait figée tout le glissement). Glissement rapide : juste après l'image clé qui précède le curseur (`keyframes`,
// lues par ffprobe : presque rien à décoder, 62 à 65 ms par saut sur une vidéo 4K HEVC), puis l'image exacte quand il
// s'arrête ; glissement lent : l'image exacte ; au relâchement, l'instant exact.

import { useEffect, useRef, useState, type PointerEvent } from "react";

import { formatDuration } from "@/lib/format";

/** Après l'image clé : le moteur peut placer le début de la vidéo quelques centièmes plus tard que ffprobe. */
const AFTER_KEY = 0.1;
/** Au-delà, l'image clé est trop loin du curseur : saut à l'instant exact. */
const MAX_SNAP = 2;
/** Glissement rapide au-delà de 3 s de vidéo par seconde : images clés seulement. */
const FAST = 3;
/** Curseur immobile depuis 150 ms pendant un glissement rapide : image exacte. */
const SETTLE_MS = 150;

/** Temps en secondes → « 1:05 » (0 s compris). */
export function clock(seconds: number): string {
  return Number.isFinite(seconds) && seconds > 0 ? formatDuration(seconds * 1000) : "0:00";
}

/** Temps visé pendant le glissement : juste après l'image clé qui précède `time` (si elle est proche). */
function snap(time: number, keyframes: number[]): number {
  let lo = 0;
  let hi = keyframes.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (keyframes[mid] <= time) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (found < 0 || time - keyframes[found] > MAX_SNAP) return time;
  return Math.min(time, keyframes[found] + AFTER_KEY);
}

export function ProgressBar({ video, keyframes }: { video: HTMLVideoElement; keyframes: number[] }) {
  const [hover, setHover] = useState<{ x: number; time: number } | null>(null);
  /** Temps sous le curseur pendant un glissement (le repère le suit) ; null sinon. */
  const [drag, setDrag] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);
  /** Saut en attente (le prochain à lancer) et s'il termine le glissement ; glissement : image clé visée, vitesse du
   *  curseur (secondes de vidéo par seconde), dernier temps et moment, minuterie de l'arrêt. */
  const seeks = useRef({ pending: null as number | null, final: false, moved: false, key: null as number | null, speed: 0, time: 0, at: 0, settle: 0 });
  const duration = video.duration || 0;
  const played = duration ? ((drag ?? video.currentTime) / duration) * 100 : 0;
  const fillRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const showDrag = (time: number | null) => {
    dragRef.current = time;
    setDrag(time);
  };

  // Pendant la lecture, le repère avance à chaque image affichée (retour VIS.4) ; deux styles écrits, sans
  // redessiner la barre. Pendant un glissement, il suit le curseur.
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const d = video.duration || 0;
      const at = d ? `${((dragRef.current ?? video.currentTime) / d) * 100}%` : "0%";
      if (fillRef.current) fillRef.current.style.width = at;
      if (dotRef.current) dotRef.current.style.left = at;
      if (!video.paused) frame = requestAnimationFrame(tick);
    };
    const start = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(tick);
    };
    video.addEventListener("play", start);
    if (!video.paused) start();
    return () => {
      cancelAnimationFrame(frame);
      video.removeEventListener("play", start);
    };
  }, [video]);

  // Lance le saut en attente quand le précédent est terminé (le dernier demandé seulement).
  const flush = () => {
    const s = seeks.current;
    if (video.seeking || s.pending === null) return;
    const time = s.pending;
    s.pending = null;
    if (s.final) {
      s.final = false;
      showDrag(null);
    }
    if (Math.abs(video.currentTime - time) > 0.001) video.currentTime = time;
  };
  useEffect(() => {
    video.addEventListener("seeked", flush);
    return () => video.removeEventListener("seeked", flush);
  });
  useEffect(() => () => clearTimeout(seeks.current.settle), []);
  const request = (time: number, final = false) => {
    const s = seeks.current;
    s.pending = time;
    s.final = final;
    flush();
  };
  /** Glissement : vite, l'image clé qui précède le curseur quand il en atteint une nouvelle (jamais en arrière), puis
   *  l'image exacte dès qu'il s'arrête ; lentement, l'image exacte sous le curseur (retour du 06/11 : en mêlant les
   *  deux, la vidéo revenait à l'image clé une image sur deux). */
  const dragTo = (time: number) => {
    const s = seeks.current;
    const now = performance.now();
    const dt = (now - s.at) / 1000;
    if (dt > 0) s.speed = 0.6 * s.speed + 0.4 * (Math.abs(time - s.time) / dt);
    const forward = time >= s.time;
    s.time = time;
    s.at = now;
    showDrag(time);
    clearTimeout(s.settle);
    if (s.speed > FAST) {
      const key = snap(time, keyframes);
      // Seulement une image clé devant l'image affichée, dans le sens du mouvement : jamais de retour en arrière.
      const ahead = forward ? key > video.currentTime + 0.001 : key < video.currentTime - 0.001;
      if (key !== s.key && ahead) {
        s.key = key;
        request(key);
      }
      s.settle = window.setTimeout(() => dragRef.current !== null && request(dragRef.current), SETTLE_MS);
    } else {
      s.key = null;
      request(time);
    }
  };

  const buffered = duration && video.buffered.length ? (video.buffered.end(video.buffered.length - 1) / duration) * 100 : 0;
  const timeAt = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    return { x: ratio * rect.width, time: ratio * duration };
  };

  return (
    <div
      data-zone="visionneuse.lecteur.progression"
      className="group relative flex h-8 min-w-0 flex-1 cursor-pointer items-center"
      onPointerDown={(e) => {
        if (!duration) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const s = seeks.current;
        const time = timeAt(e).time;
        Object.assign(s, { moved: false, key: null, speed: 0, time, at: performance.now() });
        // Clic : saut à l'instant exact, tout de suite.
        request(time);
      }}
      onPointerMove={(e) => {
        const at = timeAt(e);
        setHover(at);
        if (!duration || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
        seeks.current.moved = true;
        dragTo(at.time);
      }}
      onPointerUp={(e) => {
        clearTimeout(seeks.current.settle);
        if (!seeks.current.moved || !duration) return;
        // Fin du glissement : l'instant exact sous le curseur ; le repère le suit jusqu'au saut.
        request(timeAt(e).time, true);
      }}
      onLostPointerCapture={() => {
        if (seeks.current.pending === null && dragRef.current !== null) showDrag(null);
      }}
      onPointerLeave={() => setHover(null)}
    >
      <div className="relative h-1 w-full rounded-full bg-white/15 transition-[height] group-hover:h-1.5">
        <div className="absolute inset-y-0 left-0 rounded-full bg-white/25" style={{ width: `${buffered}%` }} />
        <div ref={fillRef} className="absolute inset-y-0 left-0 rounded-full bg-[#d9a94e]" style={{ width: `${played}%` }} />
        <div
          ref={dotRef}
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d9a94e] opacity-0 transition-opacity group-hover:opacity-100"
          style={{ left: `${played}%` }}
        />
      </div>
      {hover && (
        <span
          className="pointer-events-none absolute bottom-full mb-1 -translate-x-1/2 rounded bg-black/85 px-1.5 py-0.5 font-mono text-[11px] text-white"
          style={{ left: hover.x }}
        >
          {clock(hover.time)}
        </span>
      )}
    </div>
  );
}
