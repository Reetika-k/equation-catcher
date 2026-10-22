# Requirement → Implementation mapping (Project 2)

Requirements are taken from the PDF's Project 2 section (objective, steps 1–12, expected outcomes). Test ids: `L` = logic test in `tests/game.test.mjs`, `B` = browser play test in `tests/e2e-browser.mjs`, `M` = manual (demo script).

| Requirement from PDF | Implementation | File / feature | Tested? |
|---|---|---|---|
| Clear objective | "Catch the number that solves the equation"; shown on the start screen and in the equation banner | `index.html` start screen, `render.js` banner | B (start screen check) |
| Player controls | Arrow keys / A D, mouse or touch drag, on-screen ◀ ▶ buttons | `main.js` input handlers | L (movement, clamping), B (keys), B (touch buttons at phone width) |
| Scoring | +10 × level per correct catch, time bonus per level, high score in localStorage | `game.js` `caught()`, `main.js` `best` | L (scoring, bonus), B (score, high score after reload) |
| Challenges | Wrong numbers and bombs cost lives; countdown timer; rising speed; more decoys | `game.js` LEVELS, `spawn()`, `update()` | L (lives, timer), B (loss by time and by lives) |
| At least three levels / increasing difficulty | 3 levels: one-step → two-step → both sides; speed 110 → 150 → 190; decoys 2 → 3; bombs in level 3 | `game.js` LEVELS, `equations.js` | L (level forms, level progression), B (level-up → level 2) |
| Win or loss conditions | Win after clearing level 3; lose at 0 lives or when the timer ends | `game.js` `nextLevel()`, `lose()` | L (win, both losses), B (both losses) |
| Restart capability | "Play again" on the game-over screen, Enter/Space shortcut | `main.js` `startGame()`, `game.js` `restart()` | L (restart resets), B (play again) |
| Attractive visuals | Gradient sky, clouds, number bubbles, wooden basket, particles, shake, floating text, styled screens | `render.js`, `style.css` | B (canvas content), screenshots |
| Start screen: title, instructions, Start button | Present | `index.html` `#screen-start` | B |
| Game-over screen: final score, highest score, restart | Present | `index.html` `#screen-over` | B |
| Timer or challenge mechanism (Step 8) | 60-second level timer with low-time warning | `game.js`, `main.js` HUD | L, B (paused timer stops) |
| Lives (Step 6) | 3 lives, hearts in HUD | `game.js`, `main.js` | L, B |
| Obstacles / enemies (Step 5) | Decoy numbers every level, bombs in level 3 | `game.js` `spawn()` | L, B |
| Sound with mute option (Step 10) | Web Audio synthesised sounds; M key and 🔊 button; remembered | `audio.js` | B (mute persisted) |
| Test the game (Step 11) | Logic tests + automated browser play-through + manual demo | `tests/` | – |
| Online hosting / public URL (Step 12) | Live on GitHub Pages: https://reetika-k.github.io/equation-catcher/ | `docs/DEPLOYMENT.md` | B (18/18 against the live site) |
| Game instructions | Start screen and README | `index.html`, `README.md` | B |
| Project explanation | Report and docs | `docs/CAPSTONE_DOCUMENTATION.md` | – |
| Live gameplay demonstration | Script | `docs/DEMO_SCRIPT.md` | M |

Optional advanced features included: mobile/touch controls, saving high scores, pause. Not included (optional): leaderboard, multiplayer, character selection, power-ups, achievements.
