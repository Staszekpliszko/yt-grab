# Tasks: Obsługa Vimeo (plan: docs/PLAN-vimeo.md)

## Do zrobienia
- [ ] V3 — audio Vimeo (MP3/M4A/OPUS/WAV) → ffprobe kodek/kontener
- [ ] V4 — teksty UI „YouTube" → „YouTube / Vimeo" + komunikat WEBM→MP4 dla Vimeo

## W trakcie
- [ ] V3 (start)

## Zrobione
- [x] V1 — maper formatów Vimeo w nowych plikach (sources/detect.ts, sources/vimeo.ts) + rozgałęzienie w ytdlp.ts; analyze 76979871 → 4 wiersze == 4 wysokości
- [x] V2 — vimeoVideoSelector + obsługa kontenera w downloads.ts; ffprobe: MP4 h264+aac ✓, MKV h264+aac (remux copy) ✓, WEBM→MP4

## Poza tym torem
- V5 — błędy PL Vimeo: realizowane razem z Etapem 8 głównego planu (docs/PLAN.md)

## Zasada: ZERO regresji YT — ścieżka YouTube nietknięta (nowe pliki, minimalny `if` w punkcie wejścia)
