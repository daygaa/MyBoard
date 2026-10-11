// Mise en forme des nombres, poids et durées (mêmes formats que la v8).

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 o";
  const units = ["o", "Ko", "Mo", "Go", "To"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Compteur court pour l'en-tête : 12 345 → « 12k ». */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

/** Nombre complet avec séparateur de milliers : 12345 → « 12 345 ». */
export function formatNumber(n: number): string {
  return n.toLocaleString("fr-FR");
}

/** Durée vidéo : 75 000 ms → « 1:15 », 3 723 000 ms → « 1:02:03 ». */
export function formatDuration(ms: number | null | undefined): string {
  if (!ms || !Number.isFinite(ms)) return "";
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

/** Accord simple : plural(3, "média") → « médias ». */
export function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return n > 1 ? pluralWord : word;
}
