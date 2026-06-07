Faza PLAN projektu YT-GRAB. Przeczytaj CLAUDE.md.

Stwórz docs/PLAN.md zawierający:

1. **Architektura** — diagram przepływu: URL → yt-dlp -J → lista formatów → wybór → spawn yt-dlp + ffmpeg → plik w folderze docelowym. Wskaż dokładnie które operacje w main, które w rendererze.
2. **Model danych** — interfejsy TS: `FormatInfo` (itag/format_id, ext, resolution, fps, vcodec, acodec, filesize, tbr), `DownloadJob` (url, mode, formatId, container, outputDir, status, progress), kanały IPC z payloadami.
3. **Strategia formatów**:
   - jak z surowego JSON yt-dlp budujemy listę dla UI (dedup, sortowanie po rozdzielczości malejąco, oznaczenie "video-only" vs "z audio")
   - selektor pobierania: `bv*[height=X]+ba` dla wideo+audio, `ba` dla audio
   - macierz kontenerów: kiedy `-c copy` (vp9→webm/mkv, avc1→mp4), kiedy konieczne rekodowanie
   - konwersje audio: parametry ffmpeg dla mp3 (libmp3lame, V0), m4a (copy/aac), opus (copy), wav (pcm_s16le)
4. **yt-dlp/ffmpeg provisioning** — skrypt `scripts/fetch-bins.sh` pobierający binarki do `bin/{win,mac}`, ścieżki resolwowane w runtime (dev vs packaged: `process.resourcesPath`).
5. **Parsowanie progressu** — `--progress-template` z JSON na linię, throttling eventów IPC do ~4/s.
6. **UI** — szkic ekranów: input URL + przycisk Analizuj → tabela formatów z radiobuttonami → wybór trybu/kontenera → folder docelowy (pokazany path + przycisk Zmień) → kolejka z progress barami.
7. **Etapy implementacji** — ponumerowane, każdy kończy się działającym stanem. Etap 1 = skeleton Electron z IPC echo. Ostatni etap = electron-builder.
8. **Ryzyka** — yt-dlp łamany przez zmiany YT (plan: auto-update binarki `yt-dlp -U`), SABR/PO-token, długie nazwy plików win, znaki specjalne w tytułach (sanityzacja).

Nie pisz kodu produkcyjnego. Po zapisaniu PLAN.md zatrzymaj się i czekaj na akceptację.
