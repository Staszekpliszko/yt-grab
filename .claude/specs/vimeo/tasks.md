# Tasks: Obsługa Vimeo (plan: docs/PLAN-vimeo.md)

## Do zrobienia
(nic — pozostaje smoke wizualny end-to-end i V5)

## W trakcie
- [ ] Smoke wizualny (uruchomienie app + analiza realnego Vimeo)

## Zrobione
- [x] V1 — maper formatów Vimeo w nowych plikach (sources/detect.ts, sources/vimeo.ts) + rozgałęzienie w ytdlp.ts; analyze 76979871 → 4 wiersze == 4 wysokości
- [x] V2 — vimeoVideoSelector + obsługa kontenera w downloads.ts; ffprobe: MP4 h264+aac ✓, MKV h264+aac (remux copy) ✓, WEBM→MP4
- [x] V3 — audio Vimeo: ffprobe mp3/mp3, aac/m4a, opus/ogg, pcm_s16le/wav ✓ (ścieżka audio bez zmian w kodzie)
- [x] V4 — UI: teksty „YouTube/Vimeo", etykieta kolejki MP4 dla Vimeo+WEBM, banner WEBM→MP4; grep renderera czysty

## Poza tym torem
- [x] V5 — błędy PL Vimeo: zrealizowane w Etapie 8 (src/main/errors.ts — reguły hasło/embed-only/geo/usunięty)

## Zasada: ZERO regresji YT — ścieżka YouTube nietknięta (nowe pliki, minimalny `if` w punkcie wejścia)
