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
