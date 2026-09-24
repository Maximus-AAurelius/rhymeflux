"""Create a consistent local recovery copy without interrupting the studio."""
import argparse
import sqlite3
import zipfile
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--destination', type=Path, default=ROOT / 'data/backups')
args = parser.parse_args()
args.destination.mkdir(parents=True, exist_ok=True)
stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
snapshot = args.destination / (stamp + '.sqlite3')
source = sqlite3.connect(ROOT / 'data/screwshop.sqlite3')
target = sqlite3.connect(snapshot)
try:
    source.backup(target)
finally:
    target.close()
    source.close()
archive = args.destination / ('ScrewShop-' + stamp + '.zip')
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as z:
    z.write(snapshot, 'screwshop.sqlite3')
    for folder in ['audio', 'Obsidian']:
        for path in (ROOT / 'data' / folder).rglob('*'):
            if path.is_file():
                z.write(path, str(path.relative_to(ROOT / 'data')))
    for path in (ROOT / 'Beats').rglob('*'):
        if path.is_file():
            z.write(path, str(path.relative_to(ROOT)))
print(archive)
