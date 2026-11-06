// GIF animé lu par le lecteur vidéo (VIEW-54). Le GIF s'affiche et s'anime tout de suite, comme une image ;
// MyBoard demande sa vidéo (convertie à la 1re ouverture, 0,1 à 1 s : media/gif.rs) ; dès qu'elle est prête,
// elle reprend AU MÊME INSTANT de l'animation (temps écoulé depuis l'affichage du GIF, modulo sa durée), puis
// remplace le GIF une fois sa 1re image affichée : rien ne saute à l'écran. En attendant, la barre de
// lecture est grisée. Boucle propre au GIF, activée à chaque ouverture (indépendante de celle des vidéos).

import { useEffect, useRef, useState } from "react";

import { api, gifVideoUrl } from "@/lib/api";

/** Avance donnée à la vidéo : le temps de se placer et d'afficher son image, pendant lequel le GIF continue
 *  (réglée sur mesure le 06/11 : avec 50 ms, la vidéo reprenait 16 à 44 ms trop loin). */
const LEAD_S = 0.01;

export function useGifVideo(mediaId: number, enabled: boolean) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  /** La vidéo a pris le relais du GIF. */
  const [ready, setReady] = useState(false);
  const [loop, setLoop] = useState(true);
  /** Début de l'animation du GIF affiché (heure de la page). */
  const started = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    api
      .prepareGif(mediaId)
      .then((path) => !cancelled && setSrc(gifVideoUrl(path)))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [enabled, mediaId]);

  /** Infos de la vidéo lues : placée au même instant que le GIF, lancée, puis relais à sa 1re image. */
  const onVideoReady = (video: HTMLVideoElement) => {
    const d = video.duration;
    const elapsed = started.current ? (performance.now() - started.current) / 1000 + LEAD_S : 0;
    video.addEventListener(
      "seeked",
      () => {
        void video.play().catch(() => {});
        video.requestVideoFrameCallback(() => setReady(true));
      },
      { once: true },
    );
    video.currentTime = Number.isFinite(d) && d > 0 ? elapsed % d : 0;
  };

  return {
    src,
    failed,
    ready,
    loop,
    setLoop,
    onGifLoad: () => (started.current = performance.now()),
    onVideoReady,
  };
}
