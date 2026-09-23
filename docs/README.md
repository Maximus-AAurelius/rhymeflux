# BporchProduction$ — pass 1 (Write screen)

Write it. Chop it. Make it yours.

## Run it locally

The app loads `rhyme-engine.js` and `slang-overlay.json` next to `index.html`, so open it through a local server, not by double-clicking:

```
cd docs
npx serve .          # or: python -m http.server 8080
```

Then open http://localhost:3000 (or :8080). Microphone recording and dictation need `localhost` or HTTPS.

## Put it on GitHub + GitHub Pages

```
git init
git add .
git commit -m "BporchProduction$ pass 1: Write screen"
git branch -M main
git remote add origin https://github.com/<you>/rhymeflux.git
git push -u origin main
```

On GitHub, go to Settings → Pages → Deploy from branch → `main` / `docs`. The site is served over HTTPS, so recording works on your iPhone as well.

Live: https://maximus-aaurelius.github.io/rhymeflux/

## Known source issue

The Write screen and Engine Bench components both load `rhyme-engine.js`/`slang-overlay.json` with a bare relative `import()`/`fetch()`. Because those components run from a `blob:` URL inside the dc-runtime canvas, the relative path never resolves once the page is exported and self-hosted — the rhyme panel just spins on "Loading the rhyme dictionary..." forever with no console error. This repo's `docs/index.html` and `workspace/*.dc.html` have been patched to resolve against `document.baseURI` instead, but **every fresh export from Claude Design will reset this** since the bug lives in the canvas source itself. Fix at the source: in both `componentDidMount()`s, replace
```js
import("./rhyme-engine.js")
fetch("slang-overlay.json")
```
with
```js
import(new URL("rhyme-engine.js", document.baseURI).href)
fetch(new URL("slang-overlay.json", document.baseURI).href)
```

## What works in this build

- Working in the page: lyric editor, sections, undo/redo, autosave to this browser (localStorage), rhyme marks and suggestions from the on-device dictionary, syllable estimates, beat playback from a local file, Quick Capture audio recording (kept in the tab only).
- Depends on the browser: dictation (Web Speech API).
- Not connected yet: cloud sync, transcription, AI, stem separation. See the Backend Spec for the plan.
