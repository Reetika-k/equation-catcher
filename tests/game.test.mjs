import { test } from "node:test";
import assert from "node:assert/strict";
import { mulberry32 } from "../src/rng.js";
import { makeEquation, makeChoices } from "../src/equations.js";
import { createGame, LEVELS, START_LIVES, POINTS_PER_CATCH } from "../src/game.js";

test("equations: every level produces equations whose stated answer is the only solution among the choices", () => {
  for (const level of [1, 2, 3]) {
    const rng = mulberry32(100 + level);
    for (let i = 0; i < 200; i++) {
      const eq = makeEquation(level, rng);
      assert.ok(Number.isInteger(eq.answer) && eq.answer >= 1, `${eq.text} → ${eq.answer}`);
      assert.equal(eq.check(eq.answer), true, `${eq.text} should be solved by ${eq.answer}`);
      assert.match(eq.text, /=/);
      const ch = makeChoices(eq, 3, rng);
      assert.equal(ch.decoys.length, 3);
      assert.equal(new Set([ch.answer, ...ch.decoys]).size, 4, "answer and decoys are distinct");
      for (const d of ch.decoys) assert.equal(eq.check(d), false, `decoy ${d} must not solve ${eq.text}`);
    }
  }
});

test("equations: level forms match the concept (one-step / two-step / both sides)", () => {
  const rng = mulberry32(7);
  assert.match(makeEquation(1, rng).text, /^(x [+-] \d+ = -?\d+|\d+x = \d+)$/);
  assert.match(makeEquation(2, rng).text, /^\d+x [+-] \d+ = -?\d+$/);
  assert.match(makeEquation(3, rng).text, /^\d*x( [+-] \d+)? = \d*x( [+-] \d+)?$/);
});

test("equations are reproducible with a seed and vary without one", () => {
  assert.deepEqual(makeEquation(2, mulberry32(42)).text, makeEquation(2, mulberry32(42)).text);
  const rng = mulberry32(1);
  const texts = new Set(Array.from({ length: 20 }, () => makeEquation(2, rng).text));
  assert.ok(texts.size > 10, "twenty equations should not all be the same");
});

function gameWithCorrectAtBasket(seed = 1) {
  const g = createGame({ rng: mulberry32(seed) });
  g.start();
  const b = g.state.basket;
  g.state.objects = [{ x: b.x, y: b.y - b.h / 2 - 22, r: 22, vy: 100, kind: "correct", value: g.state.choices.answer, wobble: 0 }];
  return g;
}

test("game: start resets score, lives and level and shows an equation", () => {
  const g = createGame({ rng: mulberry32(3) });
  assert.equal(g.state.screen, "start");
  g.start();
  assert.equal(g.state.screen, "playing");
  assert.equal(g.state.level, 1);
  assert.equal(g.state.lives, START_LIVES);
  assert.equal(g.state.score, 0);
  assert.equal(g.state.needed, LEVELS[0].needed);
  assert.equal(g.state.timeLeft, LEVELS[0].time);
  assert.ok(g.state.equation.text.includes("="));
});

test("game: keyboard input moves the basket and it stays inside the screen", () => {
  const g = createGame({ rng: mulberry32(3) });
  g.start();
  const x0 = g.state.basket.x;
  g.update(0.05, { left: true });
  assert.ok(g.state.basket.x < x0);
  for (let i = 0; i < 200; i++) g.update(0.05, { right: true });
  assert.equal(g.state.basket.x, g.state.width - g.state.basket.w / 2, "clamped at the right edge");
});

test("game: catching the correct number scores and gives a new equation", () => {
  const g = gameWithCorrectAtBasket();
  const first = g.state.equation.text;
  g.update(0.05);
  assert.equal(g.state.score, POINTS_PER_CATCH);
  assert.equal(g.state.catches, 1);
  assert.notEqual(g.state.equation.text, first);
  assert.ok(g.drainEvents().some((e) => e.type === "catch"));
});

test("game: catching a decoy or bomb costs a life; 0 lives → lost", () => {
  const g = createGame({ rng: mulberry32(5) });
  g.start();
  const b = g.state.basket;
  const drop = (kind) => { g.state.objects = [{ x: b.x, y: b.y - b.h / 2 - 22, r: 22, vy: 100, kind, value: kind === "decoy" ? g.state.choices.decoys[0] : null, wobble: 0 }]; g.update(0.05); };
  drop("decoy"); assert.equal(g.state.lives, 2);
  drop("bomb"); assert.equal(g.state.lives, 1);
  drop("decoy"); assert.equal(g.state.lives, 0);
  assert.equal(g.state.screen, "lost");
  assert.equal(g.state.lostReason, "lives");
  assert.ok(g.drainEvents().some((e) => e.type === "lose"));
});

test("game: timer running out ends the game", () => {
  const g = createGame({ rng: mulberry32(8) });
  g.start();
  g.state.timeLeft = 0.04;
  g.update(0.05);
  assert.equal(g.state.screen, "lost");
  assert.equal(g.state.lostReason, "time");
});

test("game: clearing a level adds a time bonus, then next level, then win after level 3", () => {
  const g = createGame({ rng: mulberry32(9) });
  g.start();
  for (let level = 1; level <= 3; level++) {
    assert.equal(g.state.level, level);
    const before = g.state.score;
    for (let i = 0; i < g.state.needed; i++) {
      const b = g.state.basket;
      g.state.objects = [{ x: b.x, y: b.y - b.h / 2 - 22, r: 22, vy: 100, kind: "correct", value: g.state.choices.answer, wobble: 0 }];
      g.update(0.05);
    }
    assert.equal(g.state.screen, "levelup");
    assert.ok(g.state.score >= before + g.state.needed * POINTS_PER_CATCH * level, "points plus time bonus");
    g.nextLevel();
  }
  assert.equal(g.state.screen, "won");
  assert.ok(g.drainEvents().some((e) => e.type === "win"));
  g.restart();
  assert.equal(g.state.screen, "playing");
  assert.equal(g.state.level, 1);
  assert.equal(g.state.score, 0);
});

test("game: the correct answer is guaranteed to appear within three spawns", () => {
  const g = createGame({ rng: mulberry32(11) });
  g.start();
  let spawns = 0, seenCorrect = false;
  while (spawns < 3 && !seenCorrect) {
    g.state.spawnTimer = 0;
    g.update(0.01);
    spawns++;
    seenCorrect = g.state.objects.some((o) => o.kind === "correct");
  }
  assert.equal(seenCorrect, true);
});

test("game: objects that fall past the bottom are removed; a missed correct answer emits 'miss'", () => {
  const g = createGame({ rng: mulberry32(12) });
  g.start();
  g.state.basket.x = 40;
  g.state.objects = [{ x: 400, y: g.state.height + 30, r: 22, vy: 100, kind: "correct", value: 1, wobble: 0 }];
  g.state.spawnTimer = 99;
  g.update(0.01);
  assert.equal(g.state.objects.length, 0);
  assert.ok(g.drainEvents().some((e) => e.type === "miss"));
});
