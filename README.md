# Equation Catcher

> **Play online:** https://reetika-k.github.io/equation-catcher/ · **Game dashboard:** https://reetika-k.github.io/equation-catcher/reports/dashboard.html · **Repository:** https://github.com/Reetika-k/equation-catcher

**Vibe Coding Challenge capstone – a browser game built and hosted with HTML, CSS and JavaScript.**
IIT Patna AI/ML capstone, Project 2: *Vibe Coding Challenge: Build and Host Your Own Online Video Game*.

An equation such as `2x + 5 = 17` appears at the top. Numbers fall from the sky. Move the basket to catch the number that solves it. Wrong numbers and bombs cost lives; the timer keeps you honest; three levels of increasing difficulty end in a win screen.

An **AI coach** (a logistic-regression model, trained offline and still learning while you play) predicts your chance of solving each equation on the first try, learns from every first attempt, and picks the next equation so that chance stays near 70 %. At game over it tells you which equation form is hardest for you.

## How to play

| Action | Keyboard | Mouse / touch |
|---|---|---|
| Move basket | `←` `→` or `A` `D` | Drag on the game, or hold ◀ ▶ |
| Start / next level / play again | `Enter` or `Space` | Buttons on screen |
| Pause | `P` | ⏸ button |
| Mute | `M` | 🔊 button |

- Correct catch: **+10 × level**. At the end of a level, the seconds left are added as a bonus.
- Wrong number or 💣: **−1 life** (3 lives). Timer: **60 s per level**.
- Level 1: one-step equations, 5 catches. Level 2: two-step, faster, 6 catches. Level 3: variable on both sides, fastest, bombs, 7 catches. Clear Level 3 to win.
- Best score is saved in your browser.

## Run locally

```bash
git clone git@github.com:Reetika-k/equation-catcher.git   # or https://github.com/Reetika-k/equation-catcher.git
cd equation-catcher
npm start          # http://localhost:8080  (a tiny static server; ES modules need http://, not file://)
```

No dependencies, no build step. Python works too: `python3 -m http.server 8080`.

## Tests

```bash
npm test                     # 20 logic tests (node:test): game rules and the AI coach, no browser needed
node tests/e2e-browser.mjs   # browser play test; needs Chrome with --headless=new --remote-debugging-port=9334 --remote-allow-origins=*
```

The browser test starts a game with `?seed=7`, presses the keys, auto-plays level 1, checks level-up, pause, mute, both loss conditions, restart, the saved high score and the phone layout, and saves screenshots to `docs/screenshots/`. Results and the bugs found are in [docs/TESTING.md](docs/TESTING.md).

## AI coach (machine learning)

- **Model:** logistic regression on 10 features of an equation: its form (x + a, x − a, ax, ax + b, ax − b, x on both sides), answer size, coefficient size, a decoy only 1 away, negative constants (`src/coach.js`).
- **Offline training:** `npm run train` generates 12,000 first attempts from 300 simulated learners (seeded), trains by gradient descent with L2 regularisation on 240 learners and tests on 60 learners it never saw: **72 % accuracy vs 62 % for the majority baseline**, log loss 0.557 vs 0.665. It recovers the true difficulty order of the six forms. The weights are written to `src/coach-prior.js`.
- **Online learning:** in the game, each first attempt updates a personal skill offset and the weights; the model is saved in the browser (Reset on the start screen).
- **Adaptation:** each new equation is chosen from 5 fresh candidates of the current level, the one whose predicted chance is closest to 70 %. In simulation it moves weak, average and strong learners closer to that target (see the dashboard). It can be switched off on the start screen.
- **Honest limit:** the training data is simulated; accuracy on real players is not measured yet.

## Game dashboard

[`reports/dashboard.html`](reports/dashboard.html) is a self-contained page built from the game's own code and recorded files: the level design table, a seeded audit of 15,000 generated equations (stated answers always solve them, decoys never do), a difficulty curve measured with two scripted players over 200 seeded games each, how the AI coach was trained (loss curve, test accuracy, learned vs true weights, calibration) and how much adapting helps, the logic-test run, the recorded browser play test, the findings table and screenshots. Nothing in it is estimated.

```bash
npm run train        # trains the AI coach (about 1 s), writes src/coach-prior.js
npm run test:tap     # records the logic-test run to tests/results/unit-latest.tap
npm run dashboard    # rebuilds reports/dashboard.html (about 1 s; no dependencies)
```

Live: https://reetika-k.github.io/equation-catcher/reports/dashboard.html

## Design

A UI/UX pass after the first playable version turned the phone-sized column into a responsive game shell (help · play area · live stats on desktop, a compact single column on phones), modal cards for every screen with the missed answer and accuracy on game over, a timer ring, a Fredoka/Nunito type system and reduced-motion support. The audit, tokens, layouts, components and states are in [docs/DESIGN.md](docs/DESIGN.md); before/after screenshots in `docs/screenshots/`.

## Project structure

```
index.html        screens, HUD, canvas, touch controls      style.css      visual design
src/game.js       pure game logic (no DOM): levels, spawning, catches, lives, timer, events
src/equations.js  equation generator (answers correct by construction) + decoys
src/rng.js        seedable random numbers (reproducible tests)
src/coach.js      AI coach: features, logistic regression, online learning, adaptive choice
src/coach-training.js · src/coach-prior.js   simulated training data · trained weights (npm run train)
src/render.js     canvas drawing only                        src/audio.js   Web Audio sounds + mute
src/main.js       input, game loop, effects, high score, screens
tests/            game.test.mjs (logic) · coach.test.mjs (AI coach) · e2e-browser.mjs (play test)
docs/             CONCEPT · VIBE_CODING (prompts) · TESTING · CAPSTONE_DOCUMENTATION · DEMO_SCRIPT · DEPLOYMENT · screenshots
serve.mjs         local static server
```

## Deployment

Static site: any host works. GitHub Pages steps are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Live URL: https://reetika-k.github.io/equation-catcher/

## Credits

Built with Claude Code as the coding assistant; every prompt and fix is logged in [docs/VIBE_CODING.md](docs/VIBE_CODING.md).
