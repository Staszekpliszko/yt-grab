# YT-GRAB

Desktopowy pobieracz filmów z YouTube. **Electron + React + TypeScript + Vite**.
Backend pobierania: [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) (binarka bundlowana per platforma)
+ [`ffmpeg`](https://ffmpeg.org/) (mux wideo+audio, konwersja audio).

> Status: w budowie (PIV — Plan / Implement / Validate). Aktualny etap: patrz `docs/PLAN.md`.

## Funkcje (v1)
- Analiza pojedynczego filmu (`yt-dlp -J`) → lista **wszystkich** formatów wideo i audio.
- Tryb **Wideo+Audio** (MP4 / MKV / WEBM, mux bez rekodowania gdy możliwe) lub **Tylko audio** (MP3 / M4A / OPUS / WAV).
- Wybór folderu docelowego (zapamiętywany), pasek postępu z prędkością i ETA, anulowanie.
- Kolejka sekwencyjna, czytelne komunikaty błędów po polsku.

## Stack i architektura
- **Main** (Electron, TypeScript) — całość logiki: spawn yt-dlp/ffmpeg, dialogi, dostęp do dysku.
- **Preload** — typowany mostek `contextBridge` (`contextIsolation: true`, bez `nodeIntegration`).
- **Renderer** (React + Vite) — wyłącznie UI; komunikacja przez `window.api.*` (kanały w `src/shared/ipc.ts`).

Renderer nigdy nie woła `yt-dlp`/`ffmpeg` ani Node API bezpośrednio.

## Rozwój
```bash
npm install
npm run dev         # uruchom w trybie deweloperskim (HMR)
npm run typecheck   # tsc --noEmit (main + renderer)
npm run lint        # ESLint (--max-warnings 0)
npm run build       # produkcyjny build do out/
```

Binarki `yt-dlp`/`ffmpeg` trafiają do `bin/{win,mac}` (poza repo, pobierane skryptem — patrz `docs/PLAN.md`).

## Licencja
MIT — patrz [LICENSE](./LICENSE).
