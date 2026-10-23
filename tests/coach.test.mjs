import { test } from "node:test";
import assert from "node:assert/strict";
import { features, trainLogReg, evaluate, createCoach, chooseEquation, simulateAttempt, KINDS, TRUE_WEIGHTS, TARGET } from "../src/coach.js";
import { buildDataset, trainCoach } from "../src/coach-training.js";
import { COACH_PRIOR } from "../src/coach-prior.js";
import { createGame } from "../src/game.js";
import { makeEquation, makeChoices } from "../src/equations.js";
import { mulberry32 } from "../src/rng.js";

test("coach features: one form indicator per equation, all values in [0, 1]", () => {
  const rng = mulberry32(5);
  for (let level = 1; level <= 3; level++) for (let i = 0; i < 200; i++) {
    const eq = makeEquation(level, rng), f = features(eq, makeChoices(eq, 3, rng));
    assert.equal(f.length, 10); assert.equal(f.slice(0, KINDS.length).reduce((a, b) => a + b, 0), 1, eq.text);
    assert.ok(f.every((v) => v >= 0 && v <= 1));
  }
});

test("training: the loss falls and the model beats the baseline on learners it never saw", () => {
  const r = trainCoach();
  assert.ok(r.history.at(-1) < r.history[0] * 0.9, "training loss decreases");
  assert.ok(r.test.accuracy > r.test.baselineAccuracy + 0.05, `test accuracy ${r.test.accuracy} vs baseline ${r.test.baselineAccuracy}`);
  assert.ok(r.test.logLoss < r.test.baselineLogLoss, "better probabilities than always predicting the average");
});

test("training recovers the difficulty order of the equation forms", () => {
  const { w } = trainCoach();
  const order = (ws) => KINDS.map((k, i) => [k, ws[i]]).sort((a, b) => b[1] - a[1]).map((x) => x[0]).join(",");
  assert.equal(order(w), order(TRUE_WEIGHTS));
});

test("the shipped weights (src/coach-prior.js) match a fresh training run", () => {
  const { w } = trainCoach();
  COACH_PRIOR.w.forEach((x, i) => assert.ok(Math.abs(x - w[i]) < 1e-3, `weight ${i}`));
});

test("online learning: wrong first attempts lower the coach's prediction, right ones raise it", () => {
  const eq = makeEquation(2, mulberry32(1)), f = features(eq, makeChoices(eq, 3, mulberry32(2)));
  const c = createCoach({ prior: COACH_PRIOR }), p0 = c.predict(f);
  for (let i = 0; i < 6; i++) c.update(f, 0, eq.kind);
  assert.ok(c.predict(f) < p0 * 0.75, "falls by more than a quarter");
  const d = createCoach({ prior: COACH_PRIOR });
  for (let i = 0; i < 6; i++) d.update(f, 1, eq.kind);
  assert.ok(d.predict(f) > p0);
  assert.equal(c.toJSON().attempts, 6);
});

test("adaptive choice: the coach picks the candidate closest to the target chance", () => {
  const c = createCoach({ prior: COACH_PRIOR }), rng = mulberry32(9);
  const cands = Array.from({ length: 5 }, () => { const eq = makeEquation(1, rng); const ch = makeChoices(eq, 2, rng); return { f: features(eq, ch) }; });
  const i = chooseEquation(cands, c);
  for (const x of cands) assert.ok(Math.abs(c.predict(cands[i].f) - TARGET) <= Math.abs(c.predict(x.f) - TARGET) + 1e-12);
});

test("in the game: the first catch per equation is one attempt; bombs do not count", () => {
  const coach = createCoach({ prior: COACH_PRIOR });
  const g = createGame({ rng: mulberry32(3), coach });
  g.start();
  const before = coach.attempts;
  g.state.objects = [{ x: g.state.basket.x, y: g.state.basket.y - 20, r: 22, vy: 0, kind: "decoy", value: 999, wobble: 0 }];
  g.update(0.016, {});
  g.state.objects = [{ x: g.state.basket.x, y: g.state.basket.y - 20, r: 22, vy: 0, kind: "decoy", value: 998, wobble: 0 }];
  g.update(0.016, {});
  assert.equal(coach.attempts, before + 1, "second wrong catch on the same equation is not a new attempt");
  const ev = g.drainEvents().filter((e) => e.type === "attempt");
  assert.equal(ev.length, 1); assert.equal(ev[0].success, false); assert.equal(typeof ev[0].predicted, "number");
});

test("adaptation keeps a weak and a strong simulated learner near the target chance", () => {
  const run = (skill, adaptive, seed) => {
    const coach = createCoach({ prior: COACH_PRIOR }), rng = mulberry32(seed); let solved = 0, n = 0;
    for (let level = 1; level <= 3; level++) for (let i = 0; i < 40; i++) {
      const cands = Array.from({ length: adaptive ? 5 : 1 }, () => { const eq = makeEquation(level, rng); const ch = makeChoices(eq, level === 1 ? 2 : 3, rng); return { eq, f: features(eq, ch) }; });
      const c = cands[adaptive ? chooseEquation(cands, coach) : 0];
      const y = simulateAttempt(c.f, skill, rng); coach.update(c.f, y, c.eq.kind); solved += y; n++;
    }
    return solved / n;
  };
  const avg = (skill, adaptive) => [1, 2, 3, 4, 5].reduce((s, k) => s + run(skill, adaptive, 100 + k), 0) / 5;
  const weak = { fixed: avg(-1.5, false), adaptive: avg(-1.5, true) };
  assert.ok(weak.adaptive > weak.fixed, `weak learner solves more with the coach (${weak.fixed.toFixed(2)} → ${weak.adaptive.toFixed(2)})`);
});

test("dataset is reproducible with the seed", () => {
  const a = buildDataset({ learners: 5 }), b = buildDataset({ learners: 5 });
  assert.deepEqual(a.map((r) => r.y), b.map((r) => r.y));
});
