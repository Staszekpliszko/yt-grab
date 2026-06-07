# YT-GRAB

Desktopowy pobieracz filmów z YouTube. Electron + React + TypeScript + Vite.
Backend pobierania: **yt-dlp** (binarka bundlowana per platforma) + **ffmpeg** (mux/konwersja audio).

## Stack
- Electron (main: TypeScript, preload z contextBridge, bez nodeIntegration w rendererze)
- React + TypeScript + Vite (renderer)
- yt-dlp jako child_process (spawn, parsowanie stdout JSON: `yt-dlp -J`)
- ffmpeg do mergowania video+audio i konwersji audio (mp3/m4a/wav)
- electron-builder (win + mac)

## Wymagania funkcjonalne
1. Pole na URL (pojedynczy film; playlisty poza zakresem v1).
2. Po wklejeniu URL: analiza przez `yt-dlp -J` → lista WSZYSTKICH dostępnych formatów:
   - wideo: każda rozdzielczość zwrócona przez YT (144p…4K/8K), fps, kodek (avc1/vp9/av1), rozmiar
   - audio: wszystkie ścieżki (opus/m4a), bitrate
3. Wybór trybu pobierania:
   - **Wideo+Audio** → format wyjściowy: MP4 / MKV / WEBM (mux ffmpeg, bez rekodowania gdy możliwe: `-c copy`)
   - **Tylko audio** → MP3 / M4A / OPUS / WAV (konwersja ffmpeg)
4. Wybór folderu docelowego przez natywny dialog systemowy (`dialog.showOpenDialog`, properties: openDirectory). Ostatni folder zapamiętany (electron-store).
5. Pasek postępu (parsowanie progressu yt-dlp: `--progress-template`), prędkość, ETA, anuluj.
6. Kolejka pobierań (sekwencyjna w v1).
7. Obsługa błędów: brak sieci, film prywatny/usunięty, geo-block — czytelny komunikat PL.

## Zasady
- IPC tylko przez preload (typowane kanały w `src/shared/ipc.ts`)
- Żadnych wywołań yt-dlp z renderera — wszystko w main process
- Komunikaty UI po polsku
- Brak over-engineeringu: jedna ścieżka happy path + błędy, zero abstrakcji "na zapas"

## Struktura
```
src/main/        # Electron main, yt-dlp service, ffmpeg service, IPC handlers
src/preload/
src/renderer/    # React UI
src/shared/      # typy IPC, modele FormatInfo/DownloadJob
bin/             # yt-dlp + ffmpeg per platforma (gitignore, pobierane skryptem)
docs/PLAN.md     # plan z fazy /plan
```

## Workflow: PIV
1. `/plan` → docs/PLAN.md (zatwierdzenie przed implementacją)
2. `/implement` → realizacja wg planu, etapami
3. `/validate` → weryfikacja wg checklisty
