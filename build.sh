#!/usr/bin/env sh
# Builds the standalone site from src/page.html.
#
# src/page.html is written the way the Artifact host wants it: page content only,
# no <!doctype>/<html>/<head>/<body> of its own. This script splits it at the
# <style> tag — the <title> and font links go in <head>, everything from <style>
# onward goes in <body> — and writes index.html for ordinary static hosting.
#
# Run after editing src/page.html:  ./build.sh
set -eu
SRC="src/page.html"
OUT="index.html"
SPLIT=$(grep -n '^<style>' "$SRC" | head -1 | cut -d: -f1)

{
  echo '<!doctype html>'
  echo '<html lang="en">'
  echo '<head>'
  echo '<meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width, initial-scale=1">'
  echo '<meta name="description" content="Tenana Rentals — car, van and scooter hire on South Tarawa, Kiribati. Live quote in AUD, delivery from Betio to Bonriki Airport.">'
  echo '<meta name="color-scheme" content="light dark">'
  head -n $((SPLIT - 1)) "$SRC"
  echo '</head>'
  echo '<body>'
  tail -n +"$SPLIT" "$SRC"
  echo '</body>'
  echo '</html>'
} > "$OUT"

echo "built $OUT from $SRC"
