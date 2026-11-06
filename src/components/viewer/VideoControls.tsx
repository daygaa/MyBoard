// Barre de commandes du lecteur vidéo personnalisé (VIEW-29), aux couleurs de MyBoard, qui
// flotte par-dessus la vidéo : centrée, bords arrondis, à la même hauteur à l'écran en plein
// écran ou non (VIEW-32) ; cachée avec le curseur quand la souris est immobile (VIEW-33) :
// lecture / pause, temps, barre de progression (ProgressBar.tsx), volume + muet
// (curseur continu), vitesse, sous-titres (VIEW-52 ; places échangées, retour VIS.1.3), boucle (VIEW-26), plein écran
// tout à droite (VIEW-18).
// GIF (VIEW-54) : mêmes commandes, son grisé, boucle à part.

import { useContext, useEffect, useReducer, type RefObject } from "react";
import { Captions, Pause, Play, Repeat, Volume1, Volume2, VolumeX } from "lucide-react";

import { VIDEO_SHORTCUTS } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { isSilent, SPEEDS, speedLabel, usePlayer } from "@/stores/player";
import { BarMenu } from "./BarMenu";
import { FullscreenButton } from "./FullscreenButton";
import { clock, ProgressBar } from "./ProgressBar";
import type { Subtitles } from "./Subtitles";
import { idleClass, ViewerChrome } from "./viewerChrome";

const BUTTON = "grid h-8 w-8 shrink-0 place-items-center rounded-md text-zinc-200 transition hover:bg-white/10 hover:text-white";

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

/** Libellé de vitesse le plus long (« 0,75× ») : sa largeur sert pour toutes les vitesses. */
const WIDEST_SPEED = SPEEDS.map(speedLabel).reduce((a, b) => (b.length > a.length ? b : a));

/** Menu des vitesses (VIEW-29, VIEW-49). */
function SpeedMenu() {
  const speed = usePlayer((s) => s.speed);
  const setSpeed = usePlayer((s) => s.setSpeed);
  return (
    <BarMenu
      zone="visionneuse.lecteur.vitesse"
      title={`Vitesse de lecture (${VIDEO_SHORTCUTS.slower.label} / ${VIDEO_SHORTCUTS.faster.label})`}
      buttonClassName="h-8 min-w-12 rounded-md px-2 font-mono text-xs text-zinc-200 transition hover:bg-white/10 hover:text-white"
      itemClassName="text-right font-mono"
      items={[...SPEEDS].reverse().map((s) => ({ key: String(s), label: speedLabel(s), active: s === speed, onSelect: () => setSpeed(s) }))}
    >
      {/* Toujours la largeur du libellé le plus long : le volume et la barre de progression ne
          bougent plus d'une vitesse à l'autre (VIEW-47). */}
      <span className="grid">
        <span aria-hidden className="invisible [grid-area:1/1]">
          {WIDEST_SPEED}
        </span>
        <span className="[grid-area:1/1]">{speedLabel(speed)}</span>
      </span>
    </BarMenu>
  );
}

/** Sous-titres (VIEW-52) : gris sans piste (« Importer un fichier » reste possible), doré quand une piste est
 *  affichée ; grisé pour un GIF. */
function SubtitlesMenu({ subs }: { subs: Subtitles }) {
  const none = subs.tracks.length === 0;
  return (
    <BarMenu
      zone="visionneuse.lecteur.sous-titres"
      title={!subs.enabled ? "Pas de sous-titres pour un GIF" : none ? "Aucun sous-titre trouvé pour cette vidéo (importer un fichier…)" : `Sous-titres (${VIDEO_SHORTCUTS.subtitles.label})`}
      disabled={!subs.enabled}
      buttonClassName={cn(
        BUTTON,
        "disabled:cursor-default disabled:text-zinc-600 disabled:hover:bg-transparent",
        subs.active !== null ? "text-[#d9a94e] hover:text-[#e3b75f]" : none && "text-zinc-500",
      )}
      items={[
        { key: "", label: "Désactivés", active: subs.active === null, onSelect: () => subs.select(null) },
        ...subs.tracks.map((t) => ({ key: t.key, label: t.label, active: subs.active === t.key, onSelect: () => subs.select(t.key) })),
        { key: "importer", label: "Importer un fichier…", active: false, onSelect: subs.importFile, separated: true },
        ...(subs.activeImported ? [{ key: "retirer", label: "Retirer le fichier importé", active: false, onSelect: subs.removeImported }] : []),
      ]}
    >
      <Captions className="h-4 w-4" />
    </BarMenu>
  );
}

/** Lecteur d'un GIF (VIEW-54) : boucle à part (activée à chaque ouverture), pas de son, barre grisée tant que
 *  la vidéo n'a pas pris le relais. */
export type GifControls = { loop: boolean; setLoop: (on: boolean) => void; ready: boolean };

/** Écart entre la barre de lecture et le bas de la scène (ou le haut de la barre du bas) ; hauteur de la barre. */
export const FLOAT_GAP = 24;
export const BAR_HEIGHT = 44;

/** `keyframes` : temps des images clés de la vidéo (glissement du curseur, VIEW-55) ; vide pour un GIF. */
export function VideoControls({ videoRef, subs, gif, keyframes }: { videoRef: RefObject<HTMLVideoElement | null>; subs: Subtitles; gif?: GifControls; keyframes: number[] }) {
  const { bottomInset, idle, lift } = useContext(ViewerChrome);
  useVideoEvents(videoRef);
  const player = usePlayer();
  const { volume, muted, setVolume, toggleSound } = player;
  const loop = gif ? gif.loop : player.loop;
  const setLoop = gif ? gif.setLoop : player.setLoop;
  const video = videoRef.current;
  if (!video) return null;
  // GIF : jamais de son (le format n'en a pas).
  const silent = !!gif || isSilent({ muted, volume });
  const VolumeIcon = silent ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      data-zone="visionneuse.lecteur"
      className={cn(
        "absolute left-1/2 z-20 flex h-11 w-[45%] max-w-[1100px] min-w-[560px] -translate-x-1/2 items-center gap-2 rounded-xl border border-white/10 bg-black/80 px-3 shadow-lg transition-opacity duration-300",
        idleClass(idle),
        // GIF pas encore pris en charge par la vidéo : barre grisée.
        gif && !gif.ready && "pointer-events-none opacity-50",
      )}
      // Glisse avec la barre du bas dépliée (VIEW-39), au même rythme qu'elle.
      style={{ bottom: bottomInset + FLOAT_GAP, transform: `translateY(${-lift}px)`, transition: "opacity 300ms ease, transform 200ms ease-out" }}
      // Boutons : pas de focus au clic de la souris (le clavier y accède toujours), sinon ils
      // gardaient les touches et un contour doré apparaissait après un appui sur F (VIEW-50).
      onMouseDown={(e) => {
        if (e.target instanceof Element && e.target.closest("button")) e.preventDefault();
      }}
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
      <ProgressBar video={video} keyframes={keyframes} />
      <button
        type="button"
        className={cn(BUTTON, "disabled:cursor-default disabled:text-zinc-600 disabled:hover:bg-transparent")}
        onClick={toggleSound}
        disabled={!!gif}
        aria-label={gif ? "Les GIF n'ont pas de son" : `${silent ? "Rétablir le son" : "Couper le son"} (${VIDEO_SHORTCUTS.mute.label})`}
        title={gif ? "Les GIF n'ont pas de son" : `${silent ? "Rétablir le son" : "Couper le son"} (${VIDEO_SHORTCUTS.mute.label})`}
      >
        <VolumeIcon className="h-4 w-4" />
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step="any"
        value={silent ? 0 : volume}
        disabled={!!gif}
        onChange={(e) => setVolume(Number(e.target.value))}
        // Le curseur a besoin du focus pour glisser : il le rend une fois la souris relâchée, pour
        // que F, Espace et les flèches reviennent à la visionneuse (VIEW-50).
        onPointerDown={(e) => {
          const slider = e.currentTarget;
          window.addEventListener("pointerup", () => setTimeout(() => slider.blur()), { once: true });
        }}
        aria-label="Volume"
        className="h-1 w-24 shrink-0 cursor-pointer accent-[#d9a94e] disabled:cursor-default disabled:opacity-40"
      />
      <SpeedMenu />
      <SubtitlesMenu subs={subs} />
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
