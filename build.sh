#!/usr/bin/env sh
# Builds the site from src/page.html.
#
# src/page.html is the single source: page content only, no <!doctype>/<html>/
# <head>/<body> of its own, with photos referenced as {{ASSET:path}} tokens.
# This script writes two outputs from it:
#
#   index.html         asset tokens -> relative paths. For GitHub Pages, which
#                      serves assets/ alongside it.
#   dist/artifact.html asset tokens -> base64 data URIs, so the page is fully
#                      self-contained. For publishing as an Artifact, where a
#                      strict CSP blocks anything loaded from elsewhere.
#
# Run after editing src/page.html or replacing a photo:  ./build.sh
set -eu
python3 - <<'PY'
import base64, mimetypes, os, re

SRC = "src/page.html"
src = open(SRC, encoding="utf-8").read()

HEAD = """<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Tenana Rentals — car rental on South Tarawa, Kiribati. Every car $60 a day, delivered from Betio to Bonriki Airport.">
<meta name="color-scheme" content="light">"""

split = src.index("<style>")
head, body = src[:split], src[split:]

def resolve(text, inline):
    def sub(m):
        path = m.group(1)
        if not inline:
            return path
        if not os.path.exists(path):
            raise SystemExit("missing asset: " + path)
        mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
        with open(path, "rb") as fh:
            return "data:%s;base64,%s" % (mime, base64.b64encode(fh.read()).decode())
    return re.sub(r"\{\{ASSET:([^}]+)\}\}", sub, text)

# 1. index.html — a standalone document for static hosting
with open("index.html", "w", encoding="utf-8") as out:
    out.write("<!doctype html>\n<html lang=\"en\">\n<head>\n")
    out.write(HEAD + "\n")
    out.write(resolve(head, False))
    out.write("</head>\n<body>\n")
    out.write(resolve(body, False))
    out.write("\n</body>\n</html>\n")

# 2. dist/artifact.html — self-contained, for the Artifact host
os.makedirs("dist", exist_ok=True)
with open("dist/artifact.html", "w", encoding="utf-8") as out:
    out.write(resolve(src, True))

for f in ("index.html", "dist/artifact.html"):
    print("built %-20s %6.0f KB" % (f, os.path.getsize(f) / 1024))
PY
