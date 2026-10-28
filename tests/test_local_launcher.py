import importlib.util
from pathlib import Path
from threading import Thread
import unittest
from urllib.error import HTTPError
from urllib.request import ProxyHandler, Request, build_opener

spec = importlib.util.spec_from_file_location("launcher", Path(__file__).resolve().parents[1] / "iniciar_crm.py")
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)


class LocalServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = launcher.create_server(0)
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}"
        cls.client = build_opener(ProxyHandler({}))

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def test_binds_loopback_and_serves_index_without_cache(self):
        self.assertEqual(self.server.server_address[0], "127.0.0.1")
        with self.client.open(self.url + "/") as response:
            self.assertEqual(response.headers["Cache-Control"], "no-store")
            self.assertIn(b"js/vendor/", response.read())

    def test_javascript_mime_and_head(self):
        with self.client.open(Request(self.url + "/js/vendor/chart.umd-4.4.1.js", method="HEAD")) as response:
            self.assertIn("javascript", response.headers["Content-Type"])
            self.assertEqual(response.read(), b"")

    def test_private_paths_and_traversal_are_denied(self):
        for path in ["/.git/config", "/attachments/private.json", "/backups/aercom-data.json", "/js/../index.html", "/js/%2e%2e/index.html"]:
            with self.assertRaises(HTTPError) as error:
                self.client.open(self.url + path)
            self.assertEqual(error.exception.code, 403)

    def test_post_is_not_supported(self):
        with self.assertRaises(HTTPError) as error:
            self.client.open(Request(self.url + "/index.html", data=b"no escribir", method="POST"))
        self.assertEqual(error.exception.code, 501)

    def test_occupied_port_is_not_silently_changed(self):
        with self.assertRaises(OSError):
            launcher.create_server(self.server.server_port)


if __name__ == "__main__":
    unittest.main()
