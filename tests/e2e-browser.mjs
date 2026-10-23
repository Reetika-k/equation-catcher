// Browser play test through the Chrome DevTools Protocol (no dependencies).
// 1) npm start   2) Chrome: --headless=new --remote-debugging-port=9334 --remote-allow-origins=*
// 3) node tests/e2e-browser.mjs [baseUrl]      Screenshots go to docs/screenshots/.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const base = process.argv[2] || "http://localhost:8080";
const cdp = "http://localhost:9334";
const shots = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", "screenshots");
fs.mkdirSync(shots, { recursive: true });

const target = await (await fetch(`${cdp}/json/new?${encodeURIComponent(base + "/?seed=7")}`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const jsErrors = [];
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") jsErrors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") jsErrors.push(m.params.args.map((a) => a.value ?? a.description).join(" ")); };
const send = (method, params = {}) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error("eval: " + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text)); return r.result?.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (expr, label, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await js(expr)) return; await sleep(100); } throw new Error("timeout: " + label); };
const key = async (k, code) => { await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code }); await sleep(150); await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code }); };
// Hold a key until a condition holds (up to ms). A fixed 150 ms press could fall between two frames on a busy machine.
const holdUntil = async (k, code, cond, ms = 5000) => { await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code }); const t0 = Date.now(); while (Date.now() - t0 < ms && !(await js(cond))) await sleep(50); await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code }); };
const shot = async (name) => { const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(shots, name), Buffer.from(r.result.data, "base64")); };
const results = []; const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + String(detail).replace(/\s+/g, " ").slice(0, 140) : ""}`); };

await send("Runtime.enable"); await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 560, height: 900, deviceScaleFactor: 1, mobile: false });
try {
  await waitFor(`window.__game && !document.querySelector("#screen-start").classList.contains("hidden")`, "start screen");
  check("start screen: brand title, instructions, Start button", await js(`document.querySelector(".brand-title").textContent === "Equation Catcher" && !!document.querySelector("#screen-start .modal-title") && document.querySelectorAll(".how li").length >= 3 && !!document.querySelector("#btn-start")`));
  check("canvas has drawn content", await js(`(() => { const c = document.querySelector("#game"); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let colors = new Set(); for (let i = 0; i < d.length; i += 4 * 997) colors.add(d[i] + "," + d[i+1] + "," + d[i+2]); return colors.size > 3; })()`));

  await js(`document.querySelector("#btn-start").click()`);
  await waitFor(`window.__game.state.screen === "playing"`, "playing");
  check("Start → playing, HUD shows Level 1 and 3 lives", await js(`document.querySelector("#hud-level").textContent === "Level 1" && document.querySelector("#hud-lives").textContent === "♥♥♥" && document.querySelector("#hud").offsetParent !== null`));
  const eq = await js(`window.__game.state.equation.text`);
  check("an equation is shown", /=/.test(eq), eq);
  check("AI coach: HUD shows its predicted first-try chance and that it is adapting", await js(`/^\\d+%$/.test(document.querySelector("#hud-coach").textContent) && /adapting/.test(document.querySelector("#hud-coach-foot").textContent)`), await js(`document.querySelector("#hud-coach").textContent`));

  const x0 = await js(`window.__game.state.basket.x`);
  await holdUntil("ArrowRight", "ArrowRight", `window.__game.state.basket.x > ${x0} + 5`);
  const x1 = await js(`window.__game.state.basket.x`);
  await holdUntil("a", "KeyA", `window.__game.state.basket.x < ${x1} - 5`);
  const x2 = await js(`window.__game.state.basket.x`);
  check("arrow key moves the basket right, A moves it left", x1 > x0 && x2 < x1, `${x0.toFixed(0)} → ${x1.toFixed(0)} → ${x2.toFixed(0)}`);
  await sleep(1500); await shot("02-playing.png");

  // Auto-play level 1: keep the basket under the correct number, dodge everything else.
  // The steering runs inside the page on every animation frame. (It used to run from here every 60 ms over
  // the DevTools connection; on a busy machine objects fell past between two updates and the bot lost.)
  await js(`(() => { window.__bot = true; const steer = () => { const st = window.__game.state;
      if (st.screen === "playing") { const b = st.basket; const correct = st.objects.filter(o => o.kind === "correct").sort((p, q) => q.y - p.y)[0];
        const threats = st.objects.filter(o => o.kind !== "correct" && o.y > b.y - 160);
        let tx = correct ? correct.x : b.x;
        for (const t of threats) if (Math.abs(t.x - tx) < 70) tx = t.x < st.width / 2 ? t.x + 90 : t.x - 90;
        b.x = Math.max(b.w / 2, Math.min(st.width - b.w / 2, tx)); }
      if (window.__bot) requestAnimationFrame(steer); }; requestAnimationFrame(steer); return true; })()`);
  const t0 = Date.now(); let lastScore = 0;
  while (Date.now() - t0 < 90000) {
    const s = await js(`({ screen: window.__game.state.screen, score: window.__game.state.score })`);
    if (s.screen !== "playing") break;
    lastScore = s.score;
    await sleep(200);
  }
  await js(`window.__bot = false`);
  const after = await js(`({ screen: window.__game.state.screen, score: window.__game.state.score, lives: window.__game.state.lives, catches: window.__game.state.catches })`);
  check("auto-play caught correct answers and scored", after.score > 0, JSON.stringify(after));
  check("level 1 cleared → level-up screen", after.screen === "levelup" && await js(`document.querySelector("#levelup-title").textContent === "Level 1 cleared!"`), JSON.stringify(after));
  await shot("03-levelup.png");
  await js(`document.querySelector("#btn-next").click()`);
  await waitFor(`window.__game.state.screen === "playing" && window.__game.state.level === 2`, "level 2");
  await waitFor(`document.querySelector("#hud-level").textContent === "Level 2"`, "HUD shows Level 2", 3000); // HUD updates on the next animation frame
  check("Next level → Level 2 with faster objects", await js(`document.querySelector("#hud-level").textContent === "Level 2" && window.__game.LEVELS[1].fallSpeed > window.__game.LEVELS[0].fallSpeed`));

  // Pause / resume and mute
  await key("p", "KeyP");
  check("P pauses (overlay shown)", await js(`!document.querySelector("#screen-paused").classList.contains("hidden")`));
  const tPaused = await js(`window.__game.state.timeLeft`); await sleep(700);
  check("timer does not run while paused", Math.abs((await js(`window.__game.state.timeLeft`)) - tPaused) < 0.01);
  await key("p", "KeyP");
  check("P resumes", await js(`document.querySelector("#screen-paused").classList.contains("hidden")`));
  await js(`document.querySelector("#btn-mute").click()`);
  check("mute button toggles and is remembered", await js(`document.querySelector("#btn-mute").textContent === "🔇" && localStorage.getItem("equation-catcher.muted") === "1"`));

  // Force a loss by time, check game-over screen and high score, then restart
  await js(`window.__game.state.timeLeft = 0.02`);
  await waitFor(`window.__game.state.screen === "lost"`, "lost");
  await sleep(300);
  const over = await js(`({ title: document.querySelector("#over-title").textContent, reason: document.querySelector("#over-reason").textContent, score: document.querySelector("#over-score").textContent, best: document.querySelector("#over-best").textContent, visible: !document.querySelector("#screen-over").classList.contains("hidden") })`);
  check("game over screen: reason, final score, highest score, restart", over.visible && /Time ran out/.test(over.reason) && Number(over.score) > 0 && Number(over.best) >= Number(over.score), JSON.stringify(over));
  check("AI coach learned from this game: attempts saved in the browser, insight on the game-over card", await js(`(() => { const c = JSON.parse(localStorage.getItem("equation-catcher.coach") || "null"); const el = document.querySelector("#over-coach"); return !!c && c.attempts > 0 && (el.classList.contains("hidden") || /AI coach/.test(el.textContent)); })()`), await js(`localStorage.getItem("equation-catcher.coach")?.slice(0, 80)`));
  await shot("04-gameover.png");
  await js(`document.querySelector("#btn-restart").click()`);
  await waitFor(`window.__game.state.screen === "playing"`, "restart");
  check("Play again resets to level 1 with score 0 and 3 lives", await js(`window.__game.state.level === 1 && window.__game.state.score === 0 && window.__game.state.lives === 3`));
  check("best score persisted on the start screen after reload", await (async () => { await send("Page.navigate", { url: base + "/?seed=7" }); await waitFor(`window.__game && document.querySelector("#best-start")`, "reload"); return Number(await js(`document.querySelector("#best-start").textContent`)) >= Number(over.score); })());

  // Lose by lives: drop three decoys into the basket
  await js(`document.querySelector("#btn-start").click()`); await waitFor(`window.__game.state.screen === "playing"`, "playing 2");
  for (let i = 0; i < 3; i++) { await js(`(() => { const st = window.__game.state, b = st.basket; st.objects = [{ x: b.x, y: b.y - b.h / 2 - 22, r: 22, vy: 100, kind: "decoy", value: st.choices.decoys[0], wobble: 0 }]; })()`); await sleep(150); }
  await waitFor(`window.__game.state.screen === "lost"`, "lost by lives");
  check("three wrong catches → 'ran out of lives'", await js(`/ran out of lives/.test(document.querySelector("#over-reason").textContent) && document.querySelector("#hud-lives").textContent === "♡♡♡"`));

  // Mobile layout: touch buttons visible at phone width
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 780, deviceScaleFactor: 2, mobile: true });
  await sleep(300);
  check("phone width: touch buttons visible, no horizontal overflow", await js(`document.querySelector("#btn-left").offsetParent !== null && document.documentElement.scrollWidth <= window.innerWidth + 1`));
  await shot("05-mobile.png");
} catch (e) { check("flow completed without exception", false, e.message); }
check("no JavaScript errors", jsErrors.length === 0, jsErrors.join(" | "));
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed} / ${results.length} browser checks passed`);
ws.close(); process.exit(passed === results.length ? 0 : 1);
