"""Start only ScrewShop's local service, hidden, for the Windows login task."""
import json
import argparse
import time
import subprocess
import urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent

def main():
    try:
        with urllib.request.urlopen('http://127.0.0.1:5050/api/status', timeout=3) as response:
            if json.load(response).get('project') == 'ScrewShop':
                return
    except Exception:
        pass
    data = ROOT / 'data'
    data.mkdir(exist_ok=True)
    with (data / 'server.log').open('ab') as log:
        subprocess.Popen([str(ROOT / '.venv/Scripts/pythonw.exe'), str(ROOT / 'scripts/local_server.py'), '--lan', '--https-port', '5443'], cwd=ROOT, stdin=subprocess.DEVNULL, stdout=log, stderr=log, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--watch', action='store_true')
    args = parser.parse_args()
    if args.watch:
        # A single GUI-subsystem process stays alive; no minute-by-minute console launches.
        import ctypes
        mutex = ctypes.windll.kernel32.CreateMutexW(None, False, 'Local\\ScrewShopWatchdog')
        if ctypes.windll.kernel32.GetLastError() == 183:
            raise SystemExit(0)
        while True:
            try:
                main()
            except Exception:
                pass
            time.sleep(60)
    else:
        main()
