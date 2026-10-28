"""Servidor local del CRM. Solo Python 3 estándar; sin instalación de paquetes."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Timer
from urllib.parse import unquote, urlsplit
import sys
import webbrowser

ROOT = Path(__file__).resolve().parent
ADDRESS = "127.0.0.1"
PORT = 8000


class CRMHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # Evitar llenar la consola con cada recurso o registrar nombres de archivos.
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def send_head(self):
        path = unquote(urlsplit(self.path).path)
        parts = path.strip("/").split("/")
        if "\\" in path or "\x00" in path or any(p.startswith(".") for p in parts):
            self.send_error(403)
            return None
        relative = path.lstrip("/") or "index.html"
        if parts[0] not in ("", "index.html", "js", "css", "img"):
            self.send_error(403)
            return None
        target = (ROOT / relative).resolve()
        if not target.is_relative_to(ROOT) or not target.is_file():
            self.send_error(404)
            return None
        return super().send_head()


def create_server(port=PORT):
    return ThreadingHTTPServer((ADDRESS, port), partial(CRMHandler, directory=str(ROOT)))


def main():
    if sys.version_info < (3, 10):
        print("Se necesita Python 3.10 o posterior. No se modificaron datos.")
        return 1
    try:
        server = create_server()
    except OSError:
        print("No se pudo abrir 127.0.0.1:8000. Puede haber otra instancia abierta.")
        print("Cerrá la otra ventana del servidor y reintentá. No cambies el puerto: los datos pertenecen a esa dirección.")
        return 1
    url = f"http://{ADDRESS}:{PORT}/"
    print(f"Aercom CRM: {url}")
    print("Conservá esta ventana abierta. Ctrl+C detiene el servidor; no elimina los datos del navegador.")
    print("Usá siempre el mismo navegador/perfil. Exportá respaldos JSON fuera de esta carpeta.")
    if "--no-browser" not in sys.argv:
        timer = Timer(0.3, lambda: webbrowser.open(url))
        timer.daemon = True
        timer.start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
