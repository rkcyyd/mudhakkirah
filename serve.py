#!/usr/bin/env python3
"""خادم تطوير محلي بسيط — يقدّم الملفات بدون تخزين مؤقت حتى تظهر التعديلات فورًا.

    python serve.py           # المنفذ 5173
    python serve.py 8080      # منفذ آخر
"""
import os
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

# قدّم دائمًا من المجلد الذي يحوي هذا الملف
os.chdir(os.path.dirname(os.path.abspath(__file__)))

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173

MIME = {
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".woff2": "font/woff2",
    ".svg": "image/svg+xml",
}


def log(msg):
    """آمن تحت pythonw حيث لا يوجد stdout."""
    try:
        if sys.stdout:
            print(msg)
    except Exception:
        pass


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def guess_type(self, path):
        for ext, mime in MIME.items():
            if path.endswith(ext):
                return mime
        return super().guess_type(path)

    def log_message(self, *args, **kwargs):
        pass  # صامت


if __name__ == "__main__":
    log(f"mudhakkirah running at  http://localhost:{PORT}   (Ctrl+C to stop)")
    try:
        srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
        srv.daemon_threads = True
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    except OSError as e:
        log(f"could not start: {e}")
