// The AI coach: a logistic-regression model that predicts the chance a player solves an equation on the
// first try, learns from every first attempt, and picks the next equation so the predicted chance stays
// near a target (70 %: hard enough to learn from, easy enough to keep going). Pure logic, no DOM.
//
//   features(eq, choices)  → 10 numbers describing the equation (its form, answer size, coefficient,
//                            whether a decoy is only 1 away, negative constants)
//   trainLogReg(rows)      → weights learned by gradient descent with L2 regularisation (offline training)
//   createCoach(prior)     → a player's own model: starts from the trained weights, then learns online
//   chooseEquation(...)    → among a few candidate equations, the one closest to the target chance
//
// Offline training data comes from SIMULATED learners (simulateAttempt): each has a hidden skill and a
// known "true" difficulty per feature, so the dashboard can check what the model recovers. Real players
// then personalise the model through online updates while they play.

export const KINDS = ["add", "sub", "mul", "two_plus", "two_minus", "both"];
export const KIND_LABEL = { add: "x + a = b", sub: "x − a = b", mul: "ax = b", two_plus: "ax + b = c", two_minus: "ax − b = c", both: "x on both sides" };
export const FEATURE_NAMES = [...KINDS.map((k) => `form: ${KIND_LABEL[k]}`), "answer size", "coefficient size", "decoy 1 away", "negative constant"];
export const TARGET = 0.7;

const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const dot = (w, f) => { let s = 0; for (let i = 0; i < f.length; i++) s += w[i] * f[i]; return s; };

/** Feature vector of an equation and its choices (the six form indicators act as per-form intercepts). */
export function features(eq, choices) {
  const f = KINDS.map((k) => (eq.kind === k ? 1 : 0));
  f.push(Math.min(1, Math.abs(eq.answer) / 12));
  f.push(Math.min(1, ((eq.coef ?? 1) - 1) / 8));
  f.push(choices && choices.decoys.some((d) => Math.abs(d - eq.answer) === 1) ? 1 : 0);
  f.push(eq.negConst ? 1 : 0);
  return f;
}

/** Hidden "ground truth" used only to simulate learners for offline training and evaluation. */
export const TRUE_WEIGHTS = [2.2, 1.4, 1.2, 0.6, 0.1, -0.4, -0.9, -0.6, -0.8, -0.5];
export function simulateAttempt(f, skill, rng) { return rng() < sigmoid(skill + dot(TRUE_WEIGHTS, f)) ? 1 : 0; }

/** Batch gradient descent on the log loss with L2 regularisation. rows: [{ f, y }] */
export function trainLogReg(rows, { epochs = 300, lr = 0.5, l2 = 0.001, onEpoch } = {}) {
  const n = rows.length, d = rows[0].f.length, w = new Array(d).fill(0), history = [];
  for (let e = 0; e < epochs; e++) {
    const g = new Array(d).fill(0); let loss = 0;
    for (const { f, y } of rows) {
      const p = sigmoid(dot(w, f));
      loss += -(y * Math.log(p + 1e-12) + (1 - y) * Math.log(1 - p + 1e-12));
      for (let i = 0; i < d; i++) g[i] += (p - y) * f[i];
    }
    for (let i = 0; i < d; i++) w[i] -= lr * (g[i] / n + l2 * w[i]);
    history.push(loss / n);
    onEpoch?.(e, loss / n);
  }
  return { w, history };
}

export function evaluate(w, rows) {
  let correct = 0, loss = 0, pos = 0;
  const bins = Array.from({ length: 5 }, () => ({ n: 0, p: 0, y: 0 }));
  for (const { f, y } of rows) {
    const p = sigmoid(dot(w, f));
    if ((p >= 0.5 ? 1 : 0) === y) correct++;
    loss += -(y * Math.log(p + 1e-12) + (1 - y) * Math.log(1 - p + 1e-12));
    pos += y;
    const b = bins[Math.min(4, Math.floor(p * 5))]; b.n++; b.p += p; b.y += y;
  }
  const n = rows.length, base = pos / n;
  const baseLoss = -(base * Math.log(base) + (1 - base) * Math.log(1 - base));
  return { n, accuracy: correct / n, logLoss: loss / n, baselineAccuracy: Math.max(base, 1 - base), baselineLogLoss: baseLoss,
    calibration: bins.map((b, i) => ({ range: `${i * 20}–${i * 20 + 20} %`, n: b.n, predicted: b.n ? b.p / b.n : null, actual: b.n ? b.y / b.n : null })) };
}

/**
 * A player's coach. prior: { w } from offline training. saved: a previous toJSON() (personal learning).
 * Online learning after each first attempt: a personal skill offset (fast) and the weights (slow).
 */
export function createCoach({ prior, saved = null, skillRate = 0.35, weightRate = 0.05 } = {}) {
  const coach = {
    w: saved?.w?.length === prior.w.length ? [...saved.w] : [...prior.w],
    skill: saved?.skill ?? 0,
    attempts: saved?.attempts ?? 0,
    solved: saved?.solved ?? 0,
    byKind: saved?.byKind ?? Object.fromEntries(KINDS.map((k) => [k, { n: 0, y: 0 }])),
    predict(f) { return sigmoid(coach.skill + dot(coach.w, f)); },
    update(f, y, kind) {
      const err = y - coach.predict(f);
      coach.skill += skillRate * err;
      for (let i = 0; i < f.length; i++) coach.w[i] += weightRate * err * f[i];
      coach.attempts++; coach.solved += y;
      if (kind && coach.byKind[kind]) { coach.byKind[kind].n++; coach.byKind[kind].y += y; }
      return err;
    },
    /** Predicted first-try chance per equation form for a typical equation of that form. */
    perKind() {
      return KINDS.map((k) => {
        const f = KINDS.map((x) => (x === k ? 1 : 0)).concat([0.5, k === "add" || k === "sub" ? 0 : 0.4, 0.5, k === "both" ? 0.5 : 0]);
        return { kind: k, label: KIND_LABEL[k], chance: coach.predict(f), seen: coach.byKind[k].n };
      });
    },
    /** Hardest and easiest forms among those this player has actually met. */
    insight() {
      const seen = coach.perKind().filter((x) => x.seen > 0).sort((a, b) => a.chance - b.chance);
      return seen.length ? { hardest: seen[0], easiest: seen[seen.length - 1], attempts: coach.attempts } : null;
    },
    toJSON() { return { w: coach.w, skill: coach.skill, attempts: coach.attempts, solved: coach.solved, byKind: coach.byKind }; },
  };
  return coach;
}

/** Index of the candidate whose predicted chance is closest to the target. candidates: [{ f }] */
export function chooseEquation(candidates, coach, target = TARGET) {
  let best = 0, bestGap = Infinity;
  candidates.forEach((c, i) => { const gap = Math.abs(coach.predict(c.f) - target); if (gap < bestGap) { bestGap = gap; best = i; } });
  return best;
}
