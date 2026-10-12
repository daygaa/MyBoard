// Vidéo de la visionneuse avec le lecteur personnalisé (VIEW-29) et le même zoom que les
// images (ZOOM-08) : molette ancrée sous le curseur, glisser si zoomé, ×4 maximum.
// - Clic sur la vidéo = lecture / pause ; clic sur le fond = dézoom, puis fermeture.
// - Échap : revient d'abord à la taille d'origine, puis ferme la visionneuse.
// - Espace = lecture / pause ; image par image, vidéo en pause : touche « , ? » = reculer,
//   touche « ; . » = avancer.
// Lecture automatique, avec le son, en boucle (VIEW-26) ; fichier original lu par morceaux.

import { useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

import { mediaUrl, type MediaItem } from "@/lib/api";
import { hasModalLayer, useEscape } from "@/lib/escape";
import { cn } from "@/lib/utils";
import { usePlayer } from "@/stores/player";
import { useViewer } from "@/stores/viewer";
import { ControlsSlot } from "./controlsSlot";
import { ANIM_MS, useZoom, type Size } from "./useZoom";
import { VideoControls } from "./VideoControls";
import { ZoomBadge } from "./ZoomBadge";

/** Durée d'une image quand la vidéo ne l'a pas encore révélée (30 images par seconde). */
const DEFAULT_FRAME = 1 / 30;
const BACK_KEYS = [",", "?"];
const FORWARD_KEYS = [";", "."];

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);
}

const toggle = (video: HTMLVideoElement | null) => void (video && (video.paused ? video.play() : video.pause()));

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
  const fullscreen = useViewer((s) => s.fullscreen);
  const slot = useContext(ControlsSlot);
  const { view, zoomed, animate, handlers, reset } = useZoom(stageRef, natural, onClose, () => toggle(videoRef.current));
  const frame = useFrameDuration(videoRef);
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

  // Espace et image par image (sauf pendant une saisie).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video || isTyping(e.target) || hasModalLayer() || e.ctrlKey || e.altKey) return;
      if (e.code === "Space") toggle(video);
      else if (BACK_KEYS.includes(e.key) || FORWARD_KEYS.includes(e.key)) {
        video.pause();
        const step = BACK_KEYS.includes(e.key) ? -frame.current : frame.current;
        video.currentTime = Math.min(video.duration || 0, Math.max(0, video.currentTime + step));
      } else return;
      e.preventDefault(); // Espace n'active pas en plus le bouton qui a le focus
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [frame]);

  if (failed) return <>{fallback}</>;
  return (
    <>
      <div
        ref={stageRef}
        data-zone="visionneuse.video"
        {...handlers}
        className={cn(
          "absolute inset-x-0 top-0 touch-none select-none",
          fullscreen ? "bottom-0" : "bottom-12",
          zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        )}
      >
        <video
          ref={videoRef}
          src={mediaUrl(item)}
          autoPlay
          playsInline
          onError={() => setFailed(true)}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            // Piste image illisible (le son seul passerait) : même message que l'échec.
            if (v.videoWidth === 0) setFailed(true);
            else setNatural((n) => (n.w === v.videoWidth && n.h === v.videoHeight ? n : { w: v.videoWidth, h: v.videoHeight }));
          }}
          className="absolute top-1/2 left-1/2 max-w-none"
          style={{
            width: natural.w,
            height: natural.h,
            transform: `translate(-50%, -50%) translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
            transition: animate ? `transform ${ANIM_MS}ms ease-out` : undefined,
            willChange: "transform",
          }}
        />
        {zoomed && <ZoomBadge scale={view.scale} />}
      </div>
      {/* Plein écran : les commandes rejoignent la barre du bas, qui apparaît au survol. */}
      {fullscreen && slot ? createPortal(<VideoControls videoRef={videoRef} docked />, slot) : <VideoControls videoRef={videoRef} />}
    </>
  );
}
