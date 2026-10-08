// MyBoard — fetch de ~300 images depuis l'API publique de Safebooru.
//
// Safebooru expose une API JSON (page=dapi) qui renvoie les posts avec leurs
// tags complets (format booru standard). On récupère les "sample_url" (versions
// compressées, ~850px de large) plutôt que les "file_url" (originaux parfois
// énormes), c'est largement suffisant pour des tests d'UI.
//
// Output :
//   demo_assets/safebooru/<id>.json    → metadata (tags, width, height, source)
//   demo_assets/safebooru/<id>.jpg     → l'image
//
// Usage : `bun run scripts/fetch-safebooru.ts` (depuis la racine du projet)

import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.resolve(process.cwd(), "demo_assets/safebooru");
const TARGET = 300;
const PAGE_SIZE = 100; // safebooru max par page

type SBPost = {
  id: number;
  file_url: string;
  sample_url: string;
  preview_url: string;
  width: number;
  height: number;
  tags: string;
  rating: string;
  source: string;
  directory: number;
  image: string;
};

async function fetchPage(page: number, attempt = 1): Promise<SBPost[]> {
  const url = `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&limit=${PAGE_SIZE}&pid=${page}`;
  const r = await fetch(url, {
    headers: { "User-Agent": "MyBoard/0.1 (local media tagger; contact: local)" },
  });
  if (r.status === 429) {
    // Too Many Requests — backoff exponentiel : 5s, 15s, 30s
    const wait = Math.min(30000, 5000 * attempt * attempt);
    console.error(`  429 (rate limited) à page ${page}, attente ${wait / 1000}s...`);
    await new Promise((res) => setTimeout(res, wait));
    return fetchPage(page, attempt + 1);
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as SBPost[];
}

async function download(url: string, dest: string): Promise<number> {
  const r = await fetch(url, {
    headers: { "User-Agent": "MyBoard/0.1" },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return buf.length;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let collected = 0;
  let page = 0;
  let consecutiveEmpty = 0;

  // Évite les IDs déjà téléchargés (reprise possible).
  const existing = new Set(
    fs
      .readdirSync(OUT_DIR)
      .filter((f) => f.endsWith(".jpg"))
      .map((f) => f.replace(".jpg", ""))
  );
  console.log(`→ ${existing.size} images déjà présentes (reprise)`);

  while (collected < TARGET && consecutiveEmpty < 3) {
    console.log(`→ page ${page} (collectés ${collected + existing.size}/${TARGET})`);
    let posts: SBPost[];
    try {
      posts = await fetchPage(page);
    } catch (e) {
      console.error(`  échec fetch page ${page}: ${(e as Error).message}, retry...`);
      await new Promise((r) => setTimeout(r, 2000));
      try {
        posts = await fetchPage(page);
      } catch {
        console.error(`  retry échoué, on skip la page`);
        consecutiveEmpty++;
        page++;
        continue;
      }
    }
    if (!posts.length) {
      consecutiveEmpty++;
      page++;
      continue;
    }
    consecutiveEmpty = 0;

    for (const p of posts) {
      if (collected >= TARGET) break;
      const idStr = String(p.id);
      if (existing.has(idStr)) {
        continue;
      }
      // Sauter les posts sans sample_url (rares, parfois des vidéos webm)
      if (!p.sample_url && !p.file_url) continue;
      const url = p.sample_url || p.file_url;
      if (!url || !/\.(jpg|jpeg|png|gif|webp)$/i.test(url)) continue;

      const imgPath = path.join(OUT_DIR, `${idStr}.jpg`);
      const metaPath = path.join(OUT_DIR, `${idStr}.json`);

      try {
        await download(url, imgPath);
        // Sauve la metadata (tags surtout).
        fs.writeFileSync(
          metaPath,
          JSON.stringify(
            {
              id: p.id,
              tags: p.tags,
              width: p.width,
              height: p.height,
              source: p.source,
              rating: p.rating,
              safebooru_url: `https://safebooru.org/index.php?page=post&s=view&id=${p.id}`,
            },
            null,
            2
          )
        );
        collected++;
        existing.add(idStr);
        if (collected % 25 === 0) {
          console.log(`  ✓ ${collected} nouvelles images`);
        }
      } catch (e) {
        console.error(`  échec DL id=${p.id}: ${(e as Error).message}`);
      }

      // Petit délai pour être poli avec le serveur (250ms pour éviter le 429).
      await new Promise((r) => setTimeout(r, 250));
    }
    page++;
    // Petite pause entre les pages aussi
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(
    `\n✓ Terminé : ${collected} nouvelles images (${existing.size} au total) dans ${OUT_DIR}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
