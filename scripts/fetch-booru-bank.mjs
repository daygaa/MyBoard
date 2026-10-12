// Banque de test « grandeur nature » (DEV-03) : images, vidéos et GIF tout public de Danbooru,
// chacun avec un JSON qui donne ses tags ET leur catégorie (lu par l'outil DEV-01).
//
// Utilisation (depuis le Workspace) :
//   node scripts/fetch-booru-bank.mjs "<dossier de destination>" [images=3000] [videos=200] [gifs=100]
// Relancer reprend là où on s'était arrêté (les fichiers déjà complets sont gardés).
//
// Uniquement « rating:g » (tout public). Rythme volontairement poli pour le site :
// une requête de liste par seconde, deux téléchargements à la fois.
// Les médias ne vont JAMAIS dans le dépôt Git (dossier hors du Workspace).

import { existsSync, mkdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const [outDir, nImages = "3000", nVideos = "200", nGifs = "100"] = process.argv.slice(2);
if (!outDir) {
  console.error('Usage : node scripts/fetch-booru-bank.mjs "<dossier>" [images] [vidéos] [gif]');
  process.exit(1);
}

const API = "https://danbooru.donmai.us/posts.json";
const UA = "MyBoard-dev/0.1 (outil de test local)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Chaque groupe : recherche Danbooru, extensions gardées, poids maximal d'un fichier.
// « score:>=5 » : des médias bien tagués (les tout derniers envois le sont encore peu).
const GROUPS = [
  { dir: "images", want: +nImages, tags: "rating:g -animated score:>=5", exts: ["jpg", "png", "webp", "avif"], maxBytes: 30e6 },
  { dir: "videos", want: +nVideos, tags: "rating:g video", exts: ["mp4", "webm"], maxBytes: 60e6 },
  { dir: "gifs", want: +nGifs, tags: "rating:g animated_gif", exts: ["gif"], maxBytes: 20e6 },
];

async function getJson(url, attempt = 1) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (r.status === 429 || r.status >= 500) {
    if (attempt > 5) throw new Error(`HTTP ${r.status} : ${url}`);
    await sleep(5000 * attempt);
    return getJson(url, attempt + 1);
  }
  if (!r.ok) throw new Error(`HTTP ${r.status} : ${url}`);
  return r.json();
}

/** Téléchargement dans un fichier temporaire, renommé seulement une fois complet. */
async function download(url, dest, expected) {
  if (existsSync(dest) && statSync(dest).size === expected) return false;
  const tmp = `${dest}.part`;
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (expected && buf.length !== expected) throw new Error(`taille ${buf.length} au lieu de ${expected}`);
      writeFileSync(tmp, buf);
      renameSync(tmp, dest);
      return true;
    } catch (e) {
      rmSync(tmp, { force: true });
      if (attempt >= 4) throw e;
      await sleep(3000 * attempt);
    }
  }
}

const words = (s) => (s ? s.split(" ").filter(Boolean) : []);

/** JSON au format Safebooru (champ `tags`) + tags rangés par catégorie. */
function sidecar(post) {
  return {
    id: post.id,
    site: "danbooru",
    url: `https://danbooru.donmai.us/posts/${post.id}`,
    tags: post.tag_string,
    tags_by_category: {
      artist: words(post.tag_string_artist),
      copyright: words(post.tag_string_copyright),
      character: words(post.tag_string_character),
      general: words(post.tag_string_general),
      meta: words(post.tag_string_meta),
    },
    width: post.image_width,
    height: post.image_height,
    duration: post.media_asset?.duration ?? null,
    rating: post.rating,
    source: post.source,
    md5: post.md5,
    file_ext: post.file_ext,
    file_size: post.file_size,
  };
}

async function fetchGroup(group) {
  const dir = path.join(outDir, group.dir);
  mkdirSync(dir, { recursive: true });
  let kept = 0;
  let downloaded = 0;
  let bytes = 0;
  let before = ""; // pagination par curseur : « page=b<id> » = plus anciens que cet id
  const queue = [];

  while (kept < group.want) {
    const url = `${API}?limit=200&tags=${encodeURIComponent(group.tags)}${before ? `&page=b${before}` : ""}`;
    const posts = await getJson(url);
    await sleep(1000);
    if (posts.length === 0) break;
    before = String(posts[posts.length - 1].id);
    for (const post of posts) {
      if (kept >= group.want) break;
      if (!post.file_url || !group.exts.includes(post.file_ext) || post.file_size > group.maxBytes) continue;
      kept++;
      queue.push(post);
    }
    // Deux téléchargements à la fois.
    while (queue.length > 0) {
      const batch = queue.splice(0, 2);
      await Promise.all(
        batch.map(async (post) => {
          const base = path.join(dir, String(post.id));
          writeFileSync(`${base}.json`, JSON.stringify(sidecar(post), null, 2));
          if (await download(post.file_url, `${base}.${post.file_ext}`, post.file_size)) {
            downloaded++;
            bytes += post.file_size;
          }
        }),
      );
    }
    console.log(`[${group.dir}] ${kept}/${group.want} — ${downloaded} téléchargés, ${(bytes / 1e9).toFixed(2)} Go`);
  }
  return { kept, downloaded, bytes };
}

const start = Date.now();
let total = 0;
for (const group of GROUPS) {
  const r = await fetchGroup(group);
  total += r.bytes;
}
console.log(`Terminé en ${Math.round((Date.now() - start) / 60000)} min, ${(total / 1e9).toFixed(2)} Go téléchargés → ${outDir}`);
