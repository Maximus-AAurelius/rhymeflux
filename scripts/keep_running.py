"""Scheduled health check: keeps the Barwork static server (port 5050)
and the PACKS split worker running. Mirrors the same watchdog pattern
TexasInvestors uses (scripts/keep_running.py there) - a repeating
scheduled task calls this every minute or so; it starts whatever isn't
already running, hidden, and does nothing if everything's already up.

The split worker only starts if RHYMEFLUX_EMAIL / RHYMEFLUX_PASSWORD are
already set as persistent environment variables (setx ... once, from a
terminal - see README.md). Without those, this script just keeps the
static server alive and leaves the worker alone rather than guessing.
"""
import os
import socket
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def is_port_open(host, port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        return s.connect_ex((host, port)) == 0


def is_worker_running():
    try:
        out = subprocess.run(
            ["powershell", "-NoProfile", "-Command",
             "(Get-CimInstance Win32_Process -Filter \"Name='python.exe'\").CommandLine"],
            capture_output=True, text=True, timeout=15,
        ).stdout
        return "split_worker.py" in out
    except Exception:
        return False


def start_hidden(args, cwd, log_name, env=None):
    log_path = ROOT / "scripts" / log_name
    with open(log_path, "ab") as log:
        subprocess.Popen(
            args, cwd=cwd, env=env or os.environ.copy(),
            stdin=subprocess.DEVNULL, stdout=log, stderr=log,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )


NPX = r"C:\Program Files\nodejs\npx.cmd"


def main():
    if not is_port_open("127.0.0.1", 5050):
        start_hidden([NPX, "serve", "-l", "5050", "."], str(ROOT / "docs"), "serve.log")

    if not is_worker_running():
        if os.environ.get("RHYMEFLUX_EMAIL") and os.environ.get("RHYMEFLUX_PASSWORD"):
            start_hidden([sys.executable, str(ROOT / "scripts" / "split_worker.py")], str(ROOT), "worker.log")


if __name__ == "__main__":
    main()
