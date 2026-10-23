// Equation generator. Every equation is built from a chosen whole-number x, so the answer is exact
// by construction, and `check(v)` lets tests verify that only the answer satisfies it.
import { randInt, pick, shuffle } from "./rng.js";

const fmt = (coef, sign, n) => `${coef}${sign} ${n}`;
const term = (a) => (a === 1 ? "x" : `${a}x`);

/** level 1: one-step, level 2: two-step, level 3: variable on both sides */
export function makeEquation(level, rng) {
  if (level <= 1) {
    const kind = pick(rng, ["add", "sub", "mul"]);
    const x = randInt(rng, 1, 12);
    if (kind === "add") { const a = randInt(rng, 1, 9); return build(`x + ${a} = ${x + a}`, x, (v) => v + a === x + a, { kind: "add", coef: 1 }); }
    if (kind === "sub") { const a = randInt(rng, 1, 9); return build(`x - ${a} = ${x - a}`, x, (v) => v - a === x - a, { kind: "sub", coef: 1 }); }
    const a = randInt(rng, 2, 9); return build(`${a}x = ${a * x}`, x, (v) => a * v === a * x, { kind: "mul", coef: a });
  }
  if (level === 2) {
    const a = randInt(rng, 2, 9), x = randInt(rng, 1, 12), b = randInt(rng, 1, 15);
    const plus = rng() < 0.5;
    const c = plus ? a * x + b : a * x - b;
    return build(`${a}x ${plus ? "+" : "-"} ${b} = ${c}`, x, (v) => (plus ? a * v + b : a * v - b) === c, { kind: plus ? "two_plus" : "two_minus", coef: a });
  }
  // level 3: a x + b = c x + d with a > c so the solution is the chosen x
  const x = randInt(rng, 1, 10), c = randInt(rng, 1, 5), a = c + randInt(rng, 1, 5), b = randInt(rng, -9, 9);
  const d = (a - c) * x + b;
  const side = (coef, k) => (k === 0 ? term(coef) : k > 0 ? `${term(coef)} + ${k}` : `${term(coef)} - ${-k}`);
  return build(`${side(a, b)} = ${side(c, d)}`, x, (v) => a * v + b === c * v + d, { kind: "both", coef: a, negConst: b < 0 || d < 0 });
}

// `kind`, `coef` and `negConst` describe the equation for the AI coach (src/coach.js); they use no randomness,
// so the same seed still produces exactly the same equations.
function build(text, answer, check, meta = {}) {
  return { text, answer, check, kind: meta.kind, coef: meta.coef ?? 1, negConst: !!meta.negConst };
}

/** The answer plus `decoys` distinct wrong numbers that look plausible. */
export function makeChoices(eq, decoys, rng) {
  const candidates = new Set();
  const a = eq.answer;
  const pool = [a + 1, a - 1, a + 2, a - 2, a + 3, a - 3, -a, a * 2, a + 10, a - 10, a + 5, a - 5];
  const shuffled = shuffle(rng, pool.filter((v) => v !== a && Number.isInteger(v)));
  for (const v of shuffled) { if (candidates.size >= decoys) break; if (!eq.check(v)) candidates.add(v); }
  let extra = a + 11;
  while (candidates.size < decoys) { if (!eq.check(extra)) candidates.add(extra); extra++; }
  return { answer: a, decoys: [...candidates] };
}
