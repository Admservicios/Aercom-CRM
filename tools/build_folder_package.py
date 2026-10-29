"""Genera el ZIP de uso directo usando solo recursos versionados, sin datos privados."""
from pathlib import Path
import hashlib
import io
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "downloads" / "Aercom-CRM-Carpeta.zip"


def build():
    raw = subprocess.check_output(["git", "ls-files", "-z", "--", "index.html", "css", "js", "img", "LEEME_CARPETA.html", "GUIA_CARPETA.md"], cwd=ROOT)
    files = sorted(name.decode() for name in raw.split(b"\x00") if name)
    contents = {name: (ROOT / name).read_bytes() for name in files}
    html = contents["index.html"].decode("utf-8-sig")
    for src in re.findall(r'<script\s+src="([^"]+)"', html):
        if src.startswith(("http:", "https:")) or src.split("?")[0] not in contents:
            raise RuntimeError("Recurso externo o ausente: " + src)
    for name in ["js/local-folder.js", "LEEME_CARPETA.html", "GUIA_CARPETA.md", "js/vendor/NOTICES.md"]:
        if name not in contents:
            raise RuntimeError("Falta versionar " + name)
    if any(name.lower().endswith((".json", ".txt", ".zip", ".ps1", ".cmd", ".py")) and not name.startswith("js/vendor/") for name in contents):
        raise RuntimeError("El paquete contiene un archivo de datos o un iniciador")
    manifest = "\n".join(hashlib.sha256(body).hexdigest() + "  " + name for name, body in contents.items()) + "\n"
    contents["MANIFIESTO_SHA256.txt"] = manifest.encode()
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, body in sorted(contents.items()):
            info = zipfile.ZipInfo("Aercom-CRM/" + name, date_time=(2026, 10, 29, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, body)
    OUTPUT.parent.mkdir(exist_ok=True)
    OUTPUT.write_bytes(stream.getvalue())
    with zipfile.ZipFile(OUTPUT) as archive:
        if archive.testzip() is not None:
            raise RuntimeError("El ZIP no supera la comprobación CRC")
    print(str(OUTPUT), OUTPUT.stat().st_size, "bytes; SHA256", hashlib.sha256(OUTPUT.read_bytes()).hexdigest())


if __name__ == "__main__":
    build()
