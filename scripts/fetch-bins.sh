#!/usr/bin/env bash
# fetch-bins.sh — pobiera yt-dlp + ffmpeg/ffprobe do bin/mac (macOS).
# Uruchom: npm run fetch-bins:mac
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/bin/mac"
mkdir -p "$DEST"

echo 'Pobieranie yt-dlp...'
curl -L --fail -o "$DEST/yt-dlp" \
  https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos
chmod +x "$DEST/yt-dlp"

echo 'Pobieranie ffmpeg/ffprobe (evermeet.cx)...'
tmp="$(mktemp -d)"
curl -L --fail -o "$tmp/ffmpeg.zip" https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip
curl -L --fail -o "$tmp/ffprobe.zip" https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip
unzip -o "$tmp/ffmpeg.zip" -d "$DEST"
unzip -o "$tmp/ffprobe.zip" -d "$DEST"
chmod +x "$DEST/ffmpeg" "$DEST/ffprobe"
rm -rf "$tmp"

echo "Gotowe. Binarki w: $DEST"
ls -la "$DEST"
