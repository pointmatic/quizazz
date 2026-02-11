# Copyright (c) 2026 Pointmatic
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Serve the built Quizazz app locally and open it in a browser."""

import http.server
import os
import subprocess
import sys
import threading
import webbrowser
from pathlib import Path

PORT = 8000
BUILD_DIR = Path(__file__).parent / "app" / "build"


def build_app() -> bool:
    """Build the SvelteKit app if not already built."""
    if not (BUILD_DIR / "index.html").exists():
        print("Building app...")
        result = subprocess.run(
            ["pnpm", "build"],
            cwd=Path(__file__).parent / "app",
        )
        if result.returncode != 0:
            print("Build failed.", file=sys.stderr)
            return False
    return True


def main() -> None:
    if not build_app():
        sys.exit(1)

    os.chdir(BUILD_DIR)
    handler = http.server.SimpleHTTPRequestHandler
    server = http.server.HTTPServer(("localhost", PORT), handler)

    url = f"http://localhost:{PORT}"
    print(f"Serving Quizazz at {url}")
    print("Press Ctrl+C to stop.\n")

    # Open browser after a short delay to let the server start
    threading.Timer(0.5, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        server.server_close()


if __name__ == "__main__":
    main()
