#!/usr/bin/env python3
"""
Split a song into stems with Demucs and upload them to Rhymeflux's
Supabase storage so they show up in the app's PACKS (Sound Pack Maker)
and FLOW tabs, and can be assigned straight onto BEATS pads.

Setup (once):
    pip install demucs supabase soundfile numpy

Usage:
    python split_stems.py path\\to\\song.mp3            # full split (default)
    python split_stems.py path\\to\\song.mp3 --quick     # fast: vocals + instrumental only

Full split (default) uses Demucs's 6-stem model and produces:
    vocals, drums, bass, guitar, piano, other, and a computed
    "instrumental" mix (everything except vocals, summed together).
This downloads a second, separate model file the first time it runs
and takes longer than the quick mode, since it's separating into more
parts. Guitar and piano are the least reliable of the six — Demucs
itself calls that model experimental.

--quick uses the smaller 4-stem-family model in two-stem mode and only
produces vocals + instrumental, same as before — useful when you just
want a clean instrumental fast and don't need individual instruments.

You'll be prompted for your Rhymeflux email/password (the same account
you sign in with on the site), unless RHYMEFLUX_EMAIL / RHYMEFLUX_PASSWORD
are set as environment variables. Nothing is ever stored in this file.

This only works AFTER you've loaded this same song in the app (SONGS tab,
or FLOW tab -> MY FILE) so there's a beat in the cloud to attach stems to.
"""
import os
import sys
import getpass
import subprocess
import tempfile
from pathlib import Path

SUPABASE_URL = "https://ekmtrlnjlpxornkeyzlz.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable__f6iHjAypO7t6FEdKxXAIw_QqHtAWmy"
SONG_UUID = "11111111-1111-4111-8111-111111111111"


def mix_instrumental(paths, out_path):
    import numpy as np
    import soundfile as sf

    data = None
    sr = None
    for p in paths:
        d, this_sr = sf.read(p, always_2d=True)
        sr = sr or this_sr
        if data is None:
            data = d
        else:
            n = max(len(data), len(d))
            if len(data) < n:
                data = np.pad(data, ((0, n - len(data)), (0, 0)))
            if len(d) < n:
                d = np.pad(d, ((0, n - len(d)), (0, 0)))
            data = data + d
    peak = float(max(1.0, abs(data).max()))
    if peak > 1.0:
        data = data / peak
    sf.write(out_path, data, sr)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    quick = "--quick" in sys.argv
    if len(args) != 1:
        print("Usage: python split_stems.py <path-to-audio-file> [--quick]")
        sys.exit(1)
    src = Path(args[0]).expanduser().resolve()
    if not src.exists():
        print(f"File not found: {src}")
        sys.exit(1)

    from supabase import create_client

    email = os.environ.get("RHYMEFLUX_EMAIL") or input("Rhymeflux email: ")
    password = os.environ.get("RHYMEFLUX_PASSWORD") or getpass.getpass("Rhymeflux password: ")

    sb = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    auth = sb.auth.sign_in_with_password({"email": email, "password": password})
    uid = auth.user.id
    print(f"Signed in as {email}")

    beats = (
        sb.table("beats")
        .select("*")
        .eq("song_id", SONG_UUID)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not beats.data:
        print("No beat found in the cloud yet.")
        print("Load this song in the app first (SONGS tab, or FLOW tab -> MY FILE), then re-run this script.")
        sys.exit(1)
    beat = beats.data[0]
    beat_id = beat["id"]
    print(f"Attaching stems to: {beat.get('label') or beat_id}")

    with tempfile.TemporaryDirectory() as tmp:
        if quick:
            print("Running Demucs, quick mode (vocals + instrumental only)...")
            subprocess.run(
                [sys.executable, "-m", "demucs", "--two-stems", "vocals", "-o", tmp, str(src)],
                check=True,
            )
            stem_dir = Path(tmp) / "htdemucs" / src.stem
            pairs = [("vocals", stem_dir / "vocals.wav"), ("instrumental", stem_dir / "no_vocals.wav")]
        else:
            print("Running Demucs, full split: vocals, drums, bass, guitar, piano, other...")
            print("(first run also downloads the 6-stem model — this can take a while)")
            subprocess.run(
                [sys.executable, "-m", "demucs", "-n", "htdemucs_6s", "-o", tmp, str(src)],
                check=True,
            )
            stem_dir = Path(tmp) / "htdemucs_6s" / src.stem
            names = ["vocals", "drums", "bass", "guitar", "piano", "other"]
            pairs = [(n, stem_dir / f"{n}.wav") for n in names]

            non_vocal = [stem_dir / f"{n}.wav" for n in names if n != "vocals" and (stem_dir / f"{n}.wav").exists()]
            if non_vocal:
                print("Mixing down the instrumental (everything except vocals)...")
                instrumental_path = stem_dir / "instrumental.wav"
                mix_instrumental(non_vocal, instrumental_path)
                pairs.append(("instrumental", instrumental_path))

        for kind, path in pairs:
            if not path.exists():
                print(f"Expected stem missing: {path}")
                continue
            storage_path = f"{uid}/{beat_id}/{kind}.wav"
            with open(path, "rb") as f:
                sb.storage.from_("stems").upload(
                    storage_path, f, {"upsert": "true", "content-type": "audio/wav"}
                )
            sb.table("stems").upsert(
                {"user_id": uid, "beat_id": beat_id, "kind": kind, "storage_path": storage_path},
                on_conflict="beat_id,kind",
            ).execute()
            print(f"Uploaded {kind} -> {storage_path}")

    print("Done. Open the app's PACKS tab to hear everything and load pieces onto your BEATS pads.")


if __name__ == "__main__":
    main()
