# BporchProduction$ — pass 1 (Write screen)

Write it. Chop it. Make it yours.

## Run it locally

The app loads `rhyme-engine.js` and `slang-overlay.json` next to `index.html`, so open it through a local server, not by double-clicking:

```
cd dist
npx serve .          # or: python -m http.server 8080
```

Then open http://localhost:3000 (or :8080). Microphone recording and dictation need `localhost` or HTTPS.

## Put it on GitHub + GitHub Pages

```
git init
git add .
git commit -m "BporchProduction$ pass 1: Write screen"
git branch -M main
git remote add origin https://github.com/<you>/bporchproduction.git
git push -u origin main
```

On GitHub, go to Settings → Pages → Deploy from branch → `main` / root. The site is served over HTTPS, so recording works on your iPhone as well.

## What works in this build

- Working in the page: lyric editor, sections, undo/redo, autosave to this browser (localStorage), rhyme marks and suggestions from the on-device dictionary, syllable estimates, beat playback from a local file, Quick Capture audio recording (kept in the tab only).
- Depends on the browser: dictation (Web Speech API).
- Not connected yet: cloud sync, transcription, AI, stem separation. See the Backend Spec for the plan.
