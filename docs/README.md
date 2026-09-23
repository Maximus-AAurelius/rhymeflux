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

- **SONGS is your project folder**: tap **+ UPLOAD FILE** to drop in any MP3/WAV — it uploads to your account and shows up as a row you can rename inline. Each file gets action buttons:
  - **SET AS BEAT** — makes it the active beat (plays in the persistent transport bar, shows up in FLOW).
  - **→ DECK A / → DECK B** — loads it straight into a SCREW deck.
  - **EXTRACT STEMS** — links it as the active beat, then tells you the exact command to run locally (see below) for the full instrument split.
  - **DELETE** — removes it from your account.
- **BEAT (FLOW tab) → MY FILE**: tap LOAD, pick an actual MP3/WAV/M4A from your device. It plays for real and uploads to your account, so it's there next time on any device. (Uploading via SONGS does the same thing, plus keeps a reusable, renameable copy.)
- **Transport bar**: whenever a beat is loaded, a play/pause/stop/record + scrub + tempo + loop strip sits under the header on every tab — control it from Write, Booth, wherever. TEMPO changes playback speed while keeping pitch normal (unlike SCREW, which drops pitch on purpose); RECORD captures a take from anywhere, not just Booth.
- **BOOTH**: a real BEAT/VOCAL mixer (volume, mute, solo — both wired to actual playback) sits above the take recorder. RECORD actually captures audio from your mic (`MediaRecorder`) and uploads each take; takes list, plays, and deletes for real, synced to your account.
- **PACKS tab — split a whole song into sound packs**: this is where full instrument separation lives. Pick a file from SONGS, tap **SPLIT FULL STEMS**, then on your computer, from the repo root: `pip install demucs supabase soundfile numpy`, then `python scripts\split_stems.py path\to\that-same-file.mp3`. It signs in with your Rhymeflux email/password, runs Demucs's 6-stem model locally (free, several minutes on CPU, first run downloads a second model file — guitar/piano are the least reliable of the six, Demucs itself calls that pair experimental), and uploads **vocals, drums, bass, guitar, piano, other, and a computed instrumental** (a mixdown of everything except vocals). Add `--quick` to the command instead for the old fast vocals/instrumental-only split. Everything you've split shows up in PACKS under "YOUR SOUND PACKS" with a play button and eight pad-number buttons — tapping a number loads that piece straight onto a BEATS pad, and now that actually persists to your account (a new `pads` table), so it's still there next time you open the app on any device.
- **STEMS panel (FLOW tab)** still just displays and plays whatever's been split for the active beat — the splitting itself happens via PACKS (above), not automatically in the browser, since that needs real CPU power a phone or browser tab can't provide for free.
- **MIDI**: Settings shows a MIDI DEVICES panel — plug in your Oxygen 25 (or any class-compliant MIDI controller) via USB and open Settings in Chrome or Edge on your computer; it lists connected devices. (Not supported in Safari or on mobile.)
- **BEATS tab**: an 8-pad sampler. LOAD a sound onto each pad (or send one over from PACKS) and tap to trigger, or play them live from a connected MIDI keyboard — notes 36–43 map to pads 1–8 (standard drum-rack convention). A 16-step sequencer per pad runs on accurate Web Audio timing with its own BPM control, so you can build and loop a pattern. Pad sounds now persist to your account, however they were loaded.
- **WRITE**: bars autosave to your account as you edit — same song follows you between your phone and your computer.
- Still not connected: transcription, the AI co-writer, and full multi-song cloud sync (only the one open song's lyrics persist right now — SONGS is a file library, separate from the lyrics document). SCREW doesn't export a mixed-down file yet — it's live-only. See the Backend Spec for the longer-term plan.
