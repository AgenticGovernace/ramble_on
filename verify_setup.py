#!/usr/bin/env python3
"""Preflight environment check for Ramble On.

Runs before any Node tooling to verify the host can support install/build.
Stdlib only (no pip deps, no venv). macOS-first.

Usage:
    python3 ./verify_setup.py
    python3 ./verify_setup.py --json
"""

from __future__ import annotations

import json
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent

MIN_NODE_MAJOR = 18
MIN_PYTHON = (3, 9)
MIN_FREE_BYTES = 1 * 1024 * 1024 * 1024  # 1 GB


class CheckResult:
    __slots__ = ("name", "state", "expected", "found", "fix")

    def __init__(self, name: str, state: str, expected: str, found: str, fix: str):
        self.name = name
        self.state = state  # "pass" | "fail" | "warn"
        self.expected = expected
        self.found = found
        self.fix = fix

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "state": self.state,
            "expected": self.expected,
            "found": self.found,
            "fix": self.fix,
        }


def _which(cmd: str) -> str | None:
    return shutil.which(cmd)


def _run(cmd: list[str]) -> tuple[int, str]:
    try:
        out = subprocess.run(
            cmd, capture_output=True, text=True, timeout=10, check=False
        )
        return out.returncode, (out.stdout or out.stderr).strip()
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        return 1, str(exc)


def check_python() -> CheckResult:
    cur = sys.version_info[:2]
    if cur >= MIN_PYTHON:
        return CheckResult(
            "python",
            "pass",
            f">= {MIN_PYTHON[0]}.{MIN_PYTHON[1]}",
            f"{cur[0]}.{cur[1]}",
            "",
        )
    return CheckResult(
        "python",
        "fail",
        f">= {MIN_PYTHON[0]}.{MIN_PYTHON[1]}",
        f"{cur[0]}.{cur[1]}",
        "Install a newer Python 3 from https://www.python.org/downloads/",
    )


def check_macos() -> CheckResult:
    sysname = platform.system()
    if sysname == "Darwin":
        return CheckResult("os", "pass", "Darwin", sysname, "")
    return CheckResult(
        "os",
        "warn",
        "Darwin",
        sysname,
        "Windows/Linux scripted lifecycle is deferred to v2. The dev "
        "workflow (npm run desktop:dev) still works on this OS.",
    )


def check_node() -> CheckResult:
    if not _which("node"):
        return CheckResult(
            "node",
            "fail",
            f">= {MIN_NODE_MAJOR}.x on PATH",
            "not found",
            "Install Node from https://nodejs.org/ or `brew install node`.",
        )
    rc, out = _run(["node", "--version"])
    if rc != 0:
        return CheckResult(
            "node",
            "fail",
            f">= {MIN_NODE_MAJOR}.x",
            f"node --version failed: {out}",
            "Reinstall Node.",
        )
    raw = out.lstrip("v")
    try:
        major = int(raw.split(".", 1)[0])
    except ValueError:
        return CheckResult(
            "node", "fail", f">= {MIN_NODE_MAJOR}.x", out, "Reinstall Node."
        )
    if major < MIN_NODE_MAJOR:
        return CheckResult(
            "node",
            "fail",
            f">= {MIN_NODE_MAJOR}.x",
            f"v{raw}",
            f"Upgrade Node to >= {MIN_NODE_MAJOR}.",
        )
    return CheckResult("node", "pass", f">= {MIN_NODE_MAJOR}.x", f"v{raw}", "")


def check_npm() -> CheckResult:
    if not _which("npm"):
        return CheckResult(
            "npm",
            "fail",
            "npm on PATH",
            "not found",
            "Reinstall Node (npm ships with it).",
        )
    rc, out = _run(["npm", "--version"])
    if rc != 0:
        return CheckResult(
            "npm", "fail", "npm functional", out, "Reinstall Node."
        )
    return CheckResult("npm", "pass", "npm on PATH", out, "")


def check_git() -> CheckResult:
    if not _which("git"):
        return CheckResult(
            "git",
            "fail",
            "git on PATH",
            "not found",
            "`xcode-select --install` or install Git from https://git-scm.com/",
        )
    rc, _ = _run(["git", "-C", str(REPO_ROOT), "rev-parse", "--git-dir"])
    if rc != 0:
        return CheckResult(
            "git",
            "fail",
            "repo is a git working tree",
            "not a git repo",
            f"Run from a git clone. Current dir: {REPO_ROOT}",
        )
    return CheckResult("git", "pass", "git working tree", str(REPO_ROOT), "")


def check_applications_writable() -> CheckResult:
    target = Path("/Applications")
    if not target.exists():
        return CheckResult(
            "applications_dir",
            "warn",
            "/Applications exists",
            "missing",
            "Non-standard macOS layout. Install destination unclear.",
        )
    if not os.access(target, os.W_OK):
        return CheckResult(
            "applications_dir",
            "warn",
            "/Applications writable",
            "not writable by current user",
            "Update will need `sudo` to copy the .app bundle.",
        )
    return CheckResult(
        "applications_dir", "pass", "/Applications writable", str(target), ""
    )


def check_user_data_writable() -> CheckResult:
    target = Path.home() / "Library" / "Application Support"
    if not target.exists():
        return CheckResult(
            "user_data_dir",
            "fail",
            "~/Library/Application Support exists",
            "missing",
            "Unexpected macOS layout. Reinstall macOS user libraries.",
        )
    if not os.access(target, os.W_OK):
        return CheckResult(
            "user_data_dir",
            "fail",
            "~/Library/Application Support writable",
            "not writable",
            "Fix permissions on ~/Library/Application Support.",
        )
    return CheckResult(
        "user_data_dir",
        "pass",
        "~/Library/Application Support writable",
        str(target),
        "",
    )


def check_package_json() -> CheckResult:
    pkg_path = REPO_ROOT / "package.json"
    if not pkg_path.exists():
        return CheckResult(
            "package_json",
            "fail",
            "package.json present",
            "missing",
            f"Run from repo root. Looked at {pkg_path}.",
        )
    try:
        pkg = json.loads(pkg_path.read_text())
    except json.JSONDecodeError as exc:
        return CheckResult(
            "package_json",
            "fail",
            "package.json parseable",
            f"JSON error: {exc}",
            "Fix package.json syntax.",
        )
    name = pkg.get("name")
    product = (pkg.get("build") or {}).get("productName")
    if name != "ramble_on" or product != "Ramble On":
        return CheckResult(
            "package_json",
            "warn",
            'name="ramble_on", productName="Ramble On"',
            f'name="{name}", productName="{product}"',
            "Install scripts assume these values. Update scripts/lib/paths.mjs"
            " if you renamed the app.",
        )
    return CheckResult(
        "package_json", "pass", "name + productName as expected", "ok", ""
    )


def check_env_local() -> CheckResult:
    candidates = [REPO_ROOT / ".env.local", REPO_ROOT / "env.local"]
    found = next((p for p in candidates if p.exists()), None)
    if not found:
        return CheckResult(
            "env_local",
            "warn",
            ".env.local present",
            "missing",
            "Run `npm run app:init` to create it interactively.",
        )

    keys = set()
    for line in found.read_text().splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        keys.add(s.split("=", 1)[0].strip())

    has_text_key = any(
        k in keys for k in ("GEMINI_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY")
    )
    if not has_text_key:
        return CheckResult(
            "env_local",
            "warn",
            "at least one of GEMINI/OPENAI/ANTHROPIC_API_KEY",
            f"keys present: {sorted(keys) or 'none'}",
            "Run `npm run app:init` to add API keys, or edit .env.local.",
        )
    return CheckResult(
        "env_local",
        "pass",
        "at least one text-provider API key set",
        f"{len(keys)} key(s) configured",
        "",
    )


def check_disk_space() -> CheckResult:
    usage = shutil.disk_usage(REPO_ROOT)
    free_gb = usage.free / (1024**3)
    if usage.free < MIN_FREE_BYTES:
        return CheckResult(
            "disk_space",
            "fail",
            ">= 1 GB free in repo dir",
            f"{free_gb:.2f} GB",
            "Free up disk space; electron-builder output is ~600 MB.",
        )
    return CheckResult(
        "disk_space", "pass", ">= 1 GB free", f"{free_gb:.2f} GB", ""
    )


CHECKS = [
    check_python,
    check_macos,
    check_node,
    check_npm,
    check_git,
    check_applications_writable,
    check_user_data_writable,
    check_package_json,
    check_env_local,
    check_disk_space,
]

STATE_LABEL = {"pass": "PASS", "fail": "FAIL", "warn": "WARN"}


def render_text(results: list[CheckResult]) -> None:
    width = max(len(r.name) for r in results) + 2
    print(f"\nRamble On — environment preflight ({REPO_ROOT})\n")
    for r in results:
        marker = STATE_LABEL[r.state]
        print(f"  [{marker}] {r.name.ljust(width)} {r.found}")

    failed = [r for r in results if r.state == "fail"]
    warned = [r for r in results if r.state == "warn"]

    if failed or warned:
        print()
    for r in failed + warned:
        marker = STATE_LABEL[r.state]
        print(f"[{marker}] {r.name}")
        print(f"  expected: {r.expected}")
        print(f"  found:    {r.found}")
        if r.fix:
            print(f"  fix:      {r.fix}")
        print()

    if failed:
        print(f"{len(failed)} check(s) failed. Address fixes above before installing.")
    elif warned:
        print(f"All required checks passed. {len(warned)} warning(s) noted.")
    else:
        print("All checks passed. You can run `npm install` next.")


def main() -> int:
    json_mode = "--json" in sys.argv

    results = [c() for c in CHECKS]

    if json_mode:
        payload = {
            "results": [r.to_dict() for r in results],
            "summary": {
                "pass": sum(1 for r in results if r.state == "pass"),
                "fail": sum(1 for r in results if r.state == "fail"),
                "warn": sum(1 for r in results if r.state == "warn"),
            },
        }
        print(json.dumps(payload, indent=2))
    else:
        render_text(results)

    return 1 if any(r.state == "fail" for r in results) else 0


if __name__ == "__main__":
    sys.exit(main())
