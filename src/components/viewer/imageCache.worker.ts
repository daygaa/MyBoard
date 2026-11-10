// Fil à part de la visionneuse (VIEW-53) : lit le fichier d'une image et en fait une copie décodée à la taille
// de l'écran (ImageBitmap, réduction de qualité « high »), sans jamais bloquer la page : mesuré le 06/11, la
// même copie faite dans la page la figeait 0,26 à 0,39 s pour une image de 40 Mpx. La copie est envoyée à la
// page sans être recopiée (« transfer »). Fichier lu directement sur le disque (`url`, D-053) ; s'il ne peut
// pas l'être, par `media://` (`fallback`).

type Job = { id: string; url: string; fallback: string; w: number; h: number };

async function read(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(String(response.status));
  return response.blob();
}

self.onmessage = async (e: MessageEvent<Job>) => {
  const { id, url, fallback, w, h } = e.data;
  try {
    const blob = await read(url).catch(() => (url === fallback ? Promise.reject(new Error("illisible")) : read(fallback)));
    const bitmap = await createImageBitmap(blob, { resizeWidth: w, resizeHeight: h, resizeQuality: "high" });
    self.postMessage({ id, bitmap }, { transfer: [bitmap] });
  } catch {
    self.postMessage({ id, bitmap: null });
  }
};
