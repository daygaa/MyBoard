// Vidéo de la visionneuse avec le lecteur personnalisé (VIEW-29) et le même zoom que les
// images (ZOOM-08) : molette ancrée sous le curseur, glisser si zoomé, ×4 maximum.
// - Clic sur la vidéo = lecture / pause ; clic sur le fond = dézoom, puis fermeture.
// - Échap : revient d'abord à la taille d'origine, puis ferme la visionneuse.
// - Espace = lecture / pause ; image par image, vidéo en pause : touche « , ? » = reculer,
//   touche « ; . » = avancer.
// - M = son, < et > = vitesse, L = boucle (VIEW-47), avec un badge bref.
// Lecture automatique, avec le son, en boucle (VIEW-26) ; fichier original lu par morceaux.
// Clic droit sur la vidéo (pas sur le fond) : son menu (CTX-07).

import { useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import { mediaUrl, type MediaItem } from "@/lib/api";
import { openContextMenu } from "@/lib/contextMenu";
import { hasModalLayer, useEscape } from "@/lib/escape";
import { videoActionFor, type VideoAction } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { isSilent, speedLabel, usePlayer } from "@/stores/player";

import { videoMenu } from "./mediaMenus";
import { PlayerBadge, SPEED_BADGE_MS, usePlayerBadge } from "./PlayerBadge";
import { ANIM_MS, useZoom, type Size } from "./useZoom";
import { VideoControls } from "./VideoControls";
import { ViewerChrome } from "./viewerChrome";
import { ZoomBadge } from "./ZoomBadge";

/** Durée d'une image quand la vidéo ne l'a pas encore révélée (30 images par seconde). */
const DEFAULT_FRAME = 1 / 30;
const BACK_KEYS = [",", "?"];
const FORWARD_KEYS = [";", "."];

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);
}

const toggle = (video: HTMLVideoElement | null) => void (video && (video.paused ? video.play() : video.pause()));

/** Raccourci du lecteur (VIEW-47) appliqué ; renvoie le texte de son badge. */
function runVideoShortcut(action: VideoAction): string {
  const player = usePlayer.getState();
  if (action === "mute") player.toggleSound();
  else if (action === "loop") player.setLoop(!player.loop);
  else player.stepSpeed(action === "faster" ? 1 : -1);
  const after = usePlayer.getState();
  if (action === "mute") return isSilent(after) ? "Son coupé" : "Son rétabli";
  if (action === "loop") return after.loop ? "Boucle activée" : "Boucle désactivée";
  return speedLabel(after.speed);
}

/** Mesure la durée réelle d'une image pendant la lecture (pour l'image par image). */
function useFrameDuration(ref: RefObject<HTMLVideoElement | null>) {
  const frame = useRef(DEFAULT_FRAME);
  useEffect(() => {
    const video = ref.current;
    if (!video || !("requestVideoFrameCallback" in video)) return;
    let last = -1;
    let handle = 0;
    const onFrame = (_: number, meta: VideoFrameCallbackMetadata) => {
      const delta = meta.mediaTime - last;
      if (last >= 0 && delta > 0.001 && delta < 0.2) frame.current = Math.min(frame.current, delta);
      last = meta.mediaTime;
      handle = video.requestVideoFrameCallback(onFrame);
    };
    handle = video.requestVideoFrameCallback(onFrame);
    return () => video.cancelVideoFrameCallback(handle);
  }, [ref]);
  return frame;
}

export function VideoStage({ item, onClose, fallback }: { item: MediaItem; onClose: () => void; fallback: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [natural, setNatural] = useState<Size>({ w: item.width ?? 0, h: item.height ?? 0 });
  const [failed, setFailed] = useState(false);
  const { volume, muted, loop, speed } = usePlayer();
  const { idle } = useContext(ViewerChrome);
  const { view, zoomed, animate, handlers, reset, zoomTo, fitIsFullSize } = useZoom(stageRef, natural, onClose, () => toggle(videoRef.current));
  const frame = useFrameDuration(videoRef);
  const badge = usePlayerBadge();
  const showBadge = badge.show;
  useEscape(zoomed, reset);

  // Réglages du lecteur appliqués à la vidéo (volume retenu, vitesse, boucle).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
    video.playbackRate = speed;
    video.loop = loop;
  }, [volume, muted, speed, loop]);

  // Espace, image par image et raccourcis du lecteur (sauf pendant une saisie).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video || isTyping(e.target) || hasModalLayer() || e.ctrlKey || e.altKey) return;
      if (e.code === "Space") toggle(video);
      else if (BACK_KEYS.includes(e.key) || FORWARD_KEYS.includes(e.key)) {
        video.pause();
        const step = BACK_KEYS.includes(e.key) ? -frame.current : frame.current;
        video.currentTime = Math.min(video.duration || 0, Math.max(0, video.currentTime + step));
      } else {
        const action = videoActionFor(e);
        if (!action) return;
        showBadge(runVideoShortcut(action), action === "slower" || action === "faster" ? SPEED_BADGE_MS : undefined);
      }
      e.preventDefault(); // Espace n'active pas en plus le bouton qui a le focus
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [frame, showBadge]);

  if (failed) return <>{fallback}</>;
  return (
    <>
      <div
        ref={stageRef}
        data-zone="visionneuse.video"
        {...handlers}
        // Curseur normal sur le fond ; main ou pointeur seulement sur la vidéo (VIEW-31).
        className="absolute inset-0 touch-none select-none"
      >
        <video
          ref={videoRef}
          src={mediaUrl(item)}
          autoPlay
          playsInline
          onError={() => setFailed(true)}
          onContextMenu={(e) => openContextMenu(e, () => videoMenu(item, e.currentTarget, { zoomTo, fitIsFullSize }))}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            // Piste image illisible (le son seul passerait) : même message que l'échec.
            if (v.videoWidth === 0) setFailed(true);
            else setNatural((n) => (n.w === v.videoWidth && n.h === v.videoHeight ? n : { w: v.videoWidth, h: v.videoHeight }));
          }}
          className={cn(
            "absolute top-1/2 left-1/2 max-w-none",
            idle ? "cursor-none" : zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
          )}
          style={{
            width: natural.w,
            height: natural.h,
            transform: `translate(-50%, -50%) translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
            transition: animate ? `transform ${ANIM_MS}ms ease-out` : undefined,
            willChange: "transform",
          }}
        />
        {zoomed && <ZoomBadge scale={view.scale} />}
        <PlayerBadge text={badge.text} />
      </div>
      <VideoControls videoRef={videoRef} />
    </>
  );
}
