// Accord des textes selon les médias concernés (IMP-60) : « image(s) », « vidéo(s) », « document(s) », « fichier(s)
// audio », ou « média(s) » quand les types sont mélangés ; genre et nombre des mots qui s'y rapportent.

/** Nombre de médias par type. */
export type KindCounts = { images: number; videos: number; audio: number; documents: number };

type Noun = { one: string; many: string; feminine: boolean };

const NOUNS: Record<keyof KindCounts, Noun> = {
  images: { one: "image", many: "images", feminine: true },
  videos: { one: "vidéo", many: "vidéos", feminine: true },
  audio: { one: "fichier audio", many: "fichiers audio", feminine: false },
  documents: { one: "document", many: "documents", feminine: false },
};
const MIXED: Noun = { one: "média", many: "médias", feminine: false };

export type MediaWords = {
  total: number;
  plural: boolean;
  feminine: boolean;
  /** « image », « images », « fichiers audio », « médias »… */
  noun: string;
  /** Article défini devant le nom : « l'image », « la vidéo », « le document », « les médias ». */
  the: string;
  /** Pronom complément : « la », « le », « les ». */
  it: string;
  /** Pronom sujet : « elle », « il », « elles », « ils ». */
  they: string;
  /** Accord d'un participe ou d'un adjectif : agree("compressé") → « compressées »… */
  agree: (word: string) => string;
  /** Choix singulier / pluriel. */
  pick: <T>(one: T, many: T) => T;
};

export function mediaWords(counts: KindCounts): MediaWords {
  const kinds = (Object.keys(NOUNS) as (keyof KindCounts)[]).filter((k) => counts[k] > 0);
  const total = kinds.reduce((sum, k) => sum + counts[k], 0);
  const n = kinds.length === 1 ? NOUNS[kinds[0]] : MIXED;
  const plural = total > 1;
  const feminine = n.feminine;
  const noun = plural ? n.many : n.one;
  const vowel = /^[aeiouyéèêh]/i.test(noun);
  return {
    total,
    plural,
    feminine,
    noun,
    the: plural ? "les " : vowel ? "l'" : feminine ? "la " : "le ",
    it: plural ? "les" : feminine ? "la" : "le",
    they: (feminine ? "elle" : "il") + (plural ? "s" : ""),
    agree: (word) => word + (feminine ? "e" : "") + (plural ? "s" : ""),
    pick: (one, many) => (plural ? many : one),
  };
}
