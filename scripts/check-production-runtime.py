"""Check the VPS backend image consumes the same dependency lock as preview.

This is a static check: it does not start containers or access MongoDB.
"""
from pathlib import Path
import re
import tomllib


ROOT = Path(__file__).resolve().parents[1]
lock = tomllib.loads((ROOT / "uv.lock").read_text())
expected = {
    package["name"]: package["version"]
    for package in lock["package"]
    if "registry" in package.get("source", {})
}
requirements = ROOT / "backend" / "requirements-runtime.txt"
content = requirements.read_text()
exported = dict(re.findall(r"^([a-zA-Z0-9_.-]+)==([^\s;]+)", content, re.MULTILINE))
assert exported == expected, (
    "Production dependency export is stale. Regenerate it using the uv export "
    "command documented in DEPLOY.md."
)
blocks = re.split(r"(?=^[a-zA-Z0-9_.-]+==)", content, flags=re.MULTILINE)[1:]
assert all("--hash=sha256:" in block for block in blocks), "Missing dependency hashes"

dockerfile = (ROOT / "backend" / "Dockerfile").read_text()
assert "COPY requirements-runtime.txt ." in dockerfile
assert "--require-hashes -r requirements-runtime.txt" in dockerfile
assert "-r requirements.txt" not in dockerfile
assert "requirements-runtime.txt" not in (ROOT / "backend" / ".dockerignore").read_text()
compose = (ROOT / "docker-compose.yml").read_text()
assert "context: ./backend" in compose
assert "context: ./artifacts/jansetu-web" in compose
assert (ROOT / "artifacts" / "jansetu-web" / "Dockerfile").is_file()
print(f"Production image dependency export matches all {len(expected)} locked packages.")
print("Compose build contexts exist; FastAPI image installs the hash-pinned export.")
