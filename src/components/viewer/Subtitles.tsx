// Sous-titres de la vidéo affichée (VIEW-52) : pistes trouvées par MyBoard (fichiers à côté de la vidéo, pistes
// intégrées : media/subtitles.rs), toujours désactivées à l'ouverture (choix de l'utilisateur : le bouton
// montre seulement qu'il y en a). Bouton de la barre de lecture, sous-menu du clic droit, touche C (la piste
// choisie en dernier, sinon français, anglais, puis la 1re).
// Affichage : répliques de la piste ajoutées à une piste de texte « cachée » de la vidéo (le navigateur dit
// quand chacune commence et finit), dessinées par MyBoard par-dessus la vidéo, hors du zoom (toujours
// lisibles) : texte blanc à contour noir, sans fond, en bas de l'image visible, remonté au-dessus de la barre
// de lecture quand elle est affichée.

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";

import { api, type SubTrack } from "@/lib/api";

export type Subtitles = {
  tracks: SubTrack[];
  /** Piste affichée (`key`), ou null : désactivés. */
  active: string | null;
  select: (key: string | null) => void;
  /** Touche C : affiche ou cache ; renvoie le texte du badge. */
  toggle: () => string;
  /** Répliques en cours (texte mis en forme par le navigateur : italique, gras…). */
  cues: DocumentFragment[];
};

const NONE: SubTrack[] = [];
/** Une piste de texte par élément vidéo (une vidéo ne peut pas en retirer : elle est réutilisée). */
const textTracks = new WeakMap<HTMLVideoElement, TextTrack>();

function textTrackOf(video: HTMLVideoElement): TextTrack {
  let track = textTracks.get(video);
  if (!track) {
    track = video.addTextTrack("subtitles");
    textTracks.set(video, track);
  }
  return track;
}

/** Piste proposée par la touche C : français, anglais, puis la 1re. */
const preferred = (tracks: SubTrack[]) => tracks.find((t) => t.lang === "fr") ?? tracks.find((t) => t.lang === "en") ?? tracks[0];

export function useSubtitles(mediaId: number, videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean): Subtitles {
  const { data } = useQuery({ queryKey: ["subtitles", mediaId], queryFn: () => api.videoSubtitles(mediaId), enabled });
  const tracks = enabled ? (data ?? NONE) : NONE;
  const [active, setActive] = useState<string | null>(null);
  const [cues, setCues] = useState<DocumentFragment[]>([]);
  const last = useRef<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const track = textTrackOf(video);
    if (active === null) {
      track.mode = "disabled";
      setCues([]);
      return;
    }
    let cancelled = false;
    void api
      .subtitleCues(mediaId, active)
      .then((list) => {
        if (cancelled) return;
        track.mode = "hidden"; // les répliques ne sont lisibles qu'ainsi ; MyBoard les dessine lui-même
        while (track.cues && track.cues.length > 0) track.removeCue(track.cues[0]);
        for (const c of list) track.addCue(new VTTCue(c.start, c.end, c.text));
        const show = () => setCues([...(track.activeCues ?? [])].map((c) => (c as VTTCue).getCueAsHTML()));
        track.oncuechange = show;
        show();
      })
      .catch(() => !cancelled && setActive(null));
    return () => {
      cancelled = true;
      track.oncuechange = null;
    };
  }, [active, mediaId, videoRef]);

  const select = (key: string | null) => {
    if (key !== null) last.current = key;
    setActive(key);
  };
  const toggle = () => {
    if (active !== null) {
      select(null);
      return "Sous-titres désactivés";
    }
    const track = tracks.find((t) => t.key === last.current) ?? preferred(tracks);
    if (!track) return "Aucun sous-titre";
    select(track.key);
    return `Sous-titres : ${track.label}`;
  };
  return { tracks, active, select, toggle, cues };
}

/** Contour noir du texte (8 directions), sans fond. */
const OUTLINE = [-1, 0, 1].flatMap((x) => [-1, 0, 1].filter((y) => x || y).map((y) => `${x * 2}px ${y * 2}px 2px #000`)).join(", ");

/** Place des sous-titres dans la scène : centrés sur la partie visible de la vidéo, `bottom` depuis le bas de
 *  la scène, taille du texte selon la hauteur visible de la vidéo. */
export type SubtitleBox = { left: number; width: number; bottom: number; fontSize: number };

/** Partie visible de la vidéo dans la scène (`view` : zoom et décalage du centre) ; `barTop` : haut de la
 *  barre de lecture depuis le bas de la scène, 0 quand elle est cachée. */
export function subtitleBox(stage: { w: number; h: number }, natural: { w: number; h: number }, view: { scale: number; tx: number; ty: number }, barTop: number): SubtitleBox {
  const w = natural.w * view.scale;
  const h = natural.h * view.scale;
  const left = Math.max(0, stage.w / 2 + view.tx - w / 2);
  const right = Math.min(stage.w, stage.w / 2 + view.tx + w / 2);
  const top = Math.max(0, stage.h / 2 + view.ty - h / 2);
  const bottom = Math.min(stage.h, stage.h / 2 + view.ty + h / 2);
  // 4,5 % de la hauteur visible de la vidéo, entre 16 et 48 px.
  const fontSize = Math.min(48, Math.max(16, (bottom - top) * 0.045));
  return { left, width: Math.max(0, right - left), bottom: Math.max(stage.h - bottom, barTop) + fontSize * 0.6, fontSize };
}

export function SubtitleOverlay({ cues, box }: { cues: DocumentFragment[]; box: SubtitleBox }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    ref.current?.replaceChildren(
      ...cues.map((f) => {
        const line = document.createElement("div");
        line.appendChild(f.cloneNode(true));
        return line;
      }),
    );
  }, [cues]);
  return (
    <div
      ref={ref}
      data-zone="visionneuse.sous-titres"
      className="pointer-events-none absolute z-10 px-[4%] text-center leading-tight font-semibold whitespace-pre-line text-white"
      style={{ left: box.left, width: box.width, bottom: box.bottom, fontSize: box.fontSize, textShadow: OUTLINE, transition: "bottom 200ms ease-out" }}
    />
  );
}
