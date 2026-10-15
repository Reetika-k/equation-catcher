# UI/UX design – Equation Catcher

A senior-designer pass on the first playable version. Game logic was not changed; everything here is presentation, layout and feedback.

## 1. Audit of the first version (desktop screenshot, 2000 px wide)

| Problem | Why it matters |
|---|---|
| A 480 px portrait column floats in a flat blue void; three quarters of the screen is empty | Reads as a phone emulator, not a desktop game; wasted space, weak first impression |
| Mute and pause buttons sit below the play area with nothing around them | Orphaned controls, inconsistent style, no key hints for desktop players |
| Game-over is text floating over a blurred scene | No hierarchy, no card, "Final score" and "Highest score" look identical, no secondary action |
| The player is never told what the right answer was | The learning moment is lost exactly when the player is most curious |
| HUD pills are tiny on a large screen; the timer is a bare number | Time pressure is the core challenge but is barely visible |
| System font, flat gradient, generic basket | No identity; nothing says "game" |

## 2. Goals and principles

1. **The play area is the hero.** Everything else supports it and never competes with the sky.
2. **Use the space you have.** Desktop gets a three-column shell (help · play · stats); phones get a single column with a compact stat strip and docked touch controls.
3. **Every screen is a card.** Start, level-up, game-over and pause are modal cards with one primary action and clear hierarchy.
4. **Feedback teaches.** Game-over shows the missed equation and its answer, the level reached and accuracy.
5. **Readable under pressure.** Big tabular numbers, a timer ring that changes colour, hearts that pop when hit.
6. **Accessible by default.** 4.5:1 text contrast, visible focus rings, keyboard for everything, reduced-motion support, live region for the HUD.

## 3. Design system

| Token group | Values |
|---|---|
| Colour – backdrop | navy 900/800/700 (`#0b1538`, `#0f1d4a`, `#16296a`) with two soft radial glows and a dot grid |
| Colour – surfaces | white, `#f3f6fc`, `#e9eef9`; line `#dfe5f1` |
| Colour – ink | `#1b2340`, `#4b5675`, `#7c86a3` |
| Colour – accent | orange `#ff7a1a` (primary action, brand), `#d9600a` pressed, `#ffe6d1` tint |
| Colour – semantic | success `#1aa36b`, warning `#f2b705`, danger `#e23d4f` |
| Type | Display: Fredoka 500–700 (titles, numbers, equation). Body: Nunito 500–800. Numbers use tabular figures |
| Spacing | 4 · 8 · 12 · 16 · 20 · 24 · 28 |
| Radius | 10 (inputs) · 16 (cards, stat tiles) · 24 (play area, modals) |
| Elevation | shadow-1 for cards; shadow-2 for the play area and modals |
| Motion | 120 ms button press, 280 ms modal pop (ease-out), 350 ms progress fill; all disabled under `prefers-reduced-motion` |

## 4. Layout

```
Desktop (≥ 1024 px)                                  Phone (< 1024 px)
┌───────────────────────────────────────────────┐    ┌──────────────────┐
│ ⬢ Equation Catcher · tagline         🔊  ⏸   │    │ ⬢ Equation Catcher 🔊⏸│
├──────────┬─────────────────────┬──────────────┤    ├──────────────────┤
│ How to   │                     │ Progress ▬▬  │    │ Lv · Score · ♥ · ⏱ │
│ play     │      PLAY AREA      │ Score  Best  │    ├──────────────────┤
│ Controls │   (3:4 canvas,      │ Lives ♥♥♥    │    │                  │
│ Levels   │    modals inside)   │ Time  ◔ 42   │    │    PLAY AREA     │
│          │                     │              │    │                  │
├──────────┴─────────────────────┴──────────────┤    ├──────────────────┤
│        ← → move · P pause · M mute            │    │  ◀           ▶   │
└───────────────────────────────────────────────┘    └──────────────────┘
```

- The play area keeps its 3:4 ratio and is capped by viewport height so it never scrolls on a laptop.
- On phones the left panel is dropped (its content lives on the start card), the four stats become one strip, and the ◀ ▶ buttons dock at the bottom with safe-area padding.

## 5. Components

| Component | Spec |
|---|---|
| Stat tile | Label (12 px caps, ink-3), value (26 px Fredoka), optional foot line. Progress tile has an 8 px bar; Time tile has a 72 px ring |
| Timer ring | SVG circle, dash offset = time left; green → amber at 20 s → red + pulse at 10 s |
| Lives | Three hearts, `♡` when lost, 450 ms pop on hit |
| Modal | 360 px max, 24 px radius, eyebrow + title + subtitle + content + primary button (+ secondary), pop-in animation |
| Primary button | Orange, 17 px Fredoka, 4 px "press" shadow; hover lifts 1 px, active sinks 3 px |
| Secondary button | Surface-2 with border; used for "Main menu" |
| Icon button | 44 px, translucent on navy, in the brand bar (mute, pause) |
| Touch button | 60 px tall, full-width halves, only on phones |
| Equation banner (canvas) | White card with soft shadow, 32 px Fredoka, "CATCH x · n / N" caption |
| Number bubble (canvas) | Radial gradient keyed by value (never by correctness), white rim, soft shadow |
| Basket (canvas) | Woven gradient body, rim, handle; tilts up to 12° with movement |

## 6. Screen states

| State | Content | Primary action | Secondary |
|---|---|---|---|
| Start | Eyebrow, "Ready?", 3 steps (phone only), best score | Start game | – (↵ hint) |
| Playing | Canvas + HUD; low-time warning at 10 s | – | P pause, M mute |
| Level cleared | Title, time bonus + score, what the next level brings | Next level / See result | – |
| Game over / Win | Title, reason, **the answer was x = N (equation)**, stats grid (final, best, level, accuracy) | Play again | Main menu |
| Paused | Title, reassurance that the timer is stopped | Resume | – |

## 7. Accessibility

- Text contrast: ink on white ≥ 12:1; ink-3 labels on white 4.6:1; white on orange buttons 3.3:1 at 17 px bold (large-text threshold) with a dark press shadow for edge definition.
- `:focus-visible` yellow ring on every control; all actions reachable by keyboard (↵ start/next/again, P, M, arrows).
- `#hud` is an `aria-live="polite"` region; the progress bar exposes `aria-valuenow`.
- `prefers-reduced-motion`: no shake, particles, pop or pulse animations.
- Touch targets ≥ 44 px; `viewport-fit=cover` with safe-area padding.

## 8. Before / after

- Before: `docs/screenshots/01-start.png` … `05-mobile.png` (first version).
- After: `06-desktop-start.png`, `07-phone-start.png`, `08-desktop-playing.png`, `09-desktop-gameover.png`, plus the play-test captures regenerated on the new design.
