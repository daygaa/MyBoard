// Vidéo de la visionneuse avec le lecteur personnalisé (VIEW-29) et le même zoom que les
// images (ZOOM-08) : molette ancrée sous le curseur, glisser si zoomé, ×4 maximum.
// - Clic sur la vidéo = lecture / pause ; clic sur le fond = dézoom, puis fermeture.
// - Échap : revient d'abord à la taille d'origine, puis ferme la visionneuse.
// - Espace = lecture / pause ; image par image, vidéo en pause : touche « , ? » = reculer,
//   touche « ; . » = avancer.
// - M = son, < et > = vitesse, L = boucle (VIEW-47), avec un badge bref.
// Lecture automatique, avec le son, en boucle (VIEW-26) ; fichier original lu par morceaux, directement sur le disque par
// la fenêtre (VIEW-55, D-054 ; `media://` si ce n'est pas possible). Images clés lues par ffprobe : glissement du curseur
// de la barre de progression fluide (ProgressBar.tsx).
// Clic droit sur la vidéo (pas sur le fond) : son menu (CTX-07).
// Sous-titres (VIEW-52, Subtitles.tsx) : bouton de la barre, sous-menu du clic droit, touche C.
// GIF animé (VIEW-54, useGifVideo.ts) : le GIF s'affiche tout de suite, sa vidéo prend le relais au même instant ;
// pas de son (M sans effet), boucle propre au GIF.
// Défilement rapide (rafale, burst.ts, retour AUT.7.5) : seulement la miniature (ni lecture, ni son, ni ffprobe, ni
// conversion du GIF) ; à l'arrêt, tout démarre et la miniature reste jusqu'à la 1re image (ou au GIF).

import { useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";

import { api, directUrl, mediaUrl, THUMB, type MediaItem } from "@/lib/api";
import { openContextMenu } from "@/lib/contextMenu";
import { hasModalLayer, useEscape } from "@/lib/escape";
import { videoActionFor, type VideoAction } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { isSilent, speedLabel, usePlayer } from "@/stores/player";
import { usePreviewReady } from "@/stores/previews";
import { useViewer } from "@/stores/viewer";

import { useBurstLight } from "./burst";
import { videoMenu } from "./mediaMenus";
import { stageThumb } from "./navigation";
import { PlayerBadge, SPEED_BADGE_MS, usePlayerBadge } from "./PlayerBadge";
import { SubtitleOverlay, subtitleBox, useSubtitles } from "./Subtitles";
import { useGifVideo } from "./useGifVideo";
import { ANIM_MS, useZoom, type Size } from "./useZoom";
import { BAR_HEIGHT, FLOAT_GAP, VideoControls } from "./VideoControls";
import { ViewerChrome } from "./viewerChrome";
import { ZoomBadge } from "./ZoomBadge";

/** Durée d'une image quand la vidéo ne l'a pas encore révélée (30 images par seconde). */
const DEFAULT_FRAME = 1 / 30;
const BACK_KEYS = [",", "?"];
const NO_KEYFRAMES: number[] = [];
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
  /** Lecture directe impossible (D-054) : `media://`. */
  const [viaProtocol, setViaProtocol] = useState(false);
  const isGif = item.ext === "gif";
  // Rafale : rien n'est lu ; arrivé pendant une rafale : miniature jusqu'à la 1re image de la vidéo (ou au GIF).
  const light = useBurstLight();
  const [fromBurst] = useState(light);
  const [painted, setPainted] = useState(false);
  const [gifShown, setGifShown] = useState(false);
  const previewReady = usePreviewReady(item.id, 640);
  const { data: keyframes } = useQuery({
    queryKey: ["keyframes", item.id],
    queryFn: () => api.videoKeyframes(item.id),
    enabled: !isGif && !light,
    staleTime: Infinity,
  });
  const gif = useGifVideo(item.id, isGif && !light);
  const subs = useSubtitles(item.id, videoRef, !isGif && !light);
  const { volume, muted, loop: videoLoop, speed } = usePlayer();
  const loop = isGif ? gif.loop : videoLoop;
  const { idle, restartIdle, bottomInset, lift } = useContext(ViewerChrome);
  // Passage en plein écran ou sortie en cours : la barre de lecture n'est pas encore à sa place (VIS.1.5).
  const switching = useViewer((s) => s.fullscreen !== s.fullscreenShown);
  // GIF pas encore relayé par sa vidéo : un clic n'y fait rien.
  const waiting = isGif && !gif.ready;
  const { view, zoomed, animate, handlers, reset, controls, stage } = useZoom(stageRef, natural, onClose, () => !waiting && toggle(videoRef.current));
  const frame = useFrameDuration(videoRef);
  const badge = usePlayerBadge();
  const showBadge = badge.show;
  useEscape(zoomed, reset);

  // Réglages du lecteur appliqués à la vidéo (volume retenu, vitesse, boucle).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = isGif || muted;
    video.playbackRate = speed;
    video.loop = loop;
  }, [volume, muted, speed, loop, isGif]);

  // État lu par les raccourcis (installés une fois).
  const live = useRef({ subs, gif, isGif, waiting });
  useEffect(() => {
    live.current = { subs, gif, isGif, waiting };
  });

  // Espace, image par image et raccourcis du lecteur (sauf pendant une saisie).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video || isTyping(e.target) || hasModalLayer() || e.ctrlKey || e.altKey) return;
      const { subs: s, gif: g, isGif: gifShown, waiting: notYet } = live.current;
      if (notYet && (e.code === "Space" || BACK_KEYS.includes(e.key) || FORWARD_KEYS.includes(e.key))) return;
      if (e.code === "Space") toggle(video);
      else if (BACK_KEYS.includes(e.key) || FORWARD_KEYS.includes(e.key)) {
        video.pause();
        const step = BACK_KEYS.includes(e.key) ? -frame.current : frame.current;
        video.currentTime = Math.min(video.duration || 0, Math.max(0, video.currentTime + step));
      } else {
        const action = videoActionFor(e);
        if (!action || (gifShown && action === "mute")) return;
        const speed = action === "slower" || action === "faster";
        if (action === "subtitles") showBadge(s.toggle());
        else if (gifShown && action === "loop") {
          g.setLoop(!g.loop);
          showBadge(g.loop ? "Boucle désactivée" : "Boucle activée");
        } else showBadge(runVideoShortcut(action), speed ? SPEED_BADGE_MS : undefined);
        if (speed) restartIdle(); // commandes affichées : encore 3 s (VIEW-47)
      }
      e.preventDefault(); // Espace n'active pas en plus le bouton qui a le focus
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [frame, showBadge, restartIdle]);

  if (failed || gif.failed) return <>{fallback}</>;
  const transform = `translate(-50%, -50%) translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`;
  const transition = animate ? `transform ${ANIM_MS}ms ease-out` : undefined;
  const gifControls = isGif ? { loop: gif.loop, setLoop: gif.setLoop, ready: gif.ready } : undefined;
  // Miniature : carré recadré au centre (D-013), posé sur le carré central du média, comme pour les images.
  const side = Math.min(natural.w, natural.h);
  const thumb = fromBurst && !(isGif ? gifShown || gif.ready : painted) && item.thumbStatus === THUMB.ready && side > 0;
  return (
    <>
      <div
        ref={stageRef}
        data-zone="visionneuse.video"
        {...handlers}
        // Curseur normal sur le fond ; main ou pointeur seulement sur la vidéo (VIEW-31).
        className="absolute inset-0 touch-none select-none"
      >
        {waiting && !light && (
          <img
            src={mediaUrl(item)}
            alt=""
            draggable={false}
            onLoad={() => {
              gif.onGifLoad();
              setGifShown(true);
            }}
            className="pointer-events-none absolute top-1/2 left-1/2 max-w-none"
            style={{ width: natural.w, height: natural.h, transform, transition }}
          />
        )}
        <video
          ref={videoRef}
          src={light ? undefined : isGif ? (gif.src ?? undefined) : viaProtocol ? mediaUrl(item) : directUrl(item)}
          autoPlay={!isGif}
          playsInline
          // 1re image prête : la miniature part à l'image suivante (la vidéo est déjà dessinée dessous).
          onLoadedData={() => fromBurst && requestAnimationFrame(() => setPainted(true))}
          onError={() => {
            if (!isGif && item.fileUrl && !viaProtocol) setViaProtocol(true);
            else setFailed(true);
          }}
          onContextMenu={(e) => openContextMenu(e, () => videoMenu(item, e.currentTarget, controls, subs, gifControls))}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            // GIF : ses dimensions restent celles du GIF (la vidéo a parfois 1 px de plus, non montré).
            if (isGif) return gif.onVideoReady(v);
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
            transform,
            transition,
            willChange: "transform",
            ...(isGif && { objectFit: "none", objectPosition: "0 0", opacity: gif.ready ? 1 : 0 }),
          }}
        />
        {thumb && (
          <img
            src={stageThumb(item, previewReady)}
            alt=""
            draggable={false}
            className="pointer-events-none absolute top-1/2 left-1/2 max-w-none"
            style={{ width: side, height: side, transform, transition }}
          />
        )}
        {subs.cues.length > 0 && (
          <SubtitleOverlay
            cues={subs.cues}
            box={subtitleBox(stage, natural, view, idle ? 0 : bottomInset + FLOAT_GAP + BAR_HEIGHT + lift)}
            hold={switching}
          />
        )}
        {zoomed && <ZoomBadge scale={view.scale} />}
        <PlayerBadge text={badge.text} />
      </div>
      <VideoControls videoRef={videoRef} subs={subs} gif={gifControls} keyframes={keyframes ?? NO_KEYFRAMES} />
    </>
  );
}
