# Using NotebookLM to make Barwork tutorial videos

## How to use this

1. Go to notebooklm.google.com, create a new notebook.
2. Add a source: paste the whole "SOURCE MATERIAL" section below as a single text source (or paste it into a Google Doc and add that).
3. Click **Video Overview** (or **Audio Overview**) and paste one of the two **Customize** prompts below into the customization box before generating.
4. Generate Video 1 first, then start a fresh Video Overview in the same notebook and generate Video 2 with its prompt.

---

## Customize prompt — Video 1: "Barwork: Write, Beat, Record"

```
Make this a friendly, practical tutorial video for a rapper who has never
used Barwork before. Focus only on the songwriting workflow: signing in,
the Songs file library, writing bars in the Write tab with live rhyme
highlighting, loading a beat in Flow, and recording vocal takes in Booth
with the Beat/Vocal mixer. Walk through it in the order a new user would
actually do it: sign in, write a verse, load a beat, record over it.
Explain WHY the rhyme highlighting and syllable counter are useful for
writing rap specifically, not just as generic app features. Skip Screw
and Beats entirely - those are covered in a separate video. Keep it under
8 minutes. Assume the viewer is a musician, not a programmer - don't
explain technical implementation, just what to click and why it helps.
```

## Customize prompt — Video 2: "Barwork: Chop, Screw, and the Sampler"

```
Make this a friendly, practical tutorial video for a rapper who already
knows the basics of Barwork (writing, beats, recording) and wants to learn
the production tools: the SCREW tab and the BEATS tab. Explain the history
in one sentence (DJ Screw, Houston, chopped and screwed) then show how to
actually use it: loading two decks, the SCREW SPEED slider, SYRUP reverb,
setting a loop with two clicks and hitting CHOP, and the crossfader. Then
cover BEATS: loading sounds onto pads, building a pattern on the 16-step
sequencer, and connecting a MIDI keyboard (like an M-Audio Oxygen 25) so
its keys trigger the pads live - mention this needs Chrome or Edge on a
computer, not a phone. Keep it under 8 minutes. Assume the viewer is a
musician, not a programmer.
```

---

## SOURCE MATERIAL (paste everything below this line into NotebookLM as a source)

### What Barwork is

Barwork is a private, single-account rap writing and production studio that
runs in a web browser. It's not a commercial product - it's a personal tool
for one rapper to write, record, chop, and sample in one place, and have
everything sync between their phone and their computer. Signing in requires
an account (email + password); all data is private to that account.

### Getting in

Open the app and sign in, or create an account the first time (email +
password, with an email confirmation step). Everything from here on is
private to that one account and follows the user between devices.

### The transport bar (top of every screen)

Whenever a beat is loaded, a control strip appears just under the header,
visible on every tab: rewind 5 seconds, stop, play/pause, forward 5
seconds, and record (grouped in one bordered cluster, like a hardware
transport); a time display; a scrub bar to jump anywhere in the track; a
tempo slider that changes playback speed from half to one-and-a-half
times without changing the pitch (so slowing down to practice a verse
doesn't sound chipmunked); and a loop toggle. This bar controls the
active beat no matter which tab is open, and the record button captures
a vocal take from anywhere, not just from the Booth tab.

### SONGS — the project folder

This is a file library. Upload any MP3 or WAV and it appears as a row
that can be renamed right there. Each file has action buttons:
- **SET AS BEAT** loads it into the transport bar so it plays and can be
  written/recorded over.
- **DECK A / DECK B** sends it straight to a SCREW deck.
- **EXTRACT STEMS** links it as the active beat and tells the user the
  exact command to run on their own computer to split it into vocal and
  instrumental stems (this uses a free open-source tool called Demucs
  that needs real computing power, so it runs locally, not in the
  browser - the app shows the exact command to copy).
- **DELETE** removes it.

### WRITE — the lyrics editor

A line-by-line bar editor. As the user types, words that rhyme with each
other light up in matching colors automatically, using a real
sound-based rhyme engine (not just spelling) that catches slant rhymes
like "Bugatti" and "body." Tapping any colored word opens a drawer with
more rhymes, same-syllable word swaps, and full phrase suggestions -
tapping one drops it into the line. Each bar shows a live syllable
count on the right so the writer can see when a bar is running long
compared to the rest of the verse. Everything autosaves.

### FLOW — the beat and song structure

Shows the loaded beat (with a YouTube-link mode and a local-file mode),
a 4/4 beat grid mapping each bar's density against the song, and a
STEMS panel that plays back vocal/instrumental stems once they've been
extracted (see SONGS above). This is where the beat lives conceptually,
though it's actually controlled from the transport bar everywhere.

### BOOTH — recording

A two-channel mixer at the top: BEAT and VOCAL, each with a real volume
fader, mute, and solo that actually affect what's playing (not just
decoration). Below that, a record button captures audio from the
microphone as a "take" tied to a bar; takes list underneath with play
and delete, and an A/B compare slot to line two takes up against each
other.

### SCREW — chop and screw

Two independent turntable-style decks. Load a song on either deck, and
a SCREW SPEED slider slows it down from full speed to half speed - and
because it's a genuine playback-speed change (not a modern
pitch-corrected time-stretch), the pitch drops along with the tempo,
which is the authentic "chopped and screwed" sound DJ Screw pioneered
in Houston by physically slowing down the turntable. A SYRUP toggle
adds reverb for that soaked, hazy tone. Clicking the waveform once
drops a loop-start marker, clicking again sets the loop-end, and
hitting CHOP locks that loop in and plays it on repeat - the manual,
performative "chopping" DJ Screw did by hand. A crossfader blends
between the two decks. Nothing here uploads anywhere; it's all live, in
the browser.

### BEATS — the sampler

An 8-pad sampler grid. Load any sound onto a pad and tap it to play. A
16-step sequencer sits below each pad - tapping steps builds a loop,
and a shared BPM control with a play button runs the whole pattern with
accurate timing, showing a live playhead moving across the grid. If a
MIDI keyboard is connected (like an M-Audio Oxygen 25) over USB, its
keys trigger the same 8 pads directly, using the standard drum-machine
note range. This only works in Chrome or Edge on a computer (not
Safari, not mobile) because of how browsers handle MIDI hardware.

### Settings

Rhyme sensitivity (how strict the rhyme-matching is, from perfect
rhymes only to loose assonance), a few display toggles, a MIDI DEVICES
panel that lists any connected MIDI keyboard once the browser grants
access, and sign out.

### Help

A "?" button next to Settings opens a step-by-step walkthrough of every
tab, for anyone opening the app for the first time.

### What's honestly not built yet

There's no AI co-writer. Pad sounds in BEATS don't save between
sessions yet - they're loaded fresh each time for now. Stem separation
(splitting a song into vocals and instrumental) requires running a
short command on a computer; it doesn't happen automatically in the
browser because that kind of audio processing needs more computing
power than a phone or browser can provide for free. Only one song's
lyrics persist right now - the SONGS library is for audio files, kept
separate from the lyrics document.
