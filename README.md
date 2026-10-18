# Equation Catcher

**Vibe Coding Challenge capstone – a browser game built and hosted with HTML, CSS and JavaScript.**
IIT Patna AI/ML capstone, Project 2: *Vibe Coding Challenge: Build and Host Your Own Online Video Game*.

An equation such as `2x + 5 = 17` appears at the top. Numbers fall from the sky. Move the basket to catch the number that solves it. Wrong numbers and bombs cost lives; the timer keeps you honest; three levels of increasing difficulty end in a win screen.

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
npm test                     # 11 logic tests (node:test), no browser needed
node tests/e2e-browser.mjs   # browser play test; needs Chrome with --headless=new --remote-debugging-port=9334 --remote-allow-origins=*
```

The browser test starts a game with `?seed=7`, presses the keys, auto-plays level 1, checks level-up, pause, mute, both loss conditions, restart, the saved high score and the phone layout, and saves screenshots to `docs/screenshots/`. Results and the bugs found are in [docs/TESTING.md](docs/TESTING.md).

## Game dashboard

[`reports/dashboard.html`](reports/dashboard.html) is a self-contained page built from the game's own code and recorded files: the level design table, a seeded audit of 15,000 generated equations (stated answers always solve them, decoys never do), a difficulty curve measured with two scripted players over 200 seeded games each, the logic-test run, the recorded browser play test, the findings table and screenshots. Nothing in it is estimated.

```bash
npm run test:tap     # records the logic-test run to tests/results/unit-latest.tap
npm run dashboard    # rebuilds reports/dashboard.html (about 1 s; no dependencies)
```

Once GitHub Pages is on, the page is served at `https://reetika-k.github.io/equation-catcher/reports/dashboard.html`.

## Design

A UI/UX pass after the first playable version turned the phone-sized column into a responsive game shell (help · play area · live stats on desktop, a compact single column on phones), modal cards for every screen with the missed answer and accuracy on game over, a timer ring, a Fredoka/Nunito type system and reduced-motion support. The audit, tokens, layouts, components and states are in [docs/DESIGN.md](docs/DESIGN.md); before/after screenshots in `docs/screenshots/`.

## Project structure

```
index.html        screens, HUD, canvas, touch controls      style.css      visual design
src/game.js       pure game logic (no DOM): levels, spawning, catches, lives, timer, events
src/equations.js  equation generator (answers correct by construction) + decoys
src/rng.js        seedable random numbers (reproducible tests)
src/render.js     canvas drawing only                        src/audio.js   Web Audio sounds + mute
src/main.js       input, game loop, effects, high score, screens
tests/            game.test.mjs (logic) · e2e-browser.mjs (play test)
docs/             CONCEPT · VIBE_CODING (prompts) · TESTING · CAPSTONE_DOCUMENTATION · DEMO_SCRIPT · DEPLOYMENT · screenshots
serve.mjs         local static server
```

## Deployment

Static site: any host works. GitHub Pages steps are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Live URL: _to be added after deployment_.

## Credits

Built with Claude Code as the coding assistant; every prompt and fix is logged in [docs/VIBE_CODING.md](docs/VIBE_CODING.md).
