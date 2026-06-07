#!/bin/bash
# ============================================================
# YT-GRAB — pobieracz filmów z YouTube (Electron + React + TS)
# Setup PIV dla Claude Code — uruchom raz w pustym katalogu projektu
# ============================================================
set -e

mkdir -p .claude/commands docs

# ------------------------------------------------------------
# CLAUDE.md
# ------------------------------------------------------------
cat > CLAUDE.md << 'EOF'
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
EOF

# ------------------------------------------------------------
# /plan
# ------------------------------------------------------------
cat > .claude/commands/plan.md << 'EOF'
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
EOF

# ------------------------------------------------------------
# /implement
# ------------------------------------------------------------
cat > .claude/commands/implement.md << 'EOF'
Faza IMPLEMENT projektu YT-GRAB. Wymagany zatwierdzony docs/PLAN.md — jeśli go nie ma, przerwij i każ uruchomić /plan.

Zasady:
- Realizuj etapy z PLAN.md po kolei. Po każdym etapie: `npm run typecheck` + krótki raport co działa.
- Argument $ARGUMENTS = numer etapu do wykonania. Bez argumentu: kontynuuj od pierwszego nieukończonego (status trzymaj w docs/PLAN.md jako checkboxy).
- Main process: serwisy `YtDlpService` (analyze, download, cancel) i `FfmpegService` (mux, convertAudio) jako klasy z spawn + AbortController.
- Wybór folderu: handler IPC `dialog:pickOutputDir` → `dialog.showOpenDialog({ properties: ['openDirectory'] })`, wynik zapisany w electron-store pod `lastOutputDir`, zwracany do renderera i pokazywany w UI.
- Lista formatów: parsuj `yt-dlp -J`, pokaż wszystkie unikalne rozdzielczości wideo + wszystkie ścieżki audio. Nie filtruj nic "dla wygody".
- Nazewnictwo plików: `%(title)s [%(height)sp].%(ext)s` z sanityzacją (`--restrict-filenames` NIE — zamiast tego własna sanityzacja zachowująca polskie znaki).
- Anulowanie: kill drzewa procesów (yt-dlp + ffmpeg), sprzątanie plików .part.
- Komunikaty błędów mapuj na PL: ERROR: Private video → "Film prywatny", itd.
- Zero placeholder kodu, zero TODO bez implementacji.
EOF

# ------------------------------------------------------------
# /validate
# ------------------------------------------------------------
cat > .claude/commands/validate.md << 'EOF'
Faza VALIDATE projektu YT-GRAB. Przejdź checklistę, każdy punkt oznacz ✅/❌ z dowodem (output komendy lub wskazanie kodu):

1. `npm run typecheck` i `npm run build` przechodzą czysto.
2. `yt-dlp -J <testowy URL>` parsowany poprawnie — lista formatów zawiera wszystkie rozdzielczości z odpowiedzi (porównaj liczbę z surowym JSON).
3. Pobranie wideo+audio w MP4, MKV i WEBM — plik powstaje w wybranym folderze, ffprobe pokazuje poprawne strumienie, brak rekodowania tam gdzie plan przewiduje copy.
4. Pobranie audio w MP3, M4A, OPUS, WAV — ffprobe potwierdza kodek/kontener.
5. Dialog wyboru folderu działa, lastOutputDir przeżywa restart aplikacji.
6. Progress aktualizuje się płynnie, anulowanie zabija procesy i usuwa .part.
7. Błędne URL / film prywatny → komunikat PL, aplikacja nie wisi.
8. Brak wywołań node/fs/child_process w rendererze (grep po src/renderer).
9. Tytuł z polskimi znakami i znakami zakazanymi (`/ : ? "`) → poprawna nazwa pliku na Win i Mac.
10. Paczka electron-builder uruchamia się i znajduje binarki yt-dlp/ffmpeg z resources.

Na końcu: lista znalezionych problemów z priorytetami. Nie naprawiaj nic bez polecenia.
EOF

# ------------------------------------------------------------
# .gitignore
# ------------------------------------------------------------
cat > .gitignore << 'EOF'
node_modules/
dist/
out/
bin/
*.part
.DS_Store
EOF

echo ""
echo "✅ YT-GRAB: struktura PIV gotowa."
echo "   1. claude"
echo "   2. /plan      → zatwierdź docs/PLAN.md"
echo "   3. /implement → etapami"
echo "   4. /validate"
