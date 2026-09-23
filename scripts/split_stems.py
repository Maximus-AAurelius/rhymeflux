#!/usr/bin/env python3
"""
Split a beat into vocal/instrumental stems with Demucs and upload the
results to Rhymeflux's Supabase storage so they show up in the app's
FLOW tab under STEMS.

Setup (once):
    pip install demucs supabase

Usage:
    python split_stems.py path\\to\\beat.mp3

You'll be prompted for your Rhymeflux email/password (the same account
you sign in with on the site), unless RHYMEFLUX_EMAIL / RHYMEFLUX_PASSWORD
are set as environment variables. Nothing is ever stored in this file.

This only works AFTER you've loaded this same beat in the app itself
(FLOW tab -> MY FILE -> choose the file) so there's a beat in the cloud
to attach the stems to.
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


def main():
    if len(sys.argv) != 2:
        print("Usage: python split_stems.py <path-to-audio-file>")
        sys.exit(1)
    src = Path(sys.argv[1]).expanduser().resolve()
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
        print("Load this beat in the app first (FLOW tab -> MY FILE), then re-run this script.")
        sys.exit(1)
    beat = beats.data[0]
    beat_id = beat["id"]
    print(f"Attaching stems to beat: {beat.get('label') or beat_id}")

    with tempfile.TemporaryDirectory() as tmp:
        print("Running Demucs (this can take a few minutes on CPU)...")
        subprocess.run(
            [sys.executable, "-m", "demucs", "--two-stems", "vocals", "-o", tmp, str(src)],
            check=True,
        )
        # demucs writes to <tmp>/htdemucs/<filename-without-ext>/{vocals,no_vocals}.wav
        stem_dir = Path(tmp) / "htdemucs" / src.stem
        pairs = [("vocals", stem_dir / "vocals.wav"), ("instrumental", stem_dir / "no_vocals.wav")]

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

    print("Done. Open the app's FLOW tab — the stems will show up under STEMS.")


if __name__ == "__main__":
    main()
