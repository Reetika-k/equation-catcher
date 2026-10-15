# Vibe coding log – prompts used and what happened

The PDF asks for incremental prompts ("add a score counter", then "add three enemies") rather than "build me an amazing game". This log records the instructions given to the AI coding assistant (Claude Code) for each step, what it produced, what was tested, and what broke. Entries are appended as the project progresses.

## Step 1 – Concept

**Prompt:** "Write a one-page game concept for the Vibe Coding Challenge: name, target player, objective, controls, scoring, win, lose, levels. Pick something small that can be finished reliably, that can be tested automatically, and that connects to my first capstone project (an algebra tutor)."

**Result:** `docs/CONCEPT.md` – *Equation Catcher*: catch the falling number that solves the equation; three levels (one-step, two-step, both sides), lives, timer, bombs in level 3. Combines the PDF's "Catch the Falling Objects" and "Math Adventure Game" ideas.

## Step 2 – First prototype (logic first)

**Prompt:** "Build the game logic as a pure module with no DOM: a seeded random generator, an equation generator whose answers are correct by construction, and `createGame()` with `update(dt, input)` that moves the basket, spawns falling numbers, detects catches, scores, and emits events. Add node:test tests before any drawing."

**Result:** `src/rng.js`, `src/equations.js`, `src/game.js`, `tests/game.test.mjs` (11 tests: equations are solvable and decoys never are, level forms, seeding, movement clamps, scoring, lives, timer, level-up and win, guaranteed correct spawn, missed objects).

**What broke:** `npm test` ran `node --test tests/` and reported one failing item called "tests": Node 25 did not expand the directory into test files. Fix: name the file explicitly (`node --test tests/game.test.mjs`). All 11 tests then passed.

## Step 3 – Run and test the first version (canvas, controls, screens)

**Prompt:** "Now add the browser layer: `index.html` with a canvas, HUD, start / level-up / game-over / paused overlays and touch buttons; `render.js` that only draws; `audio.js` with Web Audio sounds and a mute button; `main.js` with keyboard, drag and button input, the game loop, particles, screen shake, floating '+10', and a high score in localStorage. Keep numbers identical whether they are correct or not so the player has to solve the equation."

**Result:** playable prototype at `npm start` (http://localhost:8080). A `?seed=` query parameter makes runs reproducible.

**What broke:** the files were written into the wrong folder (the tutor's) because the shell's working directory had changed between two parallel commands; the tutor's `package.json` test script was overwritten with the game's. Fixed by moving the five files and restoring both scripts; both test suites re-run (11/11 game, 32/32 tutor). Lesson: use absolute paths in scripted edits.

**Testing:** `tests/e2e-browser.mjs` drives the real page in headless Chrome (DevTools Protocol): start screen, canvas content, key controls, auto-play to clear level 1, level-up and level 2, pause/resume, mute persistence, loss by time and by lives, restart, high score after reload, phone layout. Results in `docs/TESTING.md`.

## Step 4–10 – Visuals, obstacles, lives, levels, timer, screens, sound

These were built together in the prototype step above because the logic module already modelled them; the prompts were feature-by-feature all the same: "add bombs to level 3 that cost a life", "add a countdown timer with a red pulse under 10 seconds", "add particles and screen shake on a catch or a wrong catch", "add a level-up screen showing the time bonus and what the next level brings", "synthesise sounds with the Web Audio API and remember the mute choice".

## Step 11 – Test the game

**Prompt:** "Write a browser play test that opens the page with a fixed seed, checks the start screen, presses the keys, auto-plays Level 1 by moving the basket under the correct number, then checks level-up, pause, mute, both loss conditions, restart, the saved high score and the phone layout. Save screenshots."

**Result:** `tests/e2e-browser.mjs`. Run 1: 17/18 (one timing race in the test, see `docs/TESTING.md` F3). Run 2: 18/18.

**Debugging prompt that fixed F3:** "Scenario 8 fails only sometimes: the state says level 2 but the HUD still says Level 1. Where is the HUD updated?" → in the animation-frame loop; the test now waits for the label instead of reading it immediately.

## Step 4 (revisited) – UI/UX redesign

**Prompt:** "Act as a senior UI/UX designer and design this game." (with a desktop screenshot of the first version)

**What the audit found:** a phone-sized column in a 2000 px wide void, orphaned mute/pause buttons, a game-over that was text over a blur with no card, no answer shown on game over, a timer that was a bare number, generic typography.

**Result:** `docs/DESIGN.md` (audit, principles, tokens, layouts, components, states, accessibility) and a presentation-only rewrite: `index.html` (responsive game shell: help · play · live stats on desktop; compact column on phones), `style.css` (design tokens, Fredoka/Nunito, modal cards, timer ring, touch controls, reduced motion), `src/render.js` (sun, hills, gradient bubbles, woven basket with tilt), `src/main.js` (progress bar, timer ring colours, hearts that pop, accuracy and "the answer was x = N" on game over, Main menu). `game.js` gained only a `menu()` helper; all 11 logic tests unchanged and passing.

**What broke:** the browser play test failed its first check because it expected the start card's heading to be the game title; the title now lives in the header and the card says "Ready?". The expectation was updated (the brand title is checked instead). Run 3 on the redesign: 17/18 for that reason; the final run after the fix is recorded in `docs/TESTING.md`. One visual inconsistency was caught from the screenshots: the timer ring reset to 60 on the game-over screen instead of freezing at the final value; fixed in `updateHud()`.
