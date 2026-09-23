# Barwork — Handoff / Pickup Doc

**Read this first if you're a fresh agent or session picking this project back up.**

Last updated: 2026-09-23

## What this is

Barwork (Travis calls it "Barwork," the repo/live URL still say "rhymeflux" —
see **Naming** below) is a private, single-account rap writing and
production studio: write bars with a real phonetic rhyme engine, load a
beat, record vocals, chop-and-screw records DJ Screw style, and run an
8-pad MIDI sampler with a step sequencer. It started life as a Claude
Design canvas export (a static mockup with fake/non-functional controls)
and has been incrementally turned into a fully real, working app over
several sessions — see **What's real vs. what's still fake** below;
as of this writing, everything described in the README is real and
tested, nothing is a mockup.

It is **not** a commercial product. One account, private, not published.
Note: the name and pricing tiers originally resembled a real competitor
product (rhymeflux.com, a different founder's real SaaS) — Travis was
told about this directly and said to keep it private and not worry about
it, so no rename/de-conflict work has been done. Flag it again if scope
ever changes toward anything public-facing.

## Where things live

- **This repo**: currently `C:\Users\travi\Projects\Rhymeflux` (Travis
  asked at the end of the last session to move/rename this folder — see
  **Open item: folder rename**, below, before assuming this path is
  still current).
- **GitHub**: https://github.com/Maximus-AAurelius/rhymeflux (public repo,
  used purely as GitHub Pages hosting — not for outside contributors).
- **Live**: https://maximus-aaurelius.github.io/rhymeflux/barwork.html
  (the real app — everything below refers to this build).
  Also live but frozen/reference-only: https://maximus-aaurelius.github.io/rhymeflux/
  (an old "pass 1" Write-only build — don't touch, not worth it).
- **Supabase project**: `rhymeflux`, ref `ekmtrlnjlpxornkeyzlz`, under
  org `Maximus-AAurelius's Org` (same org as `texas-investors` and two
  other paused projects — don't confuse them). Dashboard:
  https://supabase.com/dashboard/project/ekmtrlnjlpxornkeyzlz
  Free tier — pauses after 7 days idle, not deleted, just click Resume.
- **The actual app file**: `docs/barwork.html`. It's one big file — a
  custom Claude-Design "DC" component (see **How the code is structured**
  below), not a normal framework app. `docs/README.md` is the up-to-date
  user-facing feature doc; keep it in sync with every change.

## How the code is structured (read before editing barwork.html)

`docs/barwork.html` is a single-file app built on a bespoke reactive
runtime (`support.js`, from the original Claude Design export) — think a
tiny homemade React: a `class Component extends DCLogic` with `state`,
`this.setState(...)`, `renderVals()` returning a flat props object, and
HTML templated with `{{ expr }}`, `<sc-if value="{{ bool }}">`, and
`<sc-for list="{{ arr }}" as="item">`. It is **not** JSX and does not
compile — it's parsed/interpreted at runtime by `support.js`.

Known gotchas specific to this runtime, learned the hard way this session:

1. **`sc-if` pre-renders both branches.** The canvas tooling this runtime
   came from speculatively renders the "false" branch's DOM too (for its
   own design-preview purposes), with template placeholders left
   un-substituted. This is harmless for text content, but if you bind a
   real resource-fetching attribute (`<audio src="{{ url }}">`, `<img
   src="{{ url }}">`) inside a conditional branch, the browser will
   literally try to fetch the literal string `{{ url }}` as a URL and
   log a 404 — even while the branch is "hidden." **Fix used throughout:
   never bind `src=` to a template value.** Use a plain button + `new
   Audio(url).play()` in JS instead (see any `onPlay` handler in the
   file for the pattern).
2. **The bottom tab bar has an explicit `z-index:2`**, inherited from the
   original export. Every overlay/drawer (word drawer, AMMO, Settings,
   Help) must set its own `z-index` (backdrop `5`, content `6`) or its
   bottom-area controls will silently fail to receive clicks wherever
   they overlap the tab bar, with no visible sign anything's wrong. If
   you add a new overlay, copy the z-index pattern from the Settings
   drawer, don't skip it.
3. **`decodeAudioData` detaches the ArrayBuffer it's given.** If you need
   the same bytes for both upload and local decode, call `.slice(0)` on
   the buffer before decoding, or read it twice.
4. **Object-literal duplicate keys**: `renderVals()`'s return object is
   large; if you add a key that's already defined later in the same
   object, the later one silently wins with no error. Search before
   adding a new render-prop name.
5. This file has **no build step** — edit it directly, then verify with
   a real browser before pushing (see **How to test changes**, below).
   Never assume a change is correct just because it "looks right" —
   several real bugs this session (Tone.js audio context never unlocked,
   the z-index issue above, an idempotency bug creating duplicate `beats`
   rows) were only caught by actually clicking through a rendered page.

## How to test changes (do this before every push)

There is no test suite. The pattern used all session, which works well:

1. Copy `docs/barwork.html` to a scratch file.
2. Patch two things in the copy only (never in the real file):
   - `session: null,` → `session: { user: { id: "preview" } },` (skips
     the login gate)
   - Replace the `import("https://esm.sh/@supabase/supabase-js@2")...`
     block with a small in-memory mock (`window.__mockSb`) so Supabase
     calls don't hit the network. A working mock query-builder is
     preserved in scratchpad history this session — recreate it if
     needed; it just needs `.from(table).select/.insert/.update/.upsert/.delete`
     and `.storage.from(bucket).upload/.createSignedUrl/.remove`, backed
     by a plain in-memory object.
3. Serve the scratch copy with `npx serve` on a spare port, drive it
   with Playwright (`chromium.launch()`), and actually click through the
   feature you changed — screenshot it, check `page.on('console')` /
   `page.on('pageerror')` for anything logged.
4. Only after that passes, edit the real `docs/barwork.html`, re-run the
   same check against it, then commit + push.

**Local resource note**: this machine has 7.68GB RAM. Headless Chromium
instances from repeated test runs pile up fast and will eventually
crash new launches with "Page crashed" — that's a resource problem, not
a code bug. Clean up with
`Get-Process -Name "chrome-headless-shell" | Stop-Process -Force`
between test rounds (safe — never kills a real visible browser window).

## What's real vs. what's still fake / not built

Everything in `docs/README.md`'s feature list is real and tested. Beyond
that:

- No generative AI co-writer. AMMO panel = curated phrase bank + real
  rhyme-engine verification, not an LLM.
- SCREW tab doesn't export a mixed-down file — live performance only.
- Only one song's lyrics persist (the fixed `SONG_UUID` constant in the
  code) — SONGS/PACKS are a general file library, a separate concept
  from the single lyrics document in WRITE. True multi-song support
  would need a real `songs` CRUD UI — not started.
- No true dockable/movable panel layout (Travis explicitly chose fixed
  tabs over building that, to keep scope down) — revisit only if asked.
- Ideas floated but not built: exporting a finished SCREW mix or BEATS
  pattern as a downloadable audio file; sample-pack folders/tags once
  the PACKS list gets long; undo in the SCREW chop tool or BEATS
  sequencer.

## Backend / infra summary

Supabase tables (all RLS-scoped to `auth.uid() = user_id`): `songs`
(lyrics, one fixed row via `SONG_UUID`), `beats`, `takes`, `stems`
(kind: vocals/instrumental/drums/bass/other/guitar/piano), `library`
(the SONGS file list), `pads` (persisted BEATS pad assignments, unique
per `user_id`+`pad_index`), `split_jobs` (queue for the background
worker, status pending→processing→done/error). Storage buckets: `beats`
(also used for library + pad-uploaded files), `takes`, `stems`, and an
unused `library` bucket (harmless leftover, everything actually uses the
`beats` bucket — fine to ignore or clean up later).

Two Python scripts in `scripts/`, both sign in with Travis's real
Rhymeflux email/password (anon key only, no service-role key anywhere):
- `split_stems.py` — one-shot, manual: `python split_stems.py <path> [--quick]`.
- `split_worker.py` — the one actually used day-to-day: run it once,
  it polls `split_jobs` every 5s and processes anything queued from the
  app's PACKS tab automatically. Needs `pip install demucs supabase
  soundfile numpy`.

## Open item: folder rename (unresolved as of last session)

Travis asked to move/rename this project folder to sit alongside
`C:\Users\travi\Projects\TexasInvestors`, named exactly `Barwork`. **This
could not be done automatically**: there is already an unrelated,
substantial existing project at `C:\Users\travi\Projects\BarWork` (~102MB,
its own git repo, a Node/TypeScript monorepo with `apps/`, `services/`,
`docker-compose.yml`, `.env`, and its own `HANDOFF.md`/`CLINE_HANDOFF.md`
from a prior session with a different AI tool). Windows folder names are
case-insensitive, so `Barwork` and `BarWork` collide — a plain rename of
this repo to `Barwork` would conflict with that folder. **Do not rename
or delete anything here without asking Travis directly what that old
BarWork project is and whether it can be moved/renamed out of the way
first.** This was flagged to him at the end of the last session; check
the conversation for his answer before acting.

## Why this got tangled up with the "TexasInvestors" project

This app's git repo has always lived in its own folder, separate from
TexasInvestors — that part was never actually wrong. What *is* tied to
TexasInvestors is Claude's memory for this work: the auto-memory system
scopes memory files to whatever project folder a session was opened
from, and every session touching this app so far was opened from within
a TexasInvestors-rooted Claude Code session, so notes about this project
ended up filed under TexasInvestors's memory store instead of getting
their own. The real fix, if picking this back up: **open a fresh Claude
Code session with this project's own folder as the root**, not from
inside TexasInvestors — that gives it independent memory going forward.

## Suggested next steps

1. Resolve the folder-naming question above with Travis before doing any
   file moves.
2. Once Barwork has its own session root, this HANDOFF.md doubles as the
   seed for that session's own memory — worth re-reading it in through
   Claude's memory tool rather than leaving it purely as a file.
3. No specific feature was mid-flight when the last session ended — the
   backlog ideas under **What's real vs. what's still fake** are the
   most natural next asks if Travis doesn't bring something new.
