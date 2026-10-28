"""Pruebas del servidor real de PowerShell; no requiere instalar Python en el CRM."""
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
import unittest
from urllib.error import HTTPError
from urllib.request import ProxyHandler, Request, build_opener

PWSH = os.environ.get("AERCOM_PWSH") or shutil.which("pwsh") or shutil.which("powershell.exe")


@unittest.skipUnless(PWSH, "Configurar AERCOM_PWSH o disponer de PowerShell para ejecutar estas pruebas")
class PowerShellServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        probe = socket.socket()
        try:
            probe.bind(("127.0.0.1", 8000))
        except OSError:
            raise unittest.SkipTest("El puerto 8000 debe estar libre; no se detienen servidores del usuario")
        finally:
            probe.close()
        cls.temp = tempfile.TemporaryDirectory(prefix="aercom ps prueba ")
        cls.addClassCleanup(cls.temp.cleanup)
        cls.root = Path(cls.temp.name) / "CRM con espacios y ñ"
        cls.root.mkdir()
        script = Path(__file__).resolve().parents[1] / "iniciar_crm_windows.ps1"
        shutil.copyfile(script, cls.root / script.name)
        (cls.root / "index.html").write_text("<h1>Aercom prueba</h1>", encoding="utf-8")
        (cls.root / "js").mkdir()
        (cls.root / "js" / "á.js").write_text("window.prueba=1;", encoding="utf-8")
        (cls.root / "privado.json").write_text("no servir", encoding="utf-8")
        for folder in [".git", "backups", "attachments"]:
            (cls.root / folder).mkdir()
            (cls.root / folder / "privado").write_text("no servir", encoding="utf-8")
        cls.env = dict(os.environ, POWERSHELL_TELEMETRY_OPTOUT="1")
        for kind in ["CACHE", "CONFIG", "DATA"]:
            cls.env.setdefault(f"XDG_{kind}_HOME", str(Path(cls.temp.name) / kind))
        cls.command = [PWSH, "-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(cls.root / script.name), "-NoBrowser"]
        cls.server = subprocess.Popen(cls.command, env=cls.env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        cls.addClassCleanup(cls.stop_server)
        cls.client = build_opener(ProxyHandler({}))
        cls.url = "http://127.0.0.1:8000"
        for _ in range(50):
            if cls.server.poll() is not None:
                raise RuntimeError(cls.server.stdout.read().decode(errors="replace"))
            try:
                with cls.client.open(cls.url + "/", timeout=0.5) as response:
                    if response.status == 200:
                        return
            except OSError:
                time.sleep(0.1)
        raise RuntimeError("PowerShell no inició el servidor")

    @classmethod
    def stop_server(cls):
        if cls.server.poll() is None:
            cls.server.terminate()
            cls.server.wait(timeout=5)
        cls.server.stdout.close()

    def test_index_and_no_cache(self):
        with self.client.open(self.url + "/") as response:
            self.assertEqual(response.headers["Cache-Control"], "no-store")
            self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
            self.assertIn(b"Aercom prueba", response.read())

    def test_head_mime_unicode_and_query(self):
        with self.client.open(Request(self.url + "/js/%C3%A1.js?v=1", method="HEAD")) as response:
            self.assertIn("javascript", response.headers["Content-Type"])
            self.assertGreater(int(response.headers["Content-Length"]), 0)
            self.assertEqual(response.read(), b"")
        with self.client.open(self.url + "/js/%C3%A1.js") as response:
            self.assertEqual(response.read(), b"window.prueba=1;")

    def test_private_paths_and_encoded_traversal(self):
        for path in ["/.git/privado", "/attachments/privado", "/backups/privado", "/privado.json", "/js/../index.html", "/js/%2e%2e/index.html", "/js/%5c..%5c.git%5cprivado", "/js/a%00.js", "/js/a%3ab.js"]:
            with self.subTest(path=path), self.assertRaises(HTTPError) as error:
                self.client.open(self.url + path)
            self.assertEqual(error.exception.code, 403)

    def test_missing_and_directory_do_not_list_files(self):
        for path in ["/js/", "/js/inexistente.js"]:
            with self.assertRaises(HTTPError) as error:
                self.client.open(self.url + path)
            self.assertEqual(error.exception.code, 404)

    def test_writes_denied_and_server_continues(self):
        for method in ["POST", "PUT", "DELETE"]:
            with self.assertRaises(HTTPError) as error:
                self.client.open(Request(self.url + "/index.html", method=method, data=b"no escribir"))
            self.assertEqual(error.exception.code, 405)
        self.assertIn("Aercom prueba", (self.root / "index.html").read_text())
        with self.client.open(self.url + "/") as response:
            self.assertEqual(response.status, 200)

    def test_links_are_denied(self):
        link = self.root / "js" / "enlace.js"
        try:
            link.symlink_to(self.root / "privado.json")
        except OSError:
            self.skipTest("Este sistema no permite crear enlaces sin privilegios")
        with self.assertRaises(HTTPError) as error:
            self.client.open(self.url + "/js/enlace.js")
        self.assertEqual(error.exception.code, 403)

    def test_occupied_port_is_not_changed(self):
        result = subprocess.run(self.command, env=self.env, capture_output=True, timeout=10)
        self.assertEqual(result.returncode, 1)
        self.assertIn(b"127.0.0.1:8000", result.stdout)

    def test_oversized_headers_are_rejected(self):
        with self.assertRaises(HTTPError) as error:
            self.client.open(Request(self.url + "/", headers={"X-Prueba": "a" * 17000}))
        self.assertEqual(error.exception.code, 431)


if __name__ == "__main__":
    unittest.main()
