"""Basic backend checks (network-dependent parts are opt-in via CODECI_BACKEND_LIVE=1)."""
import os
import unittest

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

class HealthTests(unittest.TestCase):
    def test_health_ok(self):
        r = client.get("/health")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()["ok"])
        self.assertIn("version", r.json())

    def test_sources_lists_netease(self):
        r = client.get("/sources")
        self.assertEqual(r.status_code, 200)
        self.assertIn("NeteaseMusicClient", r.json()["sources"])

    def test_search_requires_q(self):
        r = client.get("/search?q=&sources=NeteaseMusicClient")
        self.assertEqual(r.status_code, 400)

    @unittest.skipUnless(os.environ.get("CODECI_BACKEND_LIVE") == "1", "live musicdl test (CODECI_BACKEND_LIVE=1)")
    def test_search_live(self):
        r = client.get("/search?q=kanye%20west&sources=NeteaseMusicClient&limit=2")
        self.assertEqual(r.status_code, 200)
        tracks = r.json()["tracks"]
        self.assertTrue(tracks)
        self.assertTrue(tracks[0]["title"])

if __name__ == "__main__":
    unittest.main()
