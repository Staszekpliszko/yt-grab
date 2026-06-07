# Tasks: YT-GRAB

(Lokalizacja obok kanonicznego planu docs/PLAN.md.)

## Do zrobienia
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
- [x] Etap 5 — Pobieranie audio
      YtDlpService.downloadAudio: -f ba/b -x --audio-format <fmt> (mp3: --audio-quality 0);
      wspólny runDownload() dla video/audio. IPC download:audio + api.downloadAudio;
      UI: przełącznik Wideo+Audio / Tylko audio + selektor MP3/M4A/OPUS/WAV.
      Bramka: typecheck/lint/build ✅ · ffprobe ✅ MP3(mp3), M4A(aac), OPUS(opus/ogg),
      WAV(pcm_s16le) · smoke w UI: pobranie MP3 z Pobranymi ✅.
- [x] Etap 6 — Progress + anulowanie
      src/main/downloads.ts (DownloadManager): spawn z --progress --progress-template (PROG na stdout),
      throttle ~4/s, eventy download:progress/done/error; temp per job (home:/temp:), kill drzewa (taskkill /T),
      sprzątanie temp. Przebudowa na model zdarzeń (start→progress*→done/error). Usunięto stare
      downloadVideo/downloadAudio z YtDlpService. UI: pasek postępu + prędkość/ETA + Anuluj.
      Bramka: typecheck/lint/build ✅ · progress emituje ✅ · routing home/temp + sprzątanie temp ✅.
- [x] Etap 7 — Folder + persystencja + kolejka
      electron-store@8 (src/main/store.ts: lastOutputDir/Pobrane); IPC dir:get + dir:pick
      (dialog.showOpenDialog openDirectory, zapis do store). Kolejka po stronie renderera:
      QueueItem[] + sterownik sekwencyjny (start kolejnego 'queued' gdy nic nie pobiera),
      per-element progress + Anuluj/Usuń; globalny wybór folderu z 'Zmień'.
      Bramka: typecheck/lint/build ✅. Smoke interaktywny (dialog/restart/kolejka) → do potwierdzenia w 7b.
- [x] Etap 7b — Skórka UI wg standalone.html
      Ciemny motyw (paleta wyciągnięta z referencji puppeteerem): tło #0a0b0d, panele #0d0e11,
      akcent #ff0033, zielony #34d27f, błąd #ff5a7a, Inter + JetBrains Mono. Układ 2-kolumnowy:
      główny obszar (karta filmu, tabela formatów z badge TYP, TRYB/FORMAT segmenty, folder,
      wielki Pobierz·rozmiar) + panel Kolejka pobierań (karty statusów, Ponów, Wyczyść).
      Logika/IPC bez zmian. Bramka: typecheck/lint/build ✅; podgląd puppeteer w 3 stanach ✅.
