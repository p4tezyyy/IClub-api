#!/usr/bin/env python3
"""Synchronize iclub-api npm and iclub_api Python versions. No third-party deps."""
from __future__ import annotations
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]

def main() -> None:
    if len(sys.argv) != 2 or not re.fullmatch(r"\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\d+)?", sys.argv[1]):
        raise SystemExit("Usage: python scripts/set_version.py 0.2.0")
    version = sys.argv[1]
    node_path = ROOT / "nodejs" / "package.json"
    node = json.loads(node_path.read_text())
    node["version"] = version
    node_path.write_text(json.dumps(node, indent=2) + "\n")

    py_path = ROOT / "python" / "pyproject.toml"
    py = py_path.read_text()
    py, count = re.subn(r'(?m)^version\s*=\s*"[^"]+"\s*$', f'version = "{version}"', py, count=1)
    if count != 1: raise RuntimeError("Could not find Python project version")
    py_path.write_text(py)

    module_path = ROOT / "python/src/iclub_api/__init__.py"
    module = module_path.read_text()
    module, count = re.subn(r'(?m)^__version__\s*=\s*"[^"]+"\s*$', f'__version__ = "{version}"', module, count=1)
    if count != 1: raise RuntimeError("Could not find Python module version")
    module_path.write_text(module)
    print(f"Versions updated to {version}. Update docs/changelog.md; regenerate dist, run tests, and tag v{version}.")

if __name__ == "__main__":
    main()
