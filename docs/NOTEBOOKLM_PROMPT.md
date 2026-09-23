# Using NotebookLM to make Barwork tutorial videos

## How to use this

1. Go to notebooklm.google.com, create a new notebook.
2. Add a source: paste the whole "SOURCE MATERIAL" section below as a single text source (or paste it into a Google Doc first and add that doc as the source — either works).
3. Click **Video Overview** (or **Audio Overview**) and paste one of the two **Customize** prompts below into the customization box before generating.
4. Generate Video 1 first, then start a fresh Video Overview in the same notebook and generate Video 2 with its prompt.

The source material below is deliberately thorough — every tab, every control, and a worked example for each — because NotebookLM's video is only as good as what it's given. Give it the real detail and it can explain the real app, not a guess at it.

---

## Customize prompt — Video 1: "Barwork: Write, Beat, Record"

```
Make this a friendly, practical tutorial video for a rapper who has never
used Barwork before. Focus only on the songwriting workflow: signing in,
the Songs file library, writing bars in the Write tab with live rhyme
highlighting, loading a beat in Flow, and recording vocal takes in Booth
with the Beat/Vocal mixer. Walk through it in the order a new user would
actually do it: sign in, write a verse, load a beat, record over it. Use
the worked examples from the source material (the "Ink on the paper"
verse, the rhyme tiers, the mixer walkthrough) as concrete illustrations,
not just abstract feature names. Explain WHY the rhyme highlighting and
syllable counter are useful for writing rap specifically, not just as
generic app features. Skip Screw and Beats entirely - those are covered
in a separate video. Keep it under 10 minutes. Assume the viewer is a
musician, not a programmer - don't explain technical implementation, just
what to click, what they'll see, and why it helps.
```

## Customize prompt — Video 2: "Barwork: Chop, Screw, and the Sampler"

```
Make this a friendly, practical tutorial video for a rapper who already
knows the basics of Barwork (writing, beats, recording) and wants to learn
the production tools: SCREW, PACKS, and BEATS. Explain the SCREW history
in one or two sentences (DJ Screw, Houston, chopped and screwed, why
slowing a turntable drops the pitch) then walk through its worked example
step by step: loading two decks, the SCREW SPEED slider, SYRUP reverb,
setting a loop with two clicks and hitting CHOP, and the crossfader. Then
cover PACKS using its worked example: splitting a whole song into vocals,
drums, bass, guitar, piano, other, and a computed instrumental by running
one command on a computer, and assigning those pieces onto BEATS pads
with a single tap. Then cover BEATS: building a pattern on the 16-step
sequencer, and connecting a MIDI keyboard (like an M-Audio Oxygen 25) so
its keys trigger the pads live - mention this needs Chrome or Edge on a
computer, not a phone. Make clear that pad assignments are saved, so a
sound pack built once is there on every future visit. Keep it under 12
minutes. Assume the viewer is a musician, not a programmer.
```

---

## SOURCE MATERIAL (paste everything below this line into NotebookLM as a source)

# Barwork — Complete Reference

## What Barwork is and who it's for

Barwork is a private, single-account rap writing and production studio
that runs entirely in a web browser — no install, works on a phone or a
computer, and everything made in it stays private to one account. It was
built to solve a specific problem: writing rap in a plain notes app or a
generic word processor gives you no feedback about the thing that
actually matters in rap — how the bars sound and flow — and switching
between a notes app, a separate rhyming dictionary website, a beat
player, a voice memo app, and a DJ tool to work on one song is
disjointed. Barwork puts all of it — writing, rhyme-finding, beat
playback, vocal recording, chopped-and-screwed remixing, and a small
sampler/sequencer — behind one login, on one page, so a single writing
and recording session never has to leave the app.

It is a personal tool, not a public product. There is one account; no
one else can sign up unless the owner allows it. Nothing typed or
recorded is shared, analyzed, or sent anywhere except to that one
account's private storage.

## Getting started

The first screen is a sign-in form: email and password. The first time,
a "create account" link makes a new account (a confirmation email is
sent and must be clicked before signing in). After that, it's a normal
sign-in. Every song, beat, take, and setting from here on belongs to
that one account and follows the user to any device they sign into —
write a verse on a phone during a commute, and it's there to keep
editing on a computer that evening.

## The transport bar — controls that follow you everywhere

The moment a beat is loaded (see SONGS or FLOW below), a control strip
appears just under the page header, and it stays visible no matter
which tab is open. It is arranged like a hardware recorder's transport:

- A bordered cluster of five buttons: **rewind 5 seconds**, **stop**
  (pauses and snaps back to the very start), **play/pause**, **forward
  5 seconds**, and **record** (a red dot).
- A bordered time readout showing the current position over the total
  length, e.g. "1:12 / 3:45."
- A scrub bar — drag it to jump anywhere in the track instantly.
- A **TEMPO** control, a slider from 0.5x to 1.5x speed. Unlike the
  SCREW tab (see below), this keeps the pitch normal while changing
  speed — it's meant for practicing a verse slower or faster without
  the beat sounding like a chipmunk or a demon.
- A **LOOP** toggle that repeats the whole track from the start once it
  ends.

**Worked example:** A writer loads "hardluck_82bpm.wav" as their beat.
They're on the WRITE tab reading their bars, not looking at the beat
controls at all, but the transport bar is still right there under the
header. They tap play, the beat starts, they drag TEMPO down to 0.85x
to rap along slower while they're still learning the flow of a new
verse, and when they're ready to record they just tap the red record
dot right there — no need to switch to the Booth tab first. When
they're done, stop resets playback to 0:00 for the next run-through.

## SONGS — the project folder

This is a real file library, not a preset list. Tapping **+ UPLOAD
FILE** opens a file picker; any MP3 or WAV gets uploaded to the
account's private storage and appears as its own row, with its name
shown in an editable text field (click it and type to rename in
place — no separate "rename" dialog).

Each row has four actions:

- **SET AS BEAT** — makes this file the one playing in the transport
  bar everywhere in the app, and shows it in the FLOW tab.
- **→ DECK A** / **→ DECK B** — sends the file straight into one of the
  two SCREW tab turntables, switching to that tab automatically.
- **EXTRACT STEMS** — marks this file as the active beat, then shows a
  message with the exact command to type on the user's own computer to
  split it into every instrument (see the PACKS tab below for the full
  workflow this feeds into). This uses Demucs, a real, free, open-source
  AI audio-separation tool — but Demucs needs real CPU power to run, more
  than a phone or a browser tab can provide for free, so it runs as a
  one-line command on the user's own computer rather than automatically
  in the browser. Once that command finishes, the separated tracks
  upload automatically.
- **DELETE** — removes the file and its storage for good.

**Worked example:** A writer has an a cappella idea and an instrumental
loop saved on their phone from a producer. They open SONGS, upload
both. They rename the instrumental from its messy export filename
("export_final_v3.wav") to "Chase Beat." They tap SET AS BEAT on it —
it's now playing in the transport bar everywhere. Later, on their
computer, they tap EXTRACT STEMS on the a cappella file, copy the
command shown, paste it into a terminal, and a few minutes later the
vocal and instrumental stems from that a cappella are sitting in the
FLOW tab, ready to reference while writing a new verse over the beat.

## WRITE — the lyrics editor with a real rhyme engine

This is the core writing surface: one line per bar, typed directly.
What makes it different from a plain text editor is that it runs a real
phonetic rhyme engine underneath — it doesn't just compare spelling, it
compares how words actually sound, using a phonetic dictionary and a
weighted-distance comparison from each word's last stressed vowel. That
is how it catches pairs like "orange" and "porridge," or "Bugatti" and
"body," or "college" and "knowledge" — none of which share enough
letters for a spell-check-style rhymer to notice, but which a rapper's
ear hears as landing together.

As bars are typed, every word that rhymes with another word already on
the page gets colored — and words that rhyme with each other share the
same color, so a whole rhyme scheme becomes visible as a pattern of
color across the verse rather than something the writer has to track in
their head. Tapping any colored (or plain) word opens a drawer at the
bottom with three tabs:

- **RHYMES** — a ranked list of words that rhyme with the tapped word,
  best matches first.
- **SWAPS** — words with the exact same syllable count as the tapped
  word, so swapping one in doesn't change the bar's rhythm.
- **MULTIS** — full multi-word phrases that rhyme, for landing a
  multi-syllable rhyme instead of a single word.

Tapping any suggestion in the drawer drops it straight into the line,
replacing the tapped word.

**Worked example:** A writer types six bars, the last one being "Turn a
page over, get the measure of the ocean." As soon as they finish typing
it, "measure" and "ocean" both light up in the same shade of a warm
color — because "measure" and "ocean" share the same vowel sound and
tail pattern. Two bars up, "motion" is already lit in the exact same
color, because "motion," "measure," and "ocean" all rhyme with each
other under the app's phonetic matching, even though none of them are
spelled alike. Curious about other options for "ocean," the writer taps
it: the RHYMES tab shows more words in that family, SWAPS shows other
two-syllable words that would keep the line's rhythm ("open," "focus,"
"notice"), and MULTIS shows phrases like "cap on the meter" that carry
the same landing sound across more than one word.

**Right-hand syllable counter:** each bar shows its syllable count in a
box on the right. If a bar runs noticeably longer than the average of
the section (roughly 15+ syllables), that box turns a warning color, so
a writer can see at a glance which bar is going to feel rushed against
the others when performed, without having to count on their fingers.

**RHYMES header stats and sensitivity:** the top of the WRITE tab shows
the bar count, the average syllables per bar, and the current rhyme
sensitivity ("RAP" by default). Tapping that sensitivity control cycles
through five levels (also settable from Settings, see below): OFF (no
coloring at all), STRICT (perfect rhymes only — "cat/hat" but not
"cat/mad"), RAP (perfect and slant rhymes together — the way rappers
actually pair them, and the recommended default), LOOSE (matches on
just the vowel plus a hint of the ending), and EVERYTHING (any shared
vowel sound lights up, the widest net).

**AI AMMO panel:** tapping the AMMO button opens a panel with four
writing "lanes" — Trap, Drill, Lyrical, and Melodic — each with its own
tone (Trap example: "Count it on the counter till the paper get
heavy"; Drill example: "Hold the whole block on a page that I'm
sketchin'"; Lyrical example: "Cartographer of corners with a pen for a
compass"; Melodic example: "I been writin' out the city on a page that
won't hold it"). Tapping a lane shows candidate next-bars from a
curated bank for that lane, each one checked live against the rhyme
engine to see whether it actually locks with the end of the last bar
written — a candidate is labeled either "LOCKED [tier] ON [word]" if it
rhymes, or "OPEN END" if it would start a fresh rhyme instead. This is
a curated, rhyme-verified idea bank, not a generative AI writing new
lines from scratch — it's meant to break writer's block with a solid
next bar in the right tone, verified to actually rhyme, not to write
the song for the user.

## FLOW — beat and song structure

Shows the currently loaded beat (with a mode switch between pasting a
YouTube link or loading a local file), a PLAY BEAT shortcut, the STEMS
panel (plays back the vocal/instrumental split once EXTRACT STEMS has
been run — see SONGS above — with nothing to do here until that's been
done for the active beat), and a 4/4 beat grid: every bar from the
Write tab shown as a row of 16 small slots, filled in proportional to
how many syllables land in that bar, with a LIGHT / POCKET / PACKED
label so a writer can see which bars are dense compared to the rest of
the song, matched up against the beat's bar structure.

## BOOTH — recording vocals over the beat

At the top, a two-channel mixer: **BEAT** and **VOCAL**, each with a
real volume slider plus mute (M) and solo (S) buttons that genuinely
change what's audible — muting the beat channel actually silences the
beat, soloing the vocal channel actually silences the beat while
leaving recorded takes audible, and so on. Below the mixer, a large
RECORD button captures real audio from the device's microphone (this
prompts for microphone permission the first time) as a "take" attached
to a specific bar; a waveform-style level meter and a running timer
show while recording. Finished takes list below with a play button and
a delete button, plus an A / B pair of slots to line two different
takes up side by side for comparison.

**Worked example:** A writer has their "Chase Beat" loaded and wants to
lay down bar 2 of their verse. In BOOTH, they pull the BEAT fader down
slightly and leave VOCAL at full so their voice sits forward in what
they hear back, hit RECORD, rap the bar over the beat playing under
them, hit RECORD again to stop. The take appears in the TAKES list
immediately, playable right there. They record a second attempt, assign
it to slot B, and use COMPARE A/B to switch back and forth between the
two takes to decide which one to keep, deleting the one they don't want.

## SCREW — chop and screw

Two fully independent decks, side by side, each able to load its own
song. This tab exists to recreate — properly, not as a gimmick — the
chopped-and-screwed style pioneered in Houston by DJ Screw in the
1990s: taking a song and slowing it down dramatically, which on a real
turntable drops the pitch right along with the tempo (a slower spinning
record is physically a lower pitch), producing that thick, syrupy,
almost-underwater sound, and then manually "chopping" — stuttering,
rewinding, and looping short phrases live rather than letting the song
play straight through.

Each deck has:

- **LOAD** — pick a file for that deck (or send one over from SONGS,
  see above).
- **PLAY / PAUSE** and a waveform display of the loaded audio.
- **SCREW SPEED** — a slider from 1.0x (normal) down to 0.5x (half
  speed). Because this is a genuine playback-rate change rather than a
  modern pitch-corrected time-stretch, dragging it down drops the pitch
  along with the tempo — which is the authentic effect, not a
  compromise; that is exactly what DJ Screw's technique sounded like.
- **SYRUP** — a reverb toggle that adds a wet, hazy tail to the sound,
  reinforcing the "syrupy" quality of the style.
- **CHOP** — click once on the waveform to drop a loop-start marker,
  click a second time to set the loop-end, then tap CHOP to lock that
  short region in and have it repeat continuously — this is the
  "chopping": stuttering a short phrase (a word, an ad-lib, a drum
  fill) into a hypnotic loop, exactly the manual technique real DJs use
  and which no automated tool fully replaces.

Between the two decks, a **crossfader** blends how much of deck A
versus deck B comes through the output, so a user can mix or transition
between two songs live.

**Worked example:** A writer wants a slowed, chopped reference of a
reference track for mood while writing a hook. They load the track on
Deck A, drag SCREW SPEED down to about 0.75x — the song noticeably
drops in both speed and pitch, into that syrupy register — and flips on
SYRUP for extra haze. They click the waveform right before their
favorite ad-lib, click again right after it, and tap CHOP: that one
ad-lib now loops continuously, stuttering the way a DJ would work a
record by hand. Everything here plays live in the browser; nothing
about this tab uploads or saves the mixed result anywhere — it's a
performance and reference tool, not a file exporter (yet).

## PACKS — splitting a whole song into sound packs

This is the tab dedicated to taking one finished song and breaking it
into every instrument that went into it, ready to load onto the BEATS
pads. It has two sections.

**1. SPLIT A SONG** lists every file already sitting in SONGS. Tapping
**SPLIT FULL STEMS** on one links it as the active beat and pops up the
exact command to run on the user's own computer. That command runs
Demucs's 6-stem separation model — a real, free, open-source AI model —
which needs real CPU power a phone or browser tab can't provide for
free, so it's one line typed into a terminal rather than a button that
works instantly in the browser. It produces six files: **vocals**,
**drums**, **bass**, **guitar**, **piano**, and **other** (anything that
doesn't fit the first five categories) — plus the app computes a
seventh file, a mixed-down **instrumental**, by combining every
non-vocal stem back together into one track. (Guitar and piano are the
least reliable of the six to separate cleanly — even Demucs's own
documentation calls that pair experimental — so those two may carry
more artifacts than the drums, bass, vocals, and instrumental stems.)

**2. YOUR SOUND PACKS** lists every stem that's ever been split, across
every song, each with a PLAY button to preview it and eight small
numbered buttons — one per BEATS pad. Tapping a number assigns that
exact stem to that pad immediately, and it's saved to the user's
account from that point on, so it's still loaded the next time BEATS is
opened, even on a different device.

**Worked example:** A producer has a fully mixed reference track they
love the drum sound on. They upload it in SONGS, rename it "Reference
Track," switch to PACKS, and tap SPLIT FULL STEMS. They copy the
command shown, paste it into a terminal on their computer, and wait a
few minutes while Demucs downloads its 6-stem model (a one-time cost)
and processes the song. Back in PACKS, six rows now appear — VOCALS,
DRUMS, BASS, GUITAR, PIANO, OTHER — plus INSTRUMENTAL. They preview the
DRUMS stem with PLAY, like what they hear, and tap pad button **1** on
that row: it's now loaded onto BEATS pad 1, ready to trigger by tapping
it or playing the note on a connected MIDI keyboard. They do the same
for the BASS stem onto pad 2. Both choices are remembered — closing the
browser and coming back the next day, pads 1 and 2 are still loaded
with those exact sounds.

## BEATS — the pad sampler and step sequencer

An 8-pad grid, arranged four across, two down. Tapping **LOAD** under
any pad opens a file picker to assign a sound to that pad; once loaded,
tapping the pad itself plays that sound instantly, and the pad shows
which MIDI note number will trigger it. Below the pads, a **16-step
sequencer** gives each pad its own row of 16 steps — tapping a step
toggles it on or off — and a single BPM control plus a PLAY PATTERN
button runs all 8 rows together in a loop, with a live playhead
highlighting which step is currently sounding across every row at
once, so building a simple drum pattern (kick on steps 1, 5, 9, 13;
snare on 5 and 13; hi-hats on every other step, etc.) is a matter of
tapping cells in a grid.

**MIDI keyboard support:** if a MIDI controller — for example an
M-Audio Oxygen 25 — is connected over USB, the browser (Chrome or Edge
only; this does not work in Safari or on a phone) can be granted access
to it from Settings, and from then on, pressing the keyboard's keys
triggers the same 8 pads directly and in real time, using the standard
low-octave mapping drum machines and samplers use (so a controller's
lower keys just work as pads with no extra configuration).

**Worked example:** A producer drags a kick drum sample onto pad 1, a
snare onto pad 2, and a hi-hat one-shot onto pad 3 (loaded straight from
files on their computer — sound packs split earlier in the PACKS tab
work the same way, just assigned with a tap instead of a file picker).
They set BPM to 92, then build a
simple boom-bap pattern by tapping steps 1 and 9 on the kick row, step 5
and 13 on the snare row, and every other step on the hi-hat row, then
hit PLAY PATTERN and hear it loop. Wanting to add a live-played bassline
on top, they plug in an Oxygen 25, open Settings, see "Oxygen 25" appear
under MIDI DEVICES once Chrome grants access, load a bass one-shot onto
pad 4, and play that pad's note on the keyboard in time with the
pattern already looping.

## Settings

Opened from the gear icon: rhyme sensitivity (the same five levels
described under WRITE — Off, Strict, Rap, Loose, Everything, with a
one-line explanation of each shown live), a handful of display toggles
(syllable counts, flow-shift warnings, internal rhyme coloring, ignoring
text in parentheses as ad-libs), a **MIDI DEVICES** panel that lists any
connected MIDI keyboard once the browser has granted access (or
explains that MIDI isn't supported in the current browser), and sign
out.

## Help

A **?** button sits next to the gear icon everywhere in the app. Tapping
it opens an 8-step guided walkthrough — Welcome, Songs, Write, Flow,
Booth, Screw, Beats, and Settings — each with a short plain-language
explanation, navigable with Back and Next, for anyone opening the app
for the very first time without a tutorial video in front of them.

## A full example session, start to finish

A writer sits down with an idea and an instrumental they like. They:

1. Sign in.
2. Go to SONGS, upload the instrumental, rename it, tap SET AS BEAT.
3. Go to WRITE, type six bars of a verse, watching rhyme colors appear
   and using the tap-word drawer twice to swap in a stronger line.
4. Check FLOW's beat grid, notice bar 4 is marked PACKED, and go back
   to WRITE to trim it down.
5. Go to BOOTH, balance the BEAT/VOCAL mixer, and record two takes of
   the verse, comparing them with A/B before deleting the weaker one.
6. Later, on a computer, go to PACKS and run the SPLIT FULL STEMS
   command on the beat, pulling out vocals, drums, bass, guitar, piano,
   other, and a computed instrumental.
7. Back in PACKS, tap pad numbers to send the drums and bass stems onto
   BEATS pads 1 and 2 — saved there for good.
8. For fun, load the instrumental into SCREW, drop the speed to 0.7x
   with SYRUP on, and chop the hook for a slowed teaser clip.
9. Open BEATS, sketch a quick drum pattern for a different song idea
   using those same drum and bass pads on the sequencer, playing a
   melody live on top from a connected MIDI keyboard.

All of it — the verse, the takes, the beat, the settings — is exactly
where it was left the next time that account signs in, on any device.

## What's honestly not built yet

There is no generative AI co-writer — the AMMO panel offers curated,
rhyme-verified starter lines, not AI-written ones. Real stem separation
(splitting a song into its instruments) requires running a short command
on a computer rather than happening automatically in the browser,
because that kind of audio processing needs more computing power than a
phone or a browser tab can provide for free — and even then, guitar and
piano separation is the least reliable of the six stems, something
Demucs's own team calls experimental. Only one song's lyrics persist at
a time right now —
the SONGS library holds audio files and is a separate concept from the
single lyrics document in WRITE. The SCREW tab doesn't yet export a
mixed-down file — everything there plays live but isn't saved as a
finished audio file.
