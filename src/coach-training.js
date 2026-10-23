// Offline training data for the AI coach, fully seeded (the same numbers every run):
// simulated learners with a hidden skill answer equations from all three levels; each row is one first attempt.
import { makeEquation, makeChoices } from "./equations.js";
import { LEVELS } from "./game.js";
import { mulberry32 } from "./rng.js";
import { features, simulateAttempt, trainLogReg, evaluate } from "./coach.js";

export const TRAINING = { learners: 300, perLearner: 40, testShare: 0.2, seed: 2026 };

const gauss = (rng) => Math.sqrt(-2 * Math.log(rng() + 1e-12)) * Math.cos(2 * Math.PI * rng());

export function buildDataset({ learners = TRAINING.learners, perLearner = TRAINING.perLearner, seed = TRAINING.seed } = {}) {
  const rng = mulberry32(seed), rows = [];
  for (let l = 0; l < learners; l++) {
    const skill = gauss(rng) * 0.8;
    for (let i = 0; i < perLearner; i++) {
      const level = 1 + Math.floor(rng() * 3);
      const eq = makeEquation(level, rng), ch = makeChoices(eq, LEVELS[level - 1].decoys, rng);
      const f = features(eq, ch);
      rows.push({ f, y: simulateAttempt(f, skill, rng), learner: l, kind: eq.kind, level });
    }
  }
  return rows;
}

/** Split by learner (no learner appears in both sets), train, evaluate. */
export function trainCoach(options = {}) {
  const rows = buildDataset(options);
  const cut = Math.floor((options.learners ?? TRAINING.learners) * (1 - TRAINING.testShare));
  const train = rows.filter((r) => r.learner < cut), test = rows.filter((r) => r.learner >= cut);
  const { w, history } = trainLogReg(train, { epochs: 400, lr: 0.6, l2: 0.001 });
  return { w, history, train: evaluate(w, train), test: evaluate(w, test), sizes: { rows: rows.length, train: train.length, test: test.length, learners: options.learners ?? TRAINING.learners } };
}
