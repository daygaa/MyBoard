// Outil de test : pilote la fenêtre de MyBoard par le protocole DevTools de WebView2.
// Lancer MyBoard avec WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333.
//   node scripts/cdp.mjs eval "<js>"            → exécute du code dans la page, affiche le résultat
//   node scripts/cdp.mjs evalfile <fichier.js>  → idem, code lu dans un fichier
//   node scripts/cdp.mjs shot <fichier.png>     → capture d'écran
//   node scripts/cdp.mjs click "<sélecteur CSS>" → vrai clic au centre de l'élément
//   node scripts/cdp.mjs key <Touche> [ctrl]    → vrai appui clavier
//   node scripts/cdp.mjs wheel <x> <y> <dy> [ctrl] → vraie molette
// Les commandes Tauri s'appellent depuis la page : window.__TAURI_INTERNALS__.invoke("…").
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PORT = process.env.CDP_PORT || 9333;

export async function connect() {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const page = targets.find((t) => t.type === "page");
  if (!page) throw new Error("aucune page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = ++id;
      pending.set(i, { resolve, reject });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  return { send, evaluate, close: () => ws.close() };
}

// Lancé directement (et non importé) ? `pathToFileURL` encode les espaces (« new V2 » → « new%20V2 »)
// comme `import.meta.url` : une simple comparaison de textes échouait sans rien dire.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, ...args] = process.argv.slice(2);
  const c = await connect();
  if (cmd === "eval") console.log(JSON.stringify(await c.evaluate(args[0]), null, 1));
  else if (cmd === "evalfile") console.log(JSON.stringify(await c.evaluate((await import("node:fs")).readFileSync(args[0], "utf8")), null, 1));
  else if (cmd === "shot") {
    const r = await c.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(args[0], Buffer.from(r.data, "base64"));
    console.log("ok", args[0]);
  } else if (cmd === "key") {
    const modifiers = args[1] === "ctrl" ? 2 : 0;
    const map = { ArrowRight: 39, ArrowLeft: 37, Escape: 27 };
    for (const type of ["rawKeyDown", "keyUp"])
      await c.send("Input.dispatchKeyEvent", { type, key: args[0], code: args[0], windowsVirtualKeyCode: map[args[0]], modifiers });
    console.log("ok");
  } else if (cmd === "click") {
    // Clic réel au centre de l'élément désigné par un sélecteur CSS.
    const box = await c.evaluate(`(() => { const r = document.querySelector(${JSON.stringify(args[0])}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    for (const type of ["mousePressed", "mouseReleased"])
      await c.send("Input.dispatchMouseEvent", { type, x: box.x, y: box.y, button: "left", clickCount: 1 });
    console.log("ok", box);
  } else if (cmd === "wheel") {
    const [x, y, dy, mod] = args;
    await c.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: +x, y: +y, deltaX: 0, deltaY: +dy, modifiers: mod === "ctrl" ? 2 : 0 });
    console.log("ok");
  }
  c.close();
}
