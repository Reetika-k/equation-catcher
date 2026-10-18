#!/usr/bin/env node
// Build reports/dashboard.html for Equation Catcher from the game's own code and recorded files:
//   src/game.js, src/equations.js, src/rng.js   level design, a seeded audit of the equation generator,
//                                               and a difficulty measurement with scripted players
//   tests/results/unit-latest.tap               the latest logic-test run (node --test --test-reporter=tap)
//   docs/TESTING.md                             the recorded browser play-test table and the findings
//   docs/screenshots/*.png                      a few screens, embedded
// No dependencies, no network. The simulations are seeded, so every number here is reproducible.
// Usage: npm run dashboard   (writes reports/dashboard.html, self-contained)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createGame, LEVELS, START_LIVES, POINTS_PER_CATCH } from "../src/game.js";
import { makeEquation, makeChoices } from "../src/equations.js";
import { mulberry32 } from "../src/rng.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const p = (...parts) => path.join(root, ...parts);
const exists = (f) => fs.existsSync(f);
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pct = (x) => `${Math.round(100 * x)} %`;

// ---------- 1. equation generator audit (seeded) ----------

const N_EQ = 5000;
function auditLevel(level) {
  const decoys = LEVELS[level - 1].decoys;
  const out = { level, n: N_EQ, answerOk: 0, decoySolves: 0, duplicateChoice: 0, answers: {}, forms: {}, distances: {} };
  for (let seed = 1; seed <= N_EQ; seed++) {
    const rng = mulberry32(level * 100000 + seed);
    const eq = makeEquation(level, rng);
    const ch = makeChoices(eq, decoys, rng);
    if (eq.check(eq.answer)) out.answerOk++;
    if (ch.decoys.some((d) => eq.check(d))) out.decoySolves++;
    if (new Set([ch.answer, ...ch.decoys]).size !== decoys + 1) out.duplicateChoice++;
    out.answers[eq.answer] = (out.answers[eq.answer] || 0) + 1;
    const form = level === 1 ? (/^x \+/.test(eq.text) ? "x + a = b" : /^x -/.test(eq.text) ? "x − a = b" : "ax = b") : level === 2 ? (/\+/.test(eq.text) ? "ax + b = c" : "ax − b = c") : (/^\d*x [+-]/.test(eq.text) ? "ax ± b = cx ± d" : "ax = cx ± d");
    out.forms[form] = (out.forms[form] || 0) + 1;
    for (const d of ch.decoys) { const k = Math.abs(d - eq.answer); out.distances[k] = (out.distances[k] || 0) + 1; }
  }
  return out;
}
const audit = LEVELS.map((l) => auditLevel(l.level));

// ---------- 2. difficulty by scripted players (seeded) ----------

const GAMES = 200, DT = 1 / 60, W = 480, H = 640;
// The tracker: wait in the safest reachable spot, step under the correct number only when it is
// about to arrive, and keep clear of every decoy or bomb that would land in the basket first.
function trackerInput(state) {
  const b = state.basket;
  const basketTop = b.y - b.h / 2;
  const speed = b.speed * 1.5; // the game moves a targeted basket at 1.5× keyboard speed
  const arrival = (o) => Math.max(0, (basketTop - (o.y + o.r)) / o.vy);
  const catchHalf = (o) => b.w / 2 + o.r * 0.5;
  const correct = state.objects.filter((o) => o.kind === "correct").sort((a, c) => arrival(a) - arrival(c))[0];
  const threats = state.objects.filter((o) => o.kind !== "correct");
  if (correct) {
    const travel = Math.abs(correct.x - b.x) / speed;
    const blockedBefore = threats.some((t) => arrival(t) < arrival(correct) && Math.abs(t.x - correct.x) < catchHalf(t) + 6);
    if (arrival(correct) - travel < 0.45 && !blockedBefore) return { targetX: correct.x }; // commit
  }
  // otherwise hold the position with the largest margin from anything arriving soon, near where we want to be
  const want = correct ? correct.x : W / 2;
  let best = { x: b.x, score: -Infinity };
  for (let x = b.w / 2; x <= W - b.w / 2; x += 8) {
    let margin = Infinity;
    for (const t of threats) if (arrival(t) < 1.3) margin = Math.min(margin, Math.abs(t.x - x) - catchHalf(t));
    const score = Math.min(margin, 60) - Math.abs(x - want) / 60 - Math.abs(x - b.x) / 200;
    if (score > best.score) best = { x, score };
  }
  return { targetX: best.x };
}
function randomInput(state, rng, memo) {
  if (memo.t <= 0) { memo.x = b0(rng); memo.t = 0.5; }
  memo.t -= DT;
  return { targetX: memo.x };
  function b0(r) { return state.basket.w / 2 + r() * (W - state.basket.w); }
}
function simulate(strategy) {
  const per = LEVELS.map(() => ({ reached: 0, cleared: 0, time: 0, livesLost: 0 }));
  const summary = { won: 0, lostLives: 0, lostTime: 0, scores: [] };
  for (let seed = 1; seed <= GAMES; seed++) {
    const rng = mulberry32(7000 + seed);
    const g = createGame({ width: W, height: H, rng });
    g.start();
    const memo = { t: 0, x: W / 2 };
    let level = g.state.level, levelStart = 0, livesAtLevel = g.state.lives, guard = 0;
    per[level - 1].reached++;
    while (g.state.screen === "playing" && guard++ < 60 * 60 * 4) {
      g.update(DT, strategy === "tracker" ? trackerInput(g.state) : randomInput(g.state, rng, memo));
      g.drainEvents();
      if (g.state.screen === "levelup") {
        const idx = level - 1;
        per[idx].cleared++; per[idx].time += g.state.elapsed - levelStart; per[idx].livesLost += livesAtLevel - g.state.lives;
        g.nextLevel();
        if (g.state.screen === "playing") { level = g.state.level; levelStart = g.state.elapsed; livesAtLevel = g.state.lives; per[level - 1].reached++; }
      }
    }
    if (g.state.screen === "won") summary.won++;
    else if (g.state.lostReason === "lives") { summary.lostLives++; per[level - 1].livesLost += livesAtLevel - g.state.lives; }
    else if (g.state.lostReason === "time") { summary.lostTime++; per[level - 1].livesLost += livesAtLevel - g.state.lives; }
    summary.scores.push(g.state.score);
  }
  summary.meanScore = summary.scores.reduce((a, b) => a + b, 0) / GAMES;
  summary.per = per.map((x) => ({ reached: x.reached, clearRate: x.reached ? x.cleared / x.reached : 0, meanTime: x.cleared ? x.time / x.cleared : null, livesLostPerGame: x.reached ? x.livesLost / x.reached : 0 }));
  return summary;
}
const sims = { tracker: simulate("tracker"), random: simulate("random") };

// ---------- 3. recorded files ----------

const tapPath = p("tests/results/unit-latest.tap");
let unit = null;
if (exists(tapPath)) {
  const tap = fs.readFileSync(tapPath, "utf8");
  const num = (k) => Number((tap.match(new RegExp(`^# ${k} (\\S+)`, "m")) || [])[1] || 0);
  unit = { tests: num("tests"), pass: num("pass"), fail: num("fail"), ms: Math.round(num("duration_ms")), names: [...tap.matchAll(/^ok \d+ - (.+)$/gm)].map((m) => m[1]), when: fs.statSync(tapPath).mtime.toISOString().slice(0, 16).replace("T", " ") };
}
const testingMd = exists(p("docs/TESTING.md")) ? fs.readFileSync(p("docs/TESTING.md"), "utf8") : "";
const playRows = [...testingMd.matchAll(/^\| (\d+) \| ([^|]+)\| ([^|]+)\| ([^|]+)\| (Pass|Fail) \|$/gm)].map((m) => ({ n: m[1], action: m[2].trim(), expected: m[3].trim(), actual: m[4].trim(), status: m[5] }));
const playRuns = [...testingMd.matchAll(/\*\*(run \d|Run \d)[^*]*?(\d+ \/ \d+)\*\*/gi)].map((m) => `${m[1]}: ${m[2]}`);
const findings = [...testingMd.matchAll(/^\| (F\d+) \| ([^|]+)\|([^\n]*)$/gm)].map((m) => { const cells = m[3].split("|").map((c) => c.trim()).filter(Boolean); return { id: m[1], problem: m[2].trim(), type: cells[cells.length - 1] || "" }; });
const shots = ["02-playing.png", "03-levelup.png", "04-gameover.png", "07-phone-start.png"].filter((f) => exists(p("docs/screenshots", f)));
const img = (f) => `<img src="data:image/png;base64,${fs.readFileSync(p("docs/screenshots", f)).toString("base64")}" alt="${esc(f)}">`;

// ---------- tiny SVG charts ----------

function bars(items, { height = 170, barW = 44, gap = 18, max = 1, fmt = (v) => v, colours = () => "#36e4ff" } = {}) {
  const w = items.length * (barW + gap) + gap, top = 26, bottom = 46, h = height - top - bottom;
  const rects = items.map((it, i) => {
    const x = gap + i * (barW + gap), bh = Math.max(1, Math.round((it.value / max) * h)), y = top + h - bh;
    return `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="5" fill="${colours(it)}"/><text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" font-size="11" fill="#e8eeff">${esc(fmt(it.value, it))}</text><text x="${x + barW / 2}" y="${top + h + 16}" text-anchor="middle" font-size="10" fill="#8a94b8">${esc(it.label)}</text>${it.sub ? `<text x="${x + barW / 2}" y="${top + h + 30}" text-anchor="middle" font-size="9" fill="#8a94b8">${esc(it.sub)}</text>` : ""}`;
  });
  return `<svg viewBox="0 0 ${w} ${height}" width="${w}" height="${height}" role="img"><rect width="${w}" height="${height}" fill="#1a2240" rx="10"/>${rects.join("")}</svg>`;
}
const table = (head, rows) => `<div class="scroll"><table><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</table></div>`;
const colourOf = { 1: "#18e0aa", 2: "#36e4ff", 3: "#ff385c" };

// ---------- sections ----------

const parts = [];
const stamp = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
parts.push(`<h1>Equation Catcher — Game dashboard</h1><p class="sub">Level design, a seeded audit of the equation generator, a measured difficulty curve with scripted players, the logic tests and the recorded browser play test. Generated ${stamp}; every figure is computed from the game's own code with fixed seeds or read from recorded files.</p>`);

const totalEq = audit.reduce((s, a) => s + a.n, 0);
parts.push(`<div class="grid">${[
  ["levels", LEVELS.length], ["equations audited", totalEq.toLocaleString()], ["stated answers correct", pct(audit.reduce((s, a) => s + a.answerOk, 0) / totalEq)], ["decoys that solve the equation", audit.reduce((s, a) => s + a.decoySolves, 0)],
  ["logic tests", unit ? `${unit.pass}/${unit.tests}` : "not run"], ["scripted tracker wins", pct(sims.tracker.won / GAMES)],
].map(([k, v]) => `<div class="card stat"><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join("")}</div>`);

// 1 level design
parts.push(`<h2>1. Level design</h2><p>From <code>src/game.js</code>. Points per catch are ${POINTS_PER_CATCH} × level; the seconds left at the end of a level are added as a bonus; ${START_LIVES} lives for the whole game.</p>`
  + table(["level", "equations", "catches to clear", "fall speed (px/s)", "spawn every (s)", "decoys per equation", "bomb chance", "time (s)", "points per catch"], LEVELS.map((l) => [l.level, esc(l.name), l.needed, l.fallSpeed, l.spawnEvery, l.decoys, pct(l.bombChance), l.time, POINTS_PER_CATCH * l.level]))
  + `<div class="row">${bars(LEVELS.map((l) => ({ label: `L${l.level}`, value: l.fallSpeed })), { max: 200, fmt: (v) => `${v} px/s`, colours: (it) => colourOf[it.label[1]] })}${bars(LEVELS.map((l) => ({ label: `L${l.level}`, value: 1 / l.spawnEvery })), { max: 1.4, fmt: (v) => `${v.toFixed(2)}/s`, colours: (it) => colourOf[it.label[1]] })}${bars(LEVELS.map((l) => ({ label: `L${l.level}`, value: l.needed })), { max: 8, fmt: (v) => `${v} catches`, colours: (it) => colourOf[it.label[1]] })}</div><p class="muted">Fall speed · spawns per second · catches needed.</p>`);

// 2 generator audit
parts.push(`<h2>2. Equation generator audit (${N_EQ.toLocaleString()} seeded equations per level)</h2><p>Every equation is built from a chosen whole-number answer, so correctness is by construction; the audit checks it anyway, together with the decoys, which must never solve the equation and must be distinct.</p>`
  + table(["level", "equations", "stated answer solves it", "decoys that solve it", "duplicate choices", "forms seen", "answer range"], audit.map((a) => [a.level, a.n.toLocaleString(), `${a.answerOk} (${pct(a.answerOk / a.n)})`, a.decoySolves, a.duplicateChoice, Object.entries(a.forms).map(([k, v]) => `${esc(k)} ${pct(v / a.n)}`).join("<br>"), `${Math.min(...Object.keys(a.answers).map(Number))}–${Math.max(...Object.keys(a.answers).map(Number))}`])));
const distKeys = [...new Set(audit.flatMap((a) => Object.keys(a.distances).map(Number)))].sort((x, y) => x - y).slice(0, 12);
parts.push(`<p><b>How far decoys sit from the answer</b> (|decoy − answer|, share of all decoys per level). Close decoys (1 or 2 away) are the ones a hurried player confuses.</p><div class="row">${audit.map((a) => { const tot = Object.values(a.distances).reduce((s, v) => s + v, 0); return bars(distKeys.map((k) => ({ label: String(k), value: (a.distances[k] || 0) / tot })), { max: 0.4, barW: 26, gap: 8, fmt: (v) => (v >= 0.02 ? pct(v) : ""), colours: () => colourOf[a.level] }); }).join("")}</div><p class="muted">Left to right: levels 1, 2, 3; x-axis = distance from the correct answer.</p>`);

// 3 difficulty
parts.push(`<h2>3. Difficulty, measured with scripted players (${GAMES} seeded games each)</h2><p>Two scripted players play the real game logic at 60 updates per second. The <b>tracker</b> always moves toward the lowest correct number and sidesteps the nearest threat when none is on screen; the <b>random mover</b> picks a new target every half second. Neither is a human; the tracker is an upper bound on what the level parameters allow, the random mover a floor.</p>`
  + table(["player", "games won", "lost on lives", "lost on time", "mean final score", ...LEVELS.map((l) => `L${l.level} clear rate`), ...LEVELS.map((l) => `L${l.level} mean time to clear`), ...LEVELS.map((l) => `L${l.level} lives lost per game`)], Object.entries(sims).map(([name, s]) => [esc(name), `${s.won} (${pct(s.won / GAMES)})`, s.lostLives, s.lostTime, Math.round(s.meanScore), ...s.per.map((x) => (x.reached ? `${pct(x.clearRate)} <span class="muted">of ${x.reached}</span>` : "—")), ...s.per.map((x) => (x.meanTime != null ? `${x.meanTime.toFixed(1)} s` : "—")), ...s.per.map((x) => (x.reached ? x.livesLostPerGame.toFixed(2) : "—"))]))
  + `<div class="row">${bars(LEVELS.map((l, i) => ({ label: `L${l.level}`, value: sims.tracker.per[i].clearRate })), { max: 1, fmt: (v) => pct(v), colours: (it) => colourOf[it.label[1]] })}${bars(LEVELS.map((l, i) => ({ label: `L${l.level}`, value: sims.tracker.per[i].meanTime || 0 })), { max: 60, fmt: (v) => (v ? `${v.toFixed(0)} s` : "—"), colours: (it) => colourOf[it.label[1]] })}${bars(LEVELS.map((l, i) => ({ label: `L${l.level}`, value: sims.tracker.per[i].livesLostPerGame })), { max: 3, fmt: (v) => v.toFixed(2), colours: (it) => colourOf[it.label[1]] })}</div><p class="muted">Tracker: clear rate · mean time to clear a level · lives lost per game, by level. Read the gaps between levels as the difficulty curve; the absolute values belong to a script, not a person.</p>`);

// 4 logic tests
parts.push(`<h2>4. Logic tests (no browser)</h2>`);
parts.push(unit ? `<div class="card"><b>${unit.pass} of ${unit.tests} passed</b>, ${unit.fail} failed, ${unit.ms} ms, run ${esc(unit.when)} (<code>tests/results/unit-latest.tap</code>; regenerate with <code>npm run test:tap</code>).</div><ul>${unit.names.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : `<p class="muted">No logic-test record: run <code>npm run test:tap</code>.</p>`);

// 5 browser play test (recorded)
parts.push(`<h2>5. Browser play test (recorded in docs/TESTING.md)</h2>`);
if (playRows.length) {
  parts.push(`<p>Headless Chrome drives the real page with a seeded game (<code>?seed=7</code>). Recorded outcomes: ${playRuns.length ? esc(playRuns.join(" · ")) : "see docs/TESTING.md"}. The table is the recorded run as written in <code>docs/TESTING.md</code>; this dashboard does not launch a browser.</p>`
    + table(["#", "user action", "expected", "actual (recorded)", "status"], playRows.map((r) => [r.n, esc(r.action), esc(r.expected), esc(r.actual), r.status === "Pass" ? `<span class="ok">Pass</span>` : `<span class="bad">Fail</span>`])));
} else parts.push(`<p class="muted">docs/TESTING.md not found or has no play-test table.</p>`);

// 6 findings
parts.push(`<h2>6. Findings and fixes recorded during testing</h2>`);
parts.push(findings.length ? table(["id", "problem (as recorded)", "type"], findings.map((f) => [`<b>${esc(f.id)}</b>`, esc(f.problem), esc(f.type)])) : `<p class="muted">none recorded</p>`);

// 7 screens
parts.push(`<h2>7. Screens</h2>${shots.length ? shots.map(img).join("") : `<p class="muted">No screenshots found.</p>`}`);

// 8 limitations
parts.push(`<h2>8. Limitations</h2><div class="card"><ul>
<li>The difficulty figures come from scripted players, not people; a human play-testing session (the brief's step 11) is still to be recorded.</li>
<li>The browser play test is quoted from its recorded run; sound is verified only by the mute toggle.</li>
<li>Decoy "closeness" is measured, not its effect on real players.</li>
</ul></div>`);
parts.push(`<h2>Reproduce</h2><div class="card"><code>npm test</code> → <code>npm run test:tap</code> (records the logic run) → <code>npm run dashboard</code> (seeded audit and simulations run inside the build, about 5 s). This file embeds its figures and screenshots.</div>`);

// ---------- write ----------

const css = `
body{margin:0;background:#0f1428;color:#e8eeff;font:15px/1.55 -apple-system,'Segoe UI',Helvetica,Arial,sans-serif}
main{max-width:1080px;margin:0 auto;padding:32px 20px 60px}
h1{font-size:30px;margin:0 0 4px}h2{font-size:21px;margin:40px 0 10px;border-bottom:1px solid #2e3860;padding-bottom:6px}
.sub{color:#8a94b8;margin:0 0 18px}.card{background:#1a2240;border:1px solid #2e3860;border-radius:12px;padding:16px 18px;margin:12px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.stat b{display:block;font-size:22px}
.stat span{color:#8a94b8;font-size:12px;text-transform:uppercase;letter-spacing:.06em}
.row{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start}
img{max-width:100%;height:auto;border-radius:10px;border:1px solid #2e3860;margin:8px 0}svg{max-width:100%;height:auto;margin:8px 0}
.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:13.5px}th,td{text-align:left;padding:7px 8px;border-bottom:1px solid #2e3860;vertical-align:top}
th{color:#8a94b8;font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.06em}
.ok{color:#18e0aa;font-weight:700}.bad{color:#ff385c;font-weight:700}.muted{color:#8a94b8}
code{background:#0b1020;padding:2px 6px;border-radius:6px;font-size:13px}
`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Equation Catcher — Game dashboard</title><style>${css}</style></head><body><main>${parts.join("")}</main></body></html>`;
fs.mkdirSync(p("reports"), { recursive: true });
fs.writeFileSync(p("reports/dashboard.html"), html);
console.log(`dashboard: reports/dashboard.html (${(html.length / 1e6).toFixed(2)} MB) · tracker wins ${sims.tracker.won}/${GAMES}, random wins ${sims.random.won}/${GAMES} · logic ${unit ? `${unit.pass}/${unit.tests}` : "none"} · play rows ${playRows.length} · findings ${findings.length}`);
console.log("tracker per level:", JSON.stringify(sims.tracker.per.map((x) => ({ clear: +x.clearRate.toFixed(2), time: x.meanTime && +x.meanTime.toFixed(1), lives: +x.livesLostPerGame.toFixed(2) }))));
console.log("random per level:", JSON.stringify(sims.random.per.map((x) => ({ clear: +x.clearRate.toFixed(2), time: x.meanTime && +x.meanTime.toFixed(1), lives: +x.livesLostPerGame.toFixed(2) }))));
