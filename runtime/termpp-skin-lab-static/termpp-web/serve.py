#!/usr/bin/env python3
"""Dev server with COOP/COEP headers for WASM SharedArrayBuffer support."""
import http.server

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'credentialless')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

s = http.server.HTTPServer(('0.0.0.0', 8000), Handler)
print('Serving on http://0.0.0.0:8000')
s.serve_forever()
