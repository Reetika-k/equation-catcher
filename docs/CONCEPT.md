# Game concept (PDF Step 1)

| | |
|---|---|
| **Game name** | Equation Catcher |
| **Target player** | Students aged 12–15 (Class 7–9) who are learning linear equations, and casual players who like quick reflex games. Sessions of 3–5 minutes. |
| **Objective** | An equation such as `2x + 5 = 17` is shown at the top. Numbers fall from the sky. Move the basket to catch the number that solves the equation. Catch enough correct answers to clear each level; clear all three levels to win. |
| **Player controls** | Keyboard: ← → or A / D to move the basket. Mouse or touch: drag left/right, or tap the on-screen ◀ ▶ buttons on phones. P pauses, M mutes. |
| **Scoring system** | +10 points × level for each correct catch. At the end of a level, the seconds left are added as a time bonus. The best score is saved in the browser (high score). |
| **How the player wins** | Complete Level 3 (catch 7 correct answers before the timer runs out) with at least one life left. |
| **How the player loses** | Catching a wrong number or a bomb costs one life; the game ends at 0 lives. The level timer (60 s) running out also ends the game. |
| **Levels** | Level 1 – one-step equations (`x + 4 = 10`, `3x = 12`), slow numbers, 2 decoys, 5 catches to clear. Level 2 – two-step equations (`3x + 5 = 20`), faster, 3 decoys, 6 catches. Level 3 – variable on both sides (`5x - 3 = 2x + 9`), fastest, 3 decoys plus bombs, 7 catches. |
| **Challenge mechanism** | Countdown timer per level, limited lives, increasing fall speed, more decoys, bombs in Level 3. |
| **Visual style** | Bright, playful: gradient sky, rounded number bubbles, a wooden basket, particle burst on a catch, screen shake on a wrong catch, clean typography. |
| **Sound** | Short synthesised sounds (catch, wrong, level up, win, game over) generated with the Web Audio API; mute button. No audio files needed. |
| **Technology** | HTML, CSS, JavaScript (canvas). No framework, no build step. Hosted on GitHub Pages. |

Why this game: it combines two ideas suggested in the capstone PDF ("Catch the Falling Objects" and "Math Adventure Game"), it stays small enough to finish reliably, its logic can be tested automatically, and it connects to the first capstone project (the algebra tutor) without needing any AI or server at runtime, which keeps hosting free and simple.
