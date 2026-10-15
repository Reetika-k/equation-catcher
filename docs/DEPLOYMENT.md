# Deployment – GitHub Pages

The game is a static site (no server, no secrets), so GitHub Pages hosts it for free.

## One-time setup

1. The repository is `https://github.com/Reetika-k/equation-catcher`; the game's files (`index.html`, `style.css`, `src/`) are at the repository root.
2. In the repository: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`, folder **/ (root)**. Save.
3. After a minute the game is served at `https://reetika-k.github.io/equation-catcher/`.

Because all script and stylesheet paths in `index.html` are relative (`src/main.js`, `style.css`), the game also works from any sub-folder or custom domain without changes.

## Alternatives

Netlify and Vercel also work: connect the repository or drag-and-drop the folder, no build command.

## After deploying

- Open the URL in two browsers (for example Chrome and Safari) and on a phone; play through Level 1 and check the touch buttons.
- Run the browser play test against the live URL: `node tests/e2e-browser.mjs https://reetika-k.github.io/equation-catcher/`
- Paste the URL into `README.md` and section 15 of `docs/CAPSTONE_DOCUMENTATION.md`.
