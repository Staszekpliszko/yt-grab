# Tasks: YT-GRAB

(Lokalizacja obok kanonicznego planu docs/PLAN.md.)

## Do zrobienia
- [ ] Etap 3 — Analiza (video:analyze)
- [ ] Etap 4 — Pobieranie wideo+audio
- [ ] Etap 5 — Pobieranie audio
- [ ] Etap 6 — Progress + anulowanie
- [ ] Etap 7 — Folder + persystencja + kolejka
- [ ] Etap 8 — Błędy PL + sanityzacja nazw
- [ ] Etap 9 — Pakowanie (electron-builder)

## W trakcie
(puste)

## Zrobione
- [x] Etap 1 — Skeleton Electron+Vite+React+TS, IPC echo, toolchain (typecheck/lint/build)
      Bramka: typecheck ✅ · lint ✅ (--max-warnings 0) · build ✅ · renderer bez Node API ✅ ·
      okno startuje ✅ · echo „echo: ping" potwierdzone w UI ✅
- [x] Etap 2 — Provisioning binarek (yt-dlp + ffmpeg/ffprobe)
      scripts/fetch-bins.{ps1,sh} + npm run fetch-bins:{win,mac}; resolver dev/packaged
      (src/main/binaries.ts); IPC binaries:check + panel w UI.
      Bramka: typecheck ✅ · lint ✅ · build ✅ · pobrano binarki ✅ ·
      log startowy main: yt-dlp 2026.03.17, ffmpeg/ffprobe N-124868 ✅
