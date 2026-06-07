# Tasks: YT-GRAB

(Lokalizacja obok kanonicznego planu docs/PLAN.md.)

## Do zrobienia
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
- [x] Etap 3 — Analiza (video:analyze)
      src/main/ytdlp.ts (YtDlpService: spawn yt-dlp -J, klasyfikacja/dedup/sort →
      FormatInfo[]); IPC video:analyze; UI: input URL + Analizuj + tabela Wideo/Audio z radio.
      Bramka: typecheck/lint/build ✅ · smoke na realnym URL ✅ (Resolume tutorial:
      39 raw → 35 media → 22 unikalnych = „Formatów: 22" w UI; wszystkie rozdzielczości
      i kodeki avc1/vp9/av01 zachowane).
- [x] Etap 4 — Pobieranie wideo+audio
      YtDlpService.downloadVideo: -f "<id>+ba/<id>" --merge-output-format <kontener>
      --ffmpeg-location bin/ -P <dir> -o "%(title)s [%(height)sp].%(ext)s"
      --no-simulate --print after_move:filepath. IPC download:video + paths:downloads;
      UI: panel kontener MP4/MKV/WEBM + Pobierz + status.
      Bramka: typecheck/lint/build ✅ · ffprobe potwierdza strumienie i -c copy dla
      MP4 (h264+aac), MKV (h264+opus), WEBM (vp9+opus) ✅ · start+nazwa w UI ✅.
