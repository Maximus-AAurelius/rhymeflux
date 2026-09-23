#!/usr/bin/env python3
"""
Background worker for Barwork's PACKS tab. Leave this running in a
terminal (or set it to start with your computer) and you never touch a
command again — tapping QUICK SPLIT or FULL SPLIT in the app queues a
job, and whichever computer has this script running picks it up, runs
Demucs, and uploads the results automatically.

Setup (once):
    pip install demucs supabase soundfile numpy

Usage:
    python scripts/split_worker.py

You'll be prompted once for your Rhymeflux email/password (or set
RHYMEFLUX_EMAIL / RHYMEFLUX_PASSWORD as environment variables so you can
just double-click a shortcut to this script). It then checks for new
jobs every few seconds until you close it with Ctrl+C.

QUICK jobs produce vocals + instrumental (fast, smaller model).
FULL jobs produce vocals, drums, bass, guitar, piano, other, plus a
computed instrumental (everything except vocals, mixed back together) —
slower, and the first FULL job also downloads a second model file.
"""
import os
import sys
import time
import getpass
import subprocess
import tempfile
from pathlib import Path

SUPABASE_URL = "https://ekmtrlnjlpxornkeyzlz.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable__f6iHjAypO7t6FEdKxXAIw_QqHtAWmy"
POLL_SECONDS = 5


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


def process_job(sb, uid, job, tmp_root):
    beat = sb.table("beats").select("*").eq("id", job["beat_id"]).single().execute().data
    if not beat or not beat.get("storage_path"):
        raise RuntimeError("beat has no source file to split")

    src_bytes = sb.storage.from_("beats").download(beat["storage_path"])
    src_name = Path(beat["storage_path"]).name
    src_dir = Path(tmp_root) / "source"
    src_dir.mkdir(parents=True, exist_ok=True)
    src_path = src_dir / src_name
    src_path.write_bytes(src_bytes)

    if job["mode"] == "quick":
        print("  Running Demucs, quick mode (vocals + instrumental)...")
        subprocess.run(
            [sys.executable, "-m", "demucs", "--two-stems", "vocals", "-o", tmp_root, str(src_path)],
            check=True,
        )
        stem_dir = Path(tmp_root) / "htdemucs" / src_path.stem
        pairs = [("vocals", stem_dir / "vocals.wav"), ("instrumental", stem_dir / "no_vocals.wav")]
    else:
        print("  Running Demucs, full split (vocals, drums, bass, guitar, piano, other)...")
        subprocess.run(
            [sys.executable, "-m", "demucs", "-n", "htdemucs_6s", "-o", tmp_root, str(src_path)],
            check=True,
        )
        stem_dir = Path(tmp_root) / "htdemucs_6s" / src_path.stem
        names = ["vocals", "drums", "bass", "guitar", "piano", "other"]
        pairs = [(n, stem_dir / f"{n}.wav") for n in names]
        non_vocal = [stem_dir / f"{n}.wav" for n in names if n != "vocals" and (stem_dir / f"{n}.wav").exists()]
        if non_vocal:
            print("  Mixing down the instrumental...")
            instrumental_path = stem_dir / "instrumental.wav"
            mix_instrumental(non_vocal, instrumental_path)
            pairs.append(("instrumental", instrumental_path))

    for kind, path in pairs:
        if not path.exists():
            print(f"  Expected stem missing: {path}")
            continue
        storage_path = f"{uid}/{job['beat_id']}/{kind}.wav"
        with open(path, "rb") as f:
            sb.storage.from_("stems").upload(
                storage_path, f, {"upsert": "true", "content-type": "audio/wav"}
            )
        sb.table("stems").upsert(
            {"user_id": uid, "beat_id": job["beat_id"], "kind": kind, "storage_path": storage_path},
            on_conflict="beat_id,kind",
        ).execute()
        print(f"  Uploaded {kind}")


def main():
    from supabase import create_client

    email = os.environ.get("RHYMEFLUX_EMAIL") or input("Rhymeflux email: ")
    password = os.environ.get("RHYMEFLUX_PASSWORD") or getpass.getpass("Rhymeflux password: ")

    sb = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    auth = sb.auth.sign_in_with_password({"email": email, "password": password})
    uid = auth.user.id
    print(f"Signed in as {email}. Watching for split jobs — leave this running.")
    print("Press Ctrl+C to stop.\n")

    while True:
        try:
            jobs = (
                sb.table("split_jobs")
                .select("*")
                .eq("status", "pending")
                .order("created_at")
                .execute()
                .data
            )
            for job in jobs:
                print(f"New {job['mode']} job for beat {job['beat_id']}...")
                sb.table("split_jobs").update({"status": "processing"}).eq("id", job["id"]).execute()
                try:
                    with tempfile.TemporaryDirectory() as tmp:
                        process_job(sb, uid, job, tmp)
                    sb.table("split_jobs").update({"status": "done"}).eq("id", job["id"]).execute()
                    print("Done.\n")
                except Exception as e:
                    sb.table("split_jobs").update(
                        {"status": "error", "error_message": str(e)[:500]}
                    ).eq("id", job["id"]).execute()
                    print(f"Job failed: {e}\n")
        except KeyboardInterrupt:
            raise
        except Exception as e:
            print(f"Couldn't check for jobs (will retry): {e}")
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopped.")
