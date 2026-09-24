"""Run real Demucs on generated audio, with a separate test library."""
import math
import struct
import sys
import threading
import time
import wave
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from local_store import Store
from local_server import worker

store = Store(ROOT / 'test-results/split-check')
path = store.asset('beats', 'local/synthetic.wav')
path.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(path), 'wb') as out:
    out.setnchannels(2); out.setsampwidth(2); out.setframerate(44100)
    frames = bytearray()
    for i in range(44100 * 2):
        value = int(6000 * math.sin(2 * math.pi * 220 * i / 44100) + 2000 * math.sin(2 * math.pi * 440 * i / 44100))
        frames.extend(struct.pack('<hh', value, value))
    out.writeframes(frames)
beat = store.query({'table':'beats', 'action':'upsert', 'values':{'id':'synthetic-beat','storage_path':'local/synthetic.wav'}, 'single':'required'})
stop = threading.Event()
thread = threading.Thread(target=worker, args=(store, stop), daemon=True)
thread.start()
try:
    for mode in ['quick', 'full']:
        job = store.query({'table':'split_jobs','action':'insert','values':{'beat_id':beat['id'],'mode':mode},'single':'required'})
        print(f'{mode}: queued {job["id"]}', flush=True)
        last = None
        for _ in range(360):
            current = store.query({'table':'split_jobs','filters':[['id',job['id']]],'single':'required'})
            if current['status'] != last:
                print(f'{mode}: {current["status"]}', flush=True)
                last = current['status']
            if current['status'] == 'error':
                raise RuntimeError(current.get('error_message'))
            if current['status'] == 'done':
                stems = [s for s in store.query({'table':'stems','filters':[['beat_id',beat['id']]]}) if job['id'] in s['storage_path']]
                assert len(stems) == (2 if mode == 'quick' else 7), stems
                for stem in stems:
                    with wave.open(str(store.asset('stems',stem['storage_path'])), 'rb') as audio:
                        assert audio.getnframes() > 0
                print(f'{mode}: verified {len(stems)} real playable WAV outputs', flush=True)
                break
            time.sleep(2)
        else:
            raise TimeoutError('Split did not complete in 12 minutes')
finally:
    stop.set()
    thread.join(timeout=5)
