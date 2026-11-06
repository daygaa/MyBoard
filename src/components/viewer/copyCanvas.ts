// Copie nette affichée par la visionneuse (VIEW-53, imageCache.ts) : UN SEUL canevas pour toutes les images, déplacé
// dans la scène de l'image affichée, et toujours de la même taille (celle de l'écran, la plus grande copie possible).
// Retour AUT.7.4, mesuré le 07/11 (40 copies, canevas posé dans le calque zoomable comme ici) : un canevas neuf par
// image était dessiné par le moteur comme une image et gardé dans son cache (+317 Mo, et +141 Mo dans la carte
// graphique) ; un canevas réutilisé : +16 et +33 Mo ; mais le redimensionner à chaque copie recréait l'image (+218 Mo).
// La copie est donc dessinée dans le coin du canevas, agrandi à l'affichage pour que ce coin couvre exactement
// l'image ; la scène (`host`) masque le reste. Dessiné par le processeur (« willReadFrequently ») : dessinée par la
// carte graphique, chaque copie y restait aussi.

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

/** Canevas assez grand pour une copie de `w` × `h` (à la taille de l'écran, agrandi une fois si besoin). */
function sized(w: number, h: number): CanvasRenderingContext2D | null {
  const dpr = window.devicePixelRatio || 1;
  if (!canvas) {
    canvas = document.createElement("canvas");
    Object.assign(canvas.style, { position: "absolute", left: "0", top: "0", pointerEvents: "none" });
  }
  const needW = Math.max(w, Math.round(window.screen.width * dpr));
  const needH = Math.max(h, Math.round(window.screen.height * dpr));
  if (canvas.width < needW || canvas.height < needH) {
    canvas.width = Math.max(canvas.width, needW);
    canvas.height = Math.max(canvas.height, needH);
  }
  ctx ??= canvas.getContext("2d", { willReadFrequently: true });
  return ctx;
}

/** Pose la copie dans `host`, qui a la taille de l'image (`box`, en pixels CSS avant le zoom) ; false si la copie a
 *  été oubliée entre-temps (l'original prend alors le relais). */
export function showCopy(host: HTMLElement, bitmap: ImageBitmap, box: { w: number; h: number }): boolean {
  const g = sized(bitmap.width, bitmap.height);
  if (!g || !canvas) return false;
  try {
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.drawImage(bitmap, 0, 0);
  } catch {
    hideCopy(host);
    return false;
  }
  canvas.style.width = `${(box.w * canvas.width) / bitmap.width}px`;
  canvas.style.height = `${(box.h * canvas.height) / bitmap.height}px`;
  if (canvas.parentElement !== host) host.appendChild(canvas);
  return true;
}

/** Retire la copie de `host` (si elle y est encore : l'image suivante a pu la prendre). */
export function hideCopy(host: HTMLElement | null) {
  if (canvas && host && canvas.parentElement === host) canvas.remove();
}
