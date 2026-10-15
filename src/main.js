// Wiring: DOM screens, input (keyboard, pointer, touch buttons), game loop, effects, sound, high score.
import { createGame, LEVELS } from "./game.js";
import { draw } from "./render.js";
import { audio } from "./audio.js";
import { mulberry32 } from "./rng.js";

const BEST_KEY = "equation-catcher.best";
const $ = (s) => document.querySelector(s);
const canvas = $("#game"), ctx = canvas.getContext("2d");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ?seed=123 makes a reproducible game (used by the automated browser test and for demos)
const seedParam = new URLSearchParams(location.search).get("seed");
const rng = seedParam ? mulberry32(Number(seedParam) || 1) : Math.random;
const game = createGame({ width: canvas.width, height: canvas.height, rng });
const { state } = game;

const fx = { particles: [], floats: [], shake: 0, tilt: 0, t: 0, clouds: [{ x: 40, y: 150, s: 1, speed: 8 }, { x: 260, y: 210, s: 0.7, speed: 12 }, { x: 380, y: 125, s: 0.85, speed: 6 }] };
const input = { left: false, right: false, targetX: undefined };
const session = { wrong: 0, caught: 0 }; // for the accuracy stat on the end screen
let paused = false, last = performance.now(), prevX = state.basket.x;

const best = { get: () => { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; } }, set: (v) => { try { localStorage.setItem(BEST_KEY, String(v)); } catch {} } };

// ---------- screens ----------
const screens = { start: $("#screen-start"), levelup: $("#screen-levelup"), over: $("#screen-over"), paused: $("#screen-paused") };
function show(name) { for (const [k, el] of Object.entries(screens)) el.classList.toggle("hidden", k !== name); $("#hud").classList.toggle("idle", name === "start"); }

function startGame() { audio.unlock(); game.start(); paused = false; fx.particles = []; fx.floats = []; session.wrong = 0; session.caught = 0; show(null); }
function toMenu() { game.menu(); $("#best-start").textContent = best.get(); show("start"); }
function onLevelUp(ev) {
  $("#levelup-title").textContent = `Level ${ev.level} cleared!`;
  $("#levelup-bonus").textContent = `Time bonus +${ev.bonus} · Score ${state.score}`;
  const next = LEVELS[ev.level];
  $("#levelup-next").textContent = next ? `Next: Level ${next.level} – ${next.name} (faster${next.bombChance ? ", with bombs" : ""})` : "That was the last level!";
  $("#btn-next").textContent = next ? "Next level" : "See result";
  show("levelup");
}
function onGameEnd(won, reason) {
  const b = Math.max(best.get(), state.score); best.set(b);
  $("#over-title").textContent = won ? "You win!" : "Game over";
  $("#over-reason").textContent = won ? `All ${LEVELS.length} levels cleared with ${state.lives} ${state.lives === 1 ? "life" : "lives"} left.` : reason === "time" ? "Time ran out." : "You ran out of lives.";
  $("#over-answer").textContent = !won && state.equation ? `The answer was x = ${state.equation.answer}  (${state.equation.text.replace(/-/g, "−")})` : "";
  $("#over-score").textContent = state.score; $("#over-best").textContent = b;
  $("#over-level").textContent = state.level;
  const total = session.caught + session.wrong;
  $("#over-accuracy").textContent = total ? `${Math.round((session.caught / total) * 100)}%` : "–";
  audio.play(won ? "win" : "lose");
  show("over");
}

// ---------- input ----------
const keys = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
addEventListener("keydown", (e) => {
  if (keys[e.key]) { input[keys[e.key]] = true; input.targetX = undefined; e.preventDefault(); }
  if (e.key === "p" || e.key === "P") togglePause();
  if (e.key === "m" || e.key === "M") setMute(audio.toggle());
  if (e.key === "Enter" || e.key === " ") { if (state.screen === "start") startGame(); else if (state.screen === "levelup") advance(); else if (state.screen === "won" || state.screen === "lost") startGame(); }
});
addEventListener("keyup", (e) => { if (keys[e.key]) input[keys[e.key]] = false; });
const hold = (id, dir) => { const el = $(id); const on = (e) => { e.preventDefault(); input[dir] = true; input.targetX = undefined; }; const off = () => { input[dir] = false; }; el.addEventListener("pointerdown", on); el.addEventListener("pointerup", off); el.addEventListener("pointercancel", off); el.addEventListener("pointerleave", off); };
hold("#btn-left", "left"); hold("#btn-right", "right");
const canvasX = (e) => { const r = canvas.getBoundingClientRect(); return (e.clientX - r.left) * (canvas.width / r.width); };
let dragging = false;
canvas.addEventListener("pointerdown", (e) => { dragging = true; input.targetX = canvasX(e); canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener("pointermove", (e) => { if (dragging) input.targetX = canvasX(e); });
const endDrag = () => { dragging = false; input.targetX = undefined; };
canvas.addEventListener("pointerup", endDrag); canvas.addEventListener("pointercancel", endDrag);

function advance() { audio.unlock(); game.nextLevel(); if (state.screen === "playing") show(null); }
$("#btn-start").addEventListener("click", startGame);
$("#btn-restart").addEventListener("click", startGame);
$("#btn-menu").addEventListener("click", toMenu);
$("#btn-next").addEventListener("click", advance);
$("#btn-resume").addEventListener("click", togglePause);
$("#btn-pause").addEventListener("click", togglePause);
$("#btn-mute").addEventListener("click", () => setMute(audio.toggle()));
function togglePause() { if (state.screen !== "playing") return; paused = !paused; show(paused ? "paused" : null); }
function setMute(m) { $("#btn-mute").textContent = m ? "🔇" : "🔊"; }
document.addEventListener("visibilitychange", () => { if (document.hidden && state.screen === "playing" && !paused) togglePause(); });

// ---------- effects ----------
function burst(x, y, color, n = 14) { if (reduceMotion) return; for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 160; fx.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 1, size: 3 + Math.random() * 3, color }); } }
function float(x, y, text, color) { fx.floats.push({ x, y, text, color, life: 1 }); }
function hitHearts() { const h = $("#hud-lives"); h.classList.remove("hit"); void h.offsetWidth; h.classList.add("hit"); }
function handleEvents() {
  for (const ev of game.drainEvents()) {
    if (ev.type === "catch") { session.caught++; audio.play("catch"); burst(ev.x, ev.y, "#ffd166"); float(ev.x, ev.y - 20, `+${10 * state.level}`, "#0f766e"); }
    else if (ev.type === "wrong") { session.wrong++; audio.play("wrong"); if (!reduceMotion) fx.shake = 1; burst(ev.x, ev.y, "#ef4444", 10); float(ev.x, ev.y - 20, "✗", "#b91c1c"); hitHearts(); }
    else if (ev.type === "bomb") { session.wrong++; audio.play("bomb"); if (!reduceMotion) fx.shake = 1.6; burst(ev.x, ev.y, "#111827", 22); float(ev.x, ev.y - 20, "BOOM", "#b91c1c"); hitHearts(); }
    else if (ev.type === "miss") { audio.play("miss"); }
    else if (ev.type === "levelup") { audio.play("levelup"); onLevelUp(ev); }
    else if (ev.type === "win") { onGameEnd(true); }
    else if (ev.type === "lose") { onGameEnd(false, ev.reason); }
  }
}

// ---------- HUD ----------
const ringFg = $("#ring-fg");
function updateHud() {
  $("#hud-level").textContent = `Level ${state.level}`;
  $("#hud-score").textContent = `Score ${state.score}`;
  $("#hud-best").textContent = Math.max(best.get(), state.score);
  $("#hud-lives").textContent = "♥".repeat(Math.max(0, state.lives)) + "♡".repeat(Math.max(0, 3 - state.lives));
  const pct = state.needed ? Math.min(100, Math.round((state.catches / state.needed) * 100)) : 0;
  $("#hud-progress").style.width = pct + "%"; $(".progress").setAttribute("aria-valuenow", pct);
  $("#hud-catches").textContent = `${state.catches} / ${state.needed || LEVELS[0].needed} caught`;
  const total = LEVELS[state.level - 1]?.time || 60, left = state.screen === "start" ? total : state.timeLeft; // end screens freeze the final value
  const t = $("#hud-time"); t.textContent = Math.ceil(left);
  ringFg.style.strokeDashoffset = String(100 - Math.max(0, Math.min(100, (left / total) * 100)));
  const low = left <= 10 && state.screen === "playing";
  ringFg.classList.toggle("low", low); ringFg.classList.toggle("warn", !low && left <= 20 && state.screen === "playing"); t.classList.toggle("low", low);
}

// ---------- loop ----------
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; fx.t += dt;
  if (!paused) game.update(dt, input);
  handleEvents();
  const vx = (state.basket.x - prevX) / Math.max(dt, 0.001); prevX = state.basket.x;
  fx.tilt += ((reduceMotion ? 0 : Math.max(-0.22, Math.min(0.22, vx * 0.0006))) - fx.tilt) * 0.25;
  for (const p of fx.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt * 1.6; }
  fx.particles = fx.particles.filter((p) => p.life > 0);
  for (const f of fx.floats) { f.y -= 40 * dt; f.life -= dt * 1.2; }
  fx.floats = fx.floats.filter((f) => f.life > 0);
  fx.shake = Math.max(0, fx.shake - dt * 4);
  draw(ctx, state, fx);
  updateHud();
  requestAnimationFrame(frame);
}

$("#best-start").textContent = best.get();
setMute(audio.muted);
show("start");
updateHud();
draw(ctx, state, fx);
if (document.fonts?.load) Promise.all([document.fonts.load("600 32px Fredoka"), document.fonts.load("700 21px Nunito")]).catch(() => {}).finally(() => draw(ctx, state, fx));
requestAnimationFrame(frame);
window.__game = game; // exposed for the automated browser test
