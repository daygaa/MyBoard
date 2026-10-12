// Badge du zoom (ZOOM-07, ZOOM-09) : pourcentage de la taille réelle de l'image ou de la vidéo
// (100 % = un pixel du média pour un pixel de l'écran), affiché seulement quand c'est zoomé.
// Placé juste sous le bouton des notes (VIEW-19).

export function ZoomBadge({ scale }: { scale: number }) {
  return (
    <div
      data-zone="visionneuse.facteur-zoom"
      className="pointer-events-none absolute top-16 left-4 z-20 rounded bg-black/70 px-2 py-1 font-mono text-xs text-white"
    >
      {Math.round(scale * 100)} %
    </div>
  );
}
