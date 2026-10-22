# Testing report – Equation Catcher

Everything here was actually executed. Logic tests run in Node; the play test drives the real page in headless Chrome (DevTools Protocol) with a seeded game (`?seed=7`) so the numbers are the same every run.

## 1. Test plan

| Level | What | How | Command |
|---|---|---|---|
| Logic | Equation generator, decoys, movement, scoring, lives, timer, level-up, win, loss, restart, guaranteed correct spawn, off-screen cleanup | `node:test`, no browser | `npm test` |
| Browser play test | Start screen, canvas, keyboard control, auto-play of Level 1, level-up, Level 2, pause, mute persistence, loss by time, game-over screen, restart, high score after reload, loss by lives, phone layout, JS errors | Headless Chrome via CDP | `npm run test:e2e` |
| Manual | Full playthrough with mouse drag and touch on a phone, sound on, two browsers | `docs/DEMO_SCRIPT.md` | – |

## 2. Logic tests (`npm test`) – 11 tests, 11 pass

- 600 generated equations (200 per level): the stated answer solves each one; no decoy ever does; answer and decoys are distinct
- Level forms match the concept (one-step / two-step / both sides); seeded runs are reproducible and unseeded runs vary
- Start resets score, lives, level, timer; basket moves with input and is clamped to the screen
- Correct catch: +10 × level and a new equation; decoy or bomb: −1 life; 0 lives → lost
- Timer at 0 → lost (reason "time")
- Clearing a level adds the time bonus; three level-ups → won; restart returns to level 1 with score 0
- A correct number is guaranteed within three spawns; objects past the bottom are removed and a missed correct answer emits an event

## 3. Browser play test scenarios (`npm run test:e2e`)

| # | User action | Expected result | Actual result (run 2) | Status |
|---|---|---|---|---|
| 1 | Open the game | Start screen with title, instructions, Start button | Shown | Pass |
| 2 | Look at the canvas | Scene is drawn (not blank) | Multiple colours sampled | Pass |
| 3 | Click Start | Playing; HUD shows Level 1 and ♥♥♥ | As expected | Pass |
| 4 | Read the banner | An equation is shown | `x + 9 = 10` | Pass |
| 5 | Press → then A | Basket moves right, then left | 240 → 297 → 240 | Pass |
| 6 | Auto-play Level 1 (basket follows the correct number, dodges others) | Score increases, 5 catches | score 71, 5 catches, 1 life left | Pass |
| 7 | Fifth catch | "Level 1 cleared!" screen with time bonus | Time bonus +21 · Score 71 | Pass |
| 8 | Click Next level | Level 2 in HUD; faster fall speed | Level 2, 150 > 110 px/s | Pass |
| 9 | Press P | Paused overlay; timer frozen | Frozen for 0.7 s | Pass |
| 10 | Press P again | Resumes | Resumed | Pass |
| 11 | Click 🔊 | Icon becomes 🔇 and the choice is saved | Saved in localStorage | Pass |
| 12 | Timer reaches 0 | Game over: "Time ran out.", final and highest score, Play again | Final 71, highest 71 | Pass |
| 13 | Click Play again | Level 1, score 0, 3 lives | As expected | Pass |
| 14 | Reload the page | Best score shown on the start screen | 71 | Pass |
| 15 | Catch three wrong numbers | "You ran out of lives.", hearts empty | As expected | Pass |
| 16 | Resize to phone width (390 px) | Touch buttons visible, no horizontal overflow | As expected | Pass |
| 17 | Whole run | No JavaScript errors or exceptions | None | Pass |

Run 1 (2026-09-28 22:08): **17 / 18** – scenario 8 failed because the test read the HUD label a few milliseconds after Level 2 began, before the next animation frame had updated it; the game state was already at level 2. Run 2 (22:11, after making the check wait for the frame): **18 / 18**. Screenshots from run 2: `docs/screenshots/02-playing.png`, `03-levelup.png`, `04-gameover.png`, `05-mobile.png`.

### Runs on the redesigned UI (2026-10-05)

After the UI/UX redesign (`docs/DESIGN.md`), the same play test was run again without modification: **run 3: 17 / 18** – the only failure was the test's assumption that the start card's heading is the game title (the title moved to the header; the card now says "Ready?"). The check was updated to look at the brand title and the card title; **run 4: 18 / 18**, no JavaScript errors. The logic tests are unaffected (11 / 11). Screenshots: `06-desktop-start.png`, `07-phone-start.png`, `08-desktop-playing.png`, `09-desktop-gameover.png`; the play-test captures 02–05 were regenerated on the new design.

**Against the live site (2026-10-22):** `node tests/e2e-browser.mjs https://reetika-k.github.io/equation-catcher/` → **18 / 18** on three runs in a row, after the two test fixes F7 and F8 below.

## 4. Failures found and what was changed

| # | Problem | Why | Fix | Type |
|---|---|---|---|---|
| F1 | `npm test` reported a single failing item named "tests" | Node 25 did not expand the directory argument into test files | Explicit file name in the script | Tooling |
| F2 | Game files written into the tutor project; tutor test script overwritten | Two scripted commands ran in parallel and the shell's working directory changed between them | Files moved back, scripts restored, both suites re-run; absolute paths in later edits | Process |
| F3 | Play-test scenario 8 failed once | HUD text updates on the next animation frame; the check ran before it | Test waits for the frame; no game change needed | Test |
| F5 | Redesign: start-card heading check failed | The title moved from the card to the header | Test checks the brand title and that the card has a title | Test |
| F6 | Timer ring reset to 60 on the game-over screen | HUD treated all non-playing screens like the start screen | End screens now freeze the final time value | UI |
| F4 | Auto-player lost two lives in Level 1 | The test's dodge logic is crude when a decoy falls close to the correct number | Accepted: the test only needs to clear the level; a human dodges better | Test |
| F7 | Live-site run: "arrow key moves the basket" failed in 2 of 3 runs | Each key was held for a fixed 150 ms, which can fall between two frames on a busy machine | Test holds the key until the basket moves (up to 5 s); no game change | Test |
| F8 | Live-site run: auto-player lost Level 1 once | It steered from outside the page every 60 ms; when the browser stalled, numbers fell past between updates | Steering now runs inside the page on every animation frame | Test |

## 5. Playability observations (from watching the runs and screenshots)

- Numbers are visually identical whether correct or not; colour depends on the value, not on correctness, so it never leaks the answer.
- Level 1 with a 60-second timer and 5 catches took the auto-player about 39 seconds while it also lost lives, which suggests the timer is fair for a human at Level 1; Level 3 difficulty has not been play-tested by people yet (PDF Step 11 asks to ask several people to play, which remains to be done before submission).

## 6. Limitations

- No human play-testing session has been recorded yet (Step 11); the demo script covers it.
- The deployed version has not been tested because deployment has not been performed (`docs/DEPLOYMENT.md`).
- Sound is verified only by the mute toggle; audible output cannot be checked in headless Chrome.
