# Barwork (BporchProduction$) — a rap writing studio

Write it. Chop it. Make it yours.

**Two builds live here:**
- `barwork.html` — the feature-complete prototype: SONGS / WRITE / FLOW / BOOTH tabs, rhyme drawer, AI-ammo panel, sensitivity settings, Free/Pro/Lifetime pricing. This is the one to use.
- `index.html` — the earlier "pass 1" Write-screen-only build, kept for reference.

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

Live: https://maximus-aaurelius.github.io/rhymeflux/barwork.html (flagship build)
Also live: https://maximus-aaurelius.github.io/rhymeflux/ (pass-1 Write screen)

## Known source issue

The Write screen, Barwork App, and Engine Bench components all load `rhyme-engine.js`/`slang-overlay.json` with a bare relative `import()`/`fetch()`. Because those components run from a `blob:` URL inside the dc-runtime canvas, the relative path never resolves once the page is exported and self-hosted — the rhyme panel/editor just spins or silently never gets the engine, with no console error. This repo's `docs/*.html` and `workspace/*.dc.html` have been patched to resolve against `document.baseURI` instead, but **every fresh export from Claude Design will reset this** since the bug lives in the canvas source itself. Fix at the source: in each affected `componentDidMount()`, replace
```js
import("./rhyme-engine.js")
fetch("slang-overlay.json")
```
with
```js
import(new URL("rhyme-engine.js", document.baseURI).href)
fetch(new URL("slang-overlay.json", document.baseURI).href)
```

## Account setup (one time)

`barwork.html` is gated by a login screen — it's private to your account, backed by a free Supabase project (`rhymeflux`, under the same Supabase org as the other projects).

1. Open the app, tap **NEW HERE? CREATE ACCOUNT**, enter your real email + a password.
2. Supabase emails you a confirmation link — click it.
3. Come back and sign in normally.
4. Optional but recommended, so no one else can register an account: in the [Supabase dashboard](https://supabase.com/dashboard/project/ekmtrlnjlpxornkeyzlz) → Authentication → Sign In / Providers → Email, turn off "Allow new users to sign up." (Your data is already private either way — every table is row-level-secured to your own user id — this just tidies up the login screen.)
5. Free-tier note: this Supabase project pauses itself after 7 days with no activity. It isn't deleted — just open the dashboard link above and click Resume if the app ever fails to load your songs.

## Beats, takes, and stems — what's real now

- **BEAT (FLOW tab) → MY FILE**: tap LOAD, pick an actual MP3/WAV/M4A from your device. It plays for real and uploads to your account, so it's there next time on any device.
- **BOOTH**: RECORD actually captures audio from your mic (`MediaRecorder`) and uploads each take; takes list, plays, and deletes for real, synced to your account.
- **STEMS**: the app only *displays and plays* stems — it doesn't generate them (real vocal/instrumental separation needs real compute, which isn't free to run instantly from a phone). To add stems:
  1. Load the beat in the app first (step above) so there's a cloud record to attach to.
  2. On your computer, from the repo root (one level up from this `docs/` folder): `pip install demucs supabase`, then `python scripts\split_stems.py path\to\that-same-beat.mp3`. It signs in with your Rhymeflux email/password, runs Demucs locally (free, a few minutes on CPU, first run also downloads the ~80MB model), and uploads the vocal/instrumental stems.
  3. Reopen FLOW on any device — the stems now show up under STEMS with a PLAY button.
- **WRITE**: bars autosave to your account as you edit — same song follows you between your phone and your computer.
- Still not connected: transcription, the AI co-writer, and full multi-song cloud sync (only the one open song persists right now). See the Backend Spec for the longer-term plan.
