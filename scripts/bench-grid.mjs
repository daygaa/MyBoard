// Mesure chiffrée de la fluidité de la grille (D-008, DEV-02).
//
// Lance MyBoard (version compilée) sur une bibliothèque de test, puis pilote la fenêtre
// par le protocole DevTools de WebView2 avec de vrais événements clavier / molette :
//   - changement de page (Ctrl + →) et page lointaine (champ « aller à »),
//   - changement de densité (Ctrl + molette),
//   - défilement de la page entière, en mesurant chaque image affichée.
//
// Utilisation (depuis le Workspace, après `npm run tauri build -- --no-bundle`) :
//   node scripts/bench-grid.mjs "C:\...\MyBoard-test\100k" [chemin\vers\myboard.exe]
//     → mode d'origine : fenêtre sur l'écran que Windows choisit, fluidité en images/s.
//   node scripts/bench-grid.mjs "C:\...\MyBoard-test\100k" --ecran 1920x1080
//     → fenêtre forcée sur cet écran (variable MYBOARD_MONITOR, DEV-05). Sur un écran à 60 Hz,
//       les images/s plafonnent à 60 : on compte en plus les « images ratées » (affichées
//       avec au moins une demi-image de retard sur le rythme de l'écran).
// Aucune dépendance : Node 24 fournit fetch et WebSocket.

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const screenIndex = args.indexOf("--ecran");
const screen = screenIndex >= 0 ? args.splice(screenIndex, 2)[1] : null;
const dataDir = args[0];
const exe = args[1] ?? path.join("src-tauri", "target", "release", "myboard.exe");
if (!dataDir || (screenIndex >= 0 && !screen)) {
  console.error('Usage : node scripts/bench-grid.mjs "<dossier de la bibliothèque de test>" [myboard.exe] [--ecran 1920x1080]');
  process.exit(1);
}
const PORT = 9444;
const DENSITIES = [4, 7, 14, 20, 30];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Lancement de l'application avec un profil WebView2 vierge ------------------------
const webviewDir = mkdtempSync(path.join(tmpdir(), "myboard-bench-"));
const app = spawn(exe, [], {
  env: {
    ...process.env,
    MYBOARD_DATA_DIR: dataDir,
    WEBVIEW2_USER_DATA_FOLDER: webviewDir,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}`,
    ...(screen ? { MYBOARD_MONITOR: screen } : {}),
  },
  stdio: "ignore",
});

async function connect() {
  for (let i = 0; i < 100; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = targets.find((t) => t.type === "page");
      if (page) {
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
        return ws;
      }
    } catch {
      /* fenêtre pas encore prête */
    }
    await sleep(200);
  }
  throw new Error("la fenêtre de MyBoard ne répond pas");
}

const ws = await connect();
let nextId = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  const p = pending.get(msg.id);
  if (!p) return;
  pending.delete(msg.id);
  msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
async function js(expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "erreur JS");
  return r.result.value;
}
const key = async (k, code, ctrl = true) => {
  for (const type of ["rawKeyDown", "keyUp"])
    await send("Input.dispatchKeyEvent", { type, key: k, code: k, windowsVirtualKeyCode: code, modifiers: ctrl ? 2 : 0 });
};
const wheel = (x, y, deltaY, ctrl = false) =>
  send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY, modifiers: ctrl ? 2 : 0 });

// --- Outils installés dans la page ----------------------------------------------------
const HELPERS = `
window.__bench = {
  frames: [], recording: false,
  tiles() { return document.querySelectorAll('[data-zone="grille.vignette"]'); },
  firstTitle() { return this.tiles()[0]?.title ?? null; },
  visibleImages() {
    const h = innerHeight;
    return [...document.querySelectorAll('[data-zone="grille.vignettes"] img')].filter((img) => {
      const r = img.getBoundingClientRect();
      return r.bottom > 0 && r.top < h;
    });
  },
  // Attend que la grille ait changé puis que toutes les miniatures visibles soient affichées.
  async settled(previousTitle, timeout = 20000) {
    const t0 = this.t0;
    while (performance.now() - t0 < timeout) {
      const changed = previousTitle === undefined || this.firstTitle() !== previousTitle;
      const imgs = this.visibleImages();
      if (changed && imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0)) {
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return Math.round(performance.now() - t0);
      }
      await new Promise((r) => requestAnimationFrame(r));
    }
    return -1;
  },
  start() { this.t0 = performance.now(); },
  // Temps jusqu'à ce que la grille affiche le nombre de colonnes demandé.
  async columns(target, timeout = 5000) {
    const t0 = this.t0;
    while (performance.now() - t0 < timeout) {
      const row = document.querySelector('[data-zone="grille.vignettes"] > div');
      if (row && getComputedStyle(row).gridTemplateColumns.split(" ").length === target) {
        await new Promise((r) => requestAnimationFrame(r));
        return Math.round(performance.now() - t0);
      }
      await new Promise((r) => requestAnimationFrame(r));
    }
    return -1;
  },
};
(function loop(t) { if (window.__bench.recording) window.__bench.frames.push(t); requestAnimationFrame(loop); })(0);
true`;

const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

async function waitForGrid() {
  for (let i = 0; i < 150; i++) {
    if (await js(`!!document.querySelector('[data-zone="grille.vignette"]')`)) return;
    await sleep(200);
  }
  throw new Error("la grille ne s'affiche pas");
}

async function setDensity(target) {
  let current = await js(`JSON.parse(localStorage.getItem("myboard.grille") ?? "null")?.state?.density ?? 7`);
  await js(`window.__bench.start()`);
  while (current !== target) {
    const step = target > current ? 1 : -1;
    await wheel(900, 500, step * 100, true);
    current += step;
  }
  // Nouvelle disposition affichée, puis page complète (nouveau nombre de médias, images chargées).
  const layout = await js(`window.__bench.columns(${target})`);
  await sleep(400); // laisse passer le délai d'adaptation du nombre par page
  const full = await js(`window.__bench.settled(undefined)`);
  return { layout, full };
}

async function pageChange() {
  const before = await js(`window.__bench.firstTitle()`);
  await js(`window.__bench.start()`);
  await key("ArrowRight", 39);
  return js(`window.__bench.settled(${JSON.stringify(before)})`);
}

/** Saisit une page dans le champ « aller à » (en haut) et valide. */
async function goToPage(target) {
  return js(`(() => {
    const input = document.querySelector('[data-zone="grille.pagination-haut"] input');
    if (!input) return null;
    const page = Math.min(Number(input.max), ${target});
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, String(page));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return page;
  })()`).then(async (page) => {
    if (page === null) throw new Error("pagination introuvable");
    await sleep(50);
    await js(`document.querySelector('[data-zone="grille.pagination-haut"] form').requestSubmit()`);
    return page;
  });
}

/** Avant-dernière page : mesure le coût d'une page très loin dans la bibliothèque. */
async function farPage() {
  const before = await js(`window.__bench.firstTitle()`);
  const max = await js(`Number(document.querySelector('[data-zone="grille.pagination-haut"] input')?.max ?? 0)`);
  await js(`window.__bench.start()`);
  const target = await goToPage(max - 1);
  const ms = await js(`window.__bench.settled(${JSON.stringify(before)})`);
  return { target, ms };
}

async function scrollTest() {
  await js(`scrollTo(0, 0); window.__bench.frames = []; window.__bench.recording = true; true`);
  const height = await js(`document.documentElement.scrollHeight - innerHeight`);
  // Molette réelle : 120 px toutes les 16 ms, jusqu'en bas puis retour en haut (2 s max chaque).
  for (const dir of [1, -1]) {
    const t0 = Date.now();
    while (Date.now() - t0 < 2000) {
      await wheel(900, 500, dir * 120);
      await sleep(16);
      const y = await js(`scrollY`);
      if ((dir > 0 && y >= height - 2) || (dir < 0 && y <= 0)) break;
    }
  }
  await sleep(300);
  const frames = await js(`window.__bench.recording = false; window.__bench.frames`);
  const deltas = frames.slice(1).map((t, i) => t - frames[i]);
  const fps = deltas.length ? 1000 / (deltas.reduce((a, b) => a + b, 0) / deltas.length) : 0;
  const sorted = [...deltas].sort((a, b) => a - b);
  // Rythme de l'écran = intervalle le plus courant ; une image « ratée » arrive avec au moins
  // une demi-image de retard sur ce rythme.
  const refresh = median(deltas) ?? 16.7;
  return {
    refreshHz: Math.round(1000 / refresh),
    missed: deltas.filter((d) => d > refresh * 1.5).length,
    frames: deltas.length,
    fps: Math.round(fps),
    p95: Math.round(sorted[Math.floor(sorted.length * 0.95)] ?? 0),
    worst: Math.round(sorted.at(-1) ?? 0),
    jank: deltas.filter((d) => d > 50).length,
    scrollable: height,
  };
}

// --- Déroulement ------------------------------------------------------------------------
try {
  await send("Runtime.enable");
  await waitForGrid();
  await js(HELPERS);
  const info = await js(`({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio,
    total: document.querySelector('[data-zone="grille.filtres.compteur"]')?.textContent })`);
  console.log(`Fenêtre ${info.w}×${info.h} (zoom ${info.dpr}) — bibliothèque : ${info.total}`);

  const rows = [];
  for (const d of DENSITIES) {
    const densityMs = await setDensity(d);
    await sleep(300);
    // Changer de densité garde le média affiché : on repart explicitement de la page 1.
    if ((await js(`document.querySelector('[aria-current=page]')?.textContent`)) !== "1") {
      const before = await js(`window.__bench.firstTitle()`);
      await js(`window.__bench.start()`);
      await goToPage(1);
      await js(`window.__bench.settled(${JSON.stringify(before)})`);
    }
    await sleep(300);
    const pages = [];
    for (let i = 0; i < 5; i++) pages.push(await pageChange());
    const far = await farPage();
    await sleep(300);
    const scroll = await scrollTest();
    const tiles = await js(`window.__bench.tiles().length`);
    const heap = await js(`Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576)`);
    rows.push({ d, densityMs, pageMs: median(pages), far, scroll, tiles, heap });
    console.log(
      `${d} col. : densité ${densityMs.layout} ms (page complète ${densityMs.full} ms) · page ${median(pages)} ms (${pages.join("/")}) · page ${far.target} ${far.ms} ms · ` +
        `défilement ${scroll.fps} img/s, p95 ${scroll.p95} ms, pire ${scroll.worst} ms, ${scroll.jank} saccades · ` +
        (screen ? `${scroll.missed} images ratées sur ${scroll.frames} (écran ${scroll.refreshHz} Hz) · ` : "") +
        `${tiles} vignettes dans la page · mémoire JS ${heap} Mo`,
    );
  }

  const missedHeader = screen ? " Images ratées |" : "";
  console.log(
    `\n| Colonnes | Médias/page | Changer de densité | Page suivante (médiane) | Page lointaine | Défilement (images/s) | p95 / pire image | Saccades > 50 ms |${missedHeader} Vignettes présentes | Mémoire JS |`,
  );
  console.log(`|---|---|---|---|---|---|---|---|${screen ? "---|" : ""}---|---|`);
  for (const r of rows) {
    const perPage = Math.round(50 + (450 * (r.d - 4)) / 26);
    const missed = screen ? ` ${r.scroll.missed} / ${r.scroll.frames} |` : "";
    console.log(
      `| ${r.d} | ${perPage} | ${r.densityMs.layout} / ${r.densityMs.full} ms | ${r.pageMs} ms | ${r.far.ms} ms (p. ${r.far.target}) | ${r.scroll.fps} | ${r.scroll.p95} / ${r.scroll.worst} ms | ${r.scroll.jank} |${missed} ${r.tiles} | ${r.heap} Mo |`,
    );
  }
} finally {
  ws.close();
  app.kill();
  await sleep(1500);
  try {
    rmSync(webviewDir, { recursive: true, force: true });
  } catch {
    /* WebView2 peut garder des fichiers ouverts quelques secondes */
  }
}
