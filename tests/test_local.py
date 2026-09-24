import json
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from local_store import Store
from local_server import make_server


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def test_song_survives_reopen_and_exports_markdown(self):
        lines = ["ScrewShop test bar", "<script>not executable</script>"]
        self.store.query({"table": "songs", "action": "upsert", "values": {"id": "test-song", "title": "Test", "meta": json.dumps({"lines": lines})}})
        reopened = Store(self.temp.name)
        song = reopened.query({"table": "songs", "single": "required"})
        self.assertEqual(json.loads(song["meta"])["lines"], lines)
        self.assertIn(lines[0], (Path(self.temp.name) / "Obsidian/Songs/test-song.md").read_text())

    def test_paths_cannot_escape_audio_root(self):
        for name in ["../secret", "a/../../secret", "C:/secret", "a\\..\\secret", "/absolute", "a//b"]:
            with self.subTest(name=name), self.assertRaises(ValueError):
                self.store.asset("beats", name)

    def test_duplicate_split_is_one_job_and_one_claim(self):
        path = self.store.asset("beats", "local/test.wav")
        path.parent.mkdir(parents=True)
        path.write_bytes(b"test")
        beat = self.store.query({"table": "beats", "action": "insert", "values": {"storage_path": "local/test.wav"}, "single": "required"})
        query = {"table": "split_jobs", "action": "insert", "values": {"beat_id": beat["id"], "mode": "quick"}, "single": "required"}
        with ThreadPoolExecutor(4) as pool:
            jobs = list(pool.map(lambda _: self.store.query(query), range(4)))
        self.assertEqual(len({j["id"] for j in jobs}), 1)
        with ThreadPoolExecutor(4) as pool:
            claimed = list(pool.map(lambda _: self.store.claim_job(), range(4)))
        self.assertEqual(sum(j is not None for j in claimed), 1)

    def test_job_validation_and_filtered_updates(self):
        with self.assertRaises(ValueError):
            self.store.query({"table": "split_jobs", "action": "insert", "values": {"beat_id": "missing", "mode": "quick"}})
        with self.assertRaises(ValueError):
            self.store.query({"table": "songs", "action": "delete"})
        with self.assertRaises(ValueError):
            self.store.query({"table": "songs; DROP TABLE records"})


class HttpTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.server = make_server(self.temp.name, port=0)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.thread.join()
        self.server.server_close()
        self.temp.cleanup()

    def request(self, path, body=None, headers=None):
        req = urllib.request.Request(self.base + path, data=body, headers=headers or {})
        try:
            return urllib.request.urlopen(req)
        except urllib.error.HTTPError as error:
            return error

    def test_host_and_origin_boundaries(self):
        self.assertEqual(self.request('/api/status', headers={"Host": "attacker.example"}).status, 403)
        body = json.dumps({"table": "songs", "action": "select"}).encode()
        self.assertEqual(self.request('/api/query', body, {"X-ScrewShop": "1", "Origin": "https://attacker.example"}).status, 403)
        self.assertEqual(self.request('/api/query', body).status, 403)
        self.assertEqual(self.request('/api/query', body, {"X-ScrewShop": "1", "Content-Type": "application/json"}).status, 200)

    def test_private_paths_and_audio_ranges(self):
        for path in ["/.env", "/data/screwshop.sqlite3", "/../data/phone-pairing-code.txt", "/archive/barwork-native-backend/.env"]:
            self.assertEqual(self.request(path).status, 404)
        self.assertEqual(self.request('/api/audio/beats/local/test.wav', b"0123456789", {"X-ScrewShop": "1"}).status, 200)
        response = self.request('/audio/beats/local/test.wav', headers={"Range": "bytes=2-5"})
        self.assertEqual(response.status, 206)
        self.assertEqual(response.read(), b"2345")
        self.assertEqual(self.request('/audio/beats/local/test.wav', headers={"Range": "bytes=99-100"}).status, 416)


if __name__ == "__main__":
    unittest.main()
