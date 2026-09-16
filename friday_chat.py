"""Simple terminal chat client for a deployed or local F.R.I.D.A.Y. v3 API."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request


BASE_URL = os.getenv("FRIDAY_URL", "http://127.0.0.1:8000").rstrip("/")


def post_chat(message: str) -> dict:
    body = json.dumps({"message": message}).encode("utf-8")
    request = urllib.request.Request(
        BASE_URL + "/chat",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Friday API returned {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Cannot reach Friday at {BASE_URL}: {exc.reason}") from exc


def main() -> int:
    if len(sys.argv) > 1:
        message = " ".join(sys.argv[1:])
        result = post_chat(message)
        print(result["reply"])
        return 0

    print(f"Connected to F.R.I.D.A.Y. at {BASE_URL}")
    print("Type /exit to stop. Commands are sent to the deployed service.")
    while True:
        try:
            message = input("You> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return 0
        if not message:
            continue
        if message.lower() in {"/exit", "/quit"}:
            return 0
        try:
            result = post_chat(message)
            print(f"Friday> {result['reply']}")
            print(f"[{result['provider']} / {result['model']}]")
        except RuntimeError as exc:
            print(f"Error> {exc}")


if __name__ == "__main__":
    raise SystemExit(main())
