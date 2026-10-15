// Pure game logic: no DOM, no canvas. update(dt, input) advances the simulation and pushes events
// (catch, wrong, bomb, levelup, win, lose) that the UI turns into sound and effects.
import { makeEquation, makeChoices } from "./equations.js";
import { randInt, pick } from "./rng.js";

export const LEVELS = [
  { level: 1, name: "One-step equations", needed: 5, fallSpeed: 110, spawnEvery: 1.1, decoys: 2, bombChance: 0, time: 60 },
  { level: 2, name: "Two-step equations", needed: 6, fallSpeed: 150, spawnEvery: 0.95, decoys: 3, bombChance: 0, time: 60 },
  { level: 3, name: "Variable on both sides", needed: 7, fallSpeed: 190, spawnEvery: 0.8, decoys: 3, bombChance: 0.18, time: 60 },
];
export const START_LIVES = 3;
export const POINTS_PER_CATCH = 10;

export function createGame({ width = 480, height = 640, rng = Math.random } = {}) {
  const state = {
    screen: "start", // start | playing | levelup | won | lost
    width, height,
    level: 1, score: 0, lives: START_LIVES, timeLeft: 0, catches: 0, needed: 0,
    equation: null, choices: null,
    basket: { x: width / 2, y: height - 40, w: 96, h: 22, speed: 380 },
    objects: [], spawnTimer: 0, spawnsSinceCorrect: 0,
    events: [], lostReason: null, elapsed: 0,
  };

  function config() { return LEVELS[state.level - 1]; }

  function newEquation() {
    state.equation = makeEquation(state.level, rng);
    state.choices = makeChoices(state.equation, config().decoys, rng);
    state.spawnsSinceCorrect = 0;
  }

  function beginLevel(n) {
    state.level = n;
    state.catches = 0;
    state.needed = config().needed;
    state.timeLeft = config().time;
    state.objects = [];
    state.spawnTimer = 0;
    state.basket.x = width / 2;
    newEquation();
    state.screen = "playing";
  }

  function start() {
    state.score = 0; state.lives = START_LIVES; state.lostReason = null; state.elapsed = 0; state.events = [];
    beginLevel(1);
  }

  function nextLevel() {
    if (state.screen !== "levelup") return;
    if (state.level >= LEVELS.length) { state.screen = "won"; state.events.push({ type: "win" }); return; }
    beginLevel(state.level + 1);
  }

  function spawn() {
    const c = config();
    const r = 22;
    const correctOnScreen = state.objects.some((o) => o.kind === "correct");
    let kind, value;
    if (c.bombChance && rng() < c.bombChance) { kind = "bomb"; value = null; }
    else if (!correctOnScreen && (state.spawnsSinceCorrect >= 2 || rng() < 0.5)) { kind = "correct"; value = state.choices.answer; }
    else { kind = "decoy"; value = pick(rng, state.choices.decoys); }
    if (kind === "correct") state.spawnsSinceCorrect = 0; else state.spawnsSinceCorrect++;
    state.objects.push({ x: randInt(rng, r + 8, width - r - 8), y: -r, r, vy: c.fallSpeed * (0.9 + rng() * 0.3), kind, value, wobble: rng() * Math.PI * 2 });
  }

  function lose(reason) {
    state.screen = "lost"; state.lostReason = reason; state.objects = [];
    state.events.push({ type: "lose", reason });
  }

  function caught(o) {
    if (o.kind === "correct") {
      state.score += POINTS_PER_CATCH * state.level;
      state.catches += 1;
      state.events.push({ type: "catch", x: o.x, y: o.y, value: o.value });
      if (state.catches >= state.needed) {
        const bonus = Math.max(0, Math.round(state.timeLeft));
        state.score += bonus;
        state.objects = [];
        state.screen = "levelup";
        state.events.push({ type: "levelup", level: state.level, bonus });
      } else {
        newEquation();
        state.objects = state.objects.filter((k) => k.kind === "bomb"); // old choices no longer apply
      }
    } else {
      state.lives -= 1;
      state.events.push({ type: o.kind === "bomb" ? "bomb" : "wrong", x: o.x, y: o.y, value: o.value });
      if (state.lives <= 0) lose("lives");
    }
  }

  /** dt in seconds; input: { left, right, targetX } */
  function update(dt, input = {}) {
    if (state.screen !== "playing") return;
    dt = Math.min(dt, 0.05); // avoid tunnelling after a tab switch
    state.elapsed += dt;
    const b = state.basket;
    if (input.left) b.x -= b.speed * dt;
    if (input.right) b.x += b.speed * dt;
    if (typeof input.targetX === "number") { const d = input.targetX - b.x; b.x += Math.sign(d) * Math.min(Math.abs(d), b.speed * 1.5 * dt); }
    b.x = Math.max(b.w / 2, Math.min(width - b.w / 2, b.x));

    state.timeLeft -= dt;
    if (state.timeLeft <= 0) { state.timeLeft = 0; lose("time"); return; }

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) { spawn(); state.spawnTimer = config().spawnEvery; }

    const basketTop = b.y - b.h / 2;
    const survivors = [];
    for (const o of state.objects) {
      o.y += o.vy * dt;
      o.wobble += dt * 3;
      const inBasketX = Math.abs(o.x - b.x) <= b.w / 2 + o.r * 0.5;
      const atBasketY = o.y + o.r >= basketTop && o.y - o.r <= basketTop + b.h + 6;
      if (inBasketX && atBasketY) { caught(o); if (state.screen !== "playing") return; continue; }
      if (o.y - o.r > height) { if (o.kind === "correct") state.events.push({ type: "miss" }); continue; }
      survivors.push(o);
    }
    if (state.screen === "playing") state.objects = survivors;
  }

  function drainEvents() { const e = state.events; state.events = []; return e; }

  /** Back to the start screen without starting a new game. */
  function menu() { state.screen = "start"; state.objects = []; }

  return { state, start, restart: start, update, nextLevel, drainEvents, menu, LEVELS };
}
