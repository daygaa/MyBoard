// Barre de commandes du lecteur vidéo personnalisé (VIEW-29), aux couleurs de MyBoard, qui
// flotte par-dessus la vidéo : centrée, bords arrondis, à la même hauteur à l'écran en plein
// écran ou non (VIEW-32) ; cachée avec le curseur quand la souris est immobile (VIEW-33) :
// lecture / pause, temps, barre de progression cliquable (temps au survol), volume + muet
// (curseur continu), vitesse, boucle (VIEW-26), plein écran tout à droite (VIEW-18).

import { useContext, useEffect, useReducer, useState, type PointerEvent, type RefObject } from "react";
import { Pause, Play, Repeat, Volume1, Volume2, VolumeX } from "lucide-react";

import { useEscape } from "@/lib/escape";
import { formatDuration } from "@/lib/format";
import { VIDEO_SHORTCUTS } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { isSilent, SPEEDS, speedLabel, usePlayer } from "@/stores/player";
import { FullscreenButton } from "./FullscreenButton";
import { idleClass, ViewerChrome } from "./viewerChrome";

const BUTTON = "grid h-8 w-8 shrink-0 place-items-center rounded-md text-zinc-200 transition hover:bg-white/10 hover:text-white";

/** Temps en secondes → « 1:05 » (0 s compris). */
function clock(seconds: number): string {
  return Number.isFinite(seconds) && seconds > 0 ? formatDuration(seconds * 1000) : "0:00";
}

/** Redessine la barre à chaque événement de la vidéo (lecture, temps, volume…). */
function useVideoEvents(ref: RefObject<HTMLVideoElement | null>) {
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const events = ["loadedmetadata", "play", "pause", "timeupdate", "durationchange", "volumechange", "ratechange", "progress", "seeked"];
    for (const name of events) video.addEventListener(name, refresh);
    return () => {
      for (const name of events) video.removeEventListener(name, refresh);
    };
  }, [ref]);
}

function ProgressBar({ video }: { video: HTMLVideoElement }) {
  const [hover, setHover] = useState<{ x: number; time: number } | null>(null);
  const duration = video.duration || 0;
  const played = duration ? (video.currentTime / duration) * 100 : 0;
  const buffered = duration && video.buffered.length ? (video.buffered.end(video.buffered.length - 1) / duration) * 100 : 0;

  const timeAt = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    return { x: ratio * rect.width, time: ratio * duration };
  };
  const seek = (e: PointerEvent<HTMLDivElement>) => {
    if (duration) video.currentTime = timeAt(e).time;
  };

  return (
    <div
      data-zone="visionneuse.lecteur.progression"
      className="group relative flex h-8 min-w-0 flex-1 cursor-pointer items-center"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        seek(e);
      }}
      onPointerMove={(e) => {
        setHover(timeAt(e));
        if (e.currentTarget.hasPointerCapture(e.pointerId)) seek(e);
      }}
      onPointerLeave={() => setHover(null)}
    >
      <div className="relative h-1 w-full rounded-full bg-white/15 transition-[height] group-hover:h-1.5">
        <div className="absolute inset-y-0 left-0 rounded-full bg-white/25" style={{ width: `${buffered}%` }} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-[#d9a94e]" style={{ width: `${played}%` }} />
        <div
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

/** Libellé de vitesse le plus long (« 0,75× ») : sa largeur sert pour toutes les vitesses. */
const WIDEST_SPEED = SPEEDS.map(speedLabel).reduce((a, b) => (b.length > a.length ? b : a));

function SpeedMenu() {
  const speed = usePlayer((s) => s.speed);
  const setSpeed = usePlayer((s) => s.setSpeed);
  const [open, setOpen] = useState(false);
  useEscape(open, () => setOpen(false));
  return (
    <div className="relative">
      <button
        type="button"
        data-zone="visionneuse.lecteur.vitesse"
        onClick={() => setOpen(!open)}
        title={`Vitesse de lecture (${VIDEO_SHORTCUTS.slower.label} / ${VIDEO_SHORTCUTS.faster.label})`}
        className="h-8 min-w-12 rounded-md px-2 font-mono text-xs text-zinc-200 transition hover:bg-white/10 hover:text-white"
      >
        {/* Toujours la largeur du libellé le plus long : le volume et la barre de progression ne
            bougent plus d'une vitesse à l'autre (VIEW-47). */}
        <span className="grid">
          <span aria-hidden className="invisible [grid-area:1/1]">
            {WIDEST_SPEED}
          </span>
          <span className="[grid-area:1/1]">{speedLabel(speed)}</span>
        </span>
      </button>
      {open && (
        <ul className="absolute right-0 bottom-full z-30 mb-1 rounded-md border border-border bg-popover p-1 shadow-lg">
          {[...SPEEDS].reverse().map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => {
                  setSpeed(s);
                  setOpen(false);
                }}
                className={cn(
                  "w-full rounded px-3 py-1 text-right font-mono text-xs hover:bg-secondary",
                  s === speed ? "text-[#d9a94e]" : "text-foreground",
                )}
              >
                {speedLabel(s)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Écart entre la barre de lecture et le bas de la scène (ou le haut de la barre du bas). */
const FLOAT_GAP = 24;

export function VideoControls({ videoRef }: { videoRef: RefObject<HTMLVideoElement | null> }) {
  const { bottomInset, idle, lift } = useContext(ViewerChrome);
  useVideoEvents(videoRef);
  const { volume, muted, loop, setVolume, setLoop, toggleSound } = usePlayer();
  const video = videoRef.current;
  if (!video) return null;
  const silent = isSilent({ muted, volume });
  const VolumeIcon = silent ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      data-zone="visionneuse.lecteur"
      className={cn(
        "absolute left-1/2 z-20 flex h-11 w-[45%] max-w-[1100px] min-w-[560px] -translate-x-1/2 items-center gap-2 rounded-xl border border-white/10 bg-black/80 px-3 shadow-lg transition-opacity duration-300",
        idleClass(idle),
      )}
      // Glisse avec la barre du bas dépliée (VIEW-39), au même rythme qu'elle.
      style={{ bottom: bottomInset + FLOAT_GAP, transform: `translateY(${-lift}px)`, transition: "opacity 300ms ease, transform 200ms ease-out" }}
    >
      <button
        type="button"
        className={BUTTON}
        onClick={() => void (video.paused ? video.play() : video.pause())}
        aria-label={video.paused ? "Lecture (Espace)" : "Pause (Espace)"}
        title={video.paused ? "Lecture (Espace)" : "Pause (Espace)"}
      >
        {video.paused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}
      </button>
      <span className="shrink-0 font-mono text-xs text-zinc-300 tabular-nums">
        {clock(video.currentTime)} / {clock(video.duration)}
      </span>
      <ProgressBar video={video} />
      <button
        type="button"
        className={BUTTON}
        onClick={toggleSound}
        aria-label={`${silent ? "Rétablir le son" : "Couper le son"} (${VIDEO_SHORTCUTS.mute.label})`}
        title={`${silent ? "Rétablir le son" : "Couper le son"} (${VIDEO_SHORTCUTS.mute.label})`}
      >
        <VolumeIcon className="h-4 w-4" />
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step="any"
        value={silent ? 0 : volume}
        onChange={(e) => setVolume(Number(e.target.value))}
        aria-label="Volume"
        className="h-1 w-24 shrink-0 cursor-pointer accent-[#d9a94e]"
      />
      <SpeedMenu />
      <button
        type="button"
        data-zone="visionneuse.boucle"
        aria-pressed={loop}
        onClick={() => setLoop(!loop)}
        title={`${loop ? "Lecture en boucle activée : cliquer pour la désactiver" : "Lecture en boucle désactivée : cliquer pour l'activer"} (${VIDEO_SHORTCUTS.loop.label})`}
        className={cn(BUTTON, loop ? "text-[#d9a94e] hover:text-[#e3b75f]" : "text-zinc-500")}
      >
        <Repeat className="h-4 w-4" />
      </button>
      <FullscreenButton className={BUTTON} />
    </div>
  );
}
