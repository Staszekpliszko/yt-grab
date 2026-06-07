# Plan: YT-GRAB — desktopowy pobieracz YouTube (Electron + React + yt-dlp)

Data: 2026-06-07
Status: ZATWIERDZONY (2026-06-07) — Etapy 1–7b gotowe ✓; następny: Etap 8

---

## Co budujemy

Desktopowa aplikacja (Windows + macOS) do pobierania pojedynczych filmów z YouTube.
Użytkownik wkleja URL → aplikacja analizuje film przez `yt-dlp -J` → pokazuje **wszystkie**
dostępne formaty wideo i audio → użytkownik wybiera tryb (wideo+audio / tylko audio),
kontener/format wyjściowy i folder docelowy → pobranie z paskiem postępu, prędkością, ETA
i możliwością anulowania. Kolejka sekwencyjna. Komunikaty po polsku.

Zakres v1: pojedynczy film. Playlisty poza zakresem.

---

## Dlaczego tak (nie inaczej)

- **yt-dlp jako binarka + child_process** — to de facto standard; własna implementacja
  protokołu YT jest niewykonalna i krucha. Binarka bundlowana per platforma + auto-update
  (`yt-dlp -U`) bo YT psuje stare wersje.
- **ffmpeg tylko do mux/konwersji** — mux bez rekodowania (`-c copy`) gdy kontener pozwala,
  rekodowanie tylko gdy konieczne (oszczędność czasu i jakości).
- **Cała robota w main process** — renderer nie dotyka `child_process`/`fs`. Bezpieczeństwo:
  `contextIsolation: true`, `nodeIntegration: false`, IPC wyłącznie przez typowany preload.
- **GUI**: wzorcem wizualnym jest `YT-GRAB (standalone).html` (zbundlowany artefakt React —
  otwierany w przeglądarce jako referencja "jak ma wyglądać"). Strukturę komponentów i stan
  bierzemy startowo z `youtube-downloader-ui.tsx` i dostosowujemy do realnych danych z IPC
  (tam są mocki — wszystkie mocki znikają, dane lecą z main).
- **Testy lekkie (bez frameworka)** — zgodnie z zasadą "brak over-engineeringu". Gatekeeper
  po każdym etapie to `tsc --noEmit` + ESLint + `build` + ręczny smoke test wg checklisty.
  Bez Vitest/Playwright w v1 (świadoma decyzja — patrz sekcja "NIE robimy").

---

## Architektura

```
┌─────────────── RENDERER (React, sandbox) ───────────────┐
│  Input URL  →  [Analizuj]                                │
│  Tabela formatów (radio)  →  tryb / kontener / folder   │
│  Kolejka + progress bary + Anuluj                       │
└──────────────┬──────────────────────────────────────────┘
               │  window.api.* (typowane, z preload)
        ┌──────▼───────┐  contextBridge, bez nodeIntegration
        │   PRELOAD     │  ipcRenderer.invoke / .on (whitelist kanałów)
        └──────┬───────┘
               │  IPC (kanały z src/shared/ipc.ts)
┌──────────────▼──────────────── MAIN (Node) ─────────────┐
│  IPC handlers                                            │
│   • video:analyze   → YtDlpService.analyze(url)          │
│   • download:start  → YtDlpService.download(job)         │
│   • download:cancel → kill drzewa procesów + .part       │
│   • dialog:pickDir  → dialog.showOpenDialog              │
│   • store:get/set   → electron-store (lastOutputDir)     │
│                                                          │
│  YtDlpService:  spawn yt-dlp -J  (analiza)               │
│                 spawn yt-dlp --progress-template (pobr.) │
│  FfmpegService: mux (-c copy / rekodowanie), convertAudio│
│  Binaries:      bin/{win,mac}, resolve dev vs packaged   │
└─────────────────────────────────────────────────────────┘
```

Przepływ pobrania: URL → `yt-dlp -J` → parse → lista formatów do UI → wybór →
selektor formatu (`bv*[height=X]+ba` / `ba`) → spawn yt-dlp → (ffmpeg mux/convert) →
plik w folderze docelowym → event `download:done`.

**Granica main/renderer** (kto co robi):
- Renderer: tylko UI i wywołania `window.api.*`. Zero `spawn`, `fs`, `path`, `child_process`.
- Main: wszystkie spawn-y, dostęp do dysku, dialogi systemowe, store.

---

## Model danych (interfejsy TS — `src/shared/`)

```ts
// FormatInfo — jeden wiersz w tabeli formatów
interface FormatInfo {
  formatId: string;          // yt-dlp format_id (itag)
  kind: 'video' | 'audio';   // video = ma strumień wideo
  ext: string;               // mp4 / webm / m4a / ...
  resolution?: string;       // "1920x1080" / "1080p" (dla wideo)
  height?: number;           // do sortowania i selektora bv*[height=X]
  fps?: number;
  vcodec?: string;           // avc1 / vp9 / av01 / "none"
  acodec?: string;           // opus / mp4a / "none"
  hasAudio: boolean;         // czy format zawiera już audio (progressive)
  tbr?: number;              // bitrate
  filesize?: number;         // bajty (filesize lub filesize_approx)
}

type DownloadMode = 'video+audio' | 'audio';
type VideoContainer = 'mp4' | 'mkv' | 'webm';
type AudioFormat   = 'mp3' | 'm4a' | 'opus' | 'wav';

interface DownloadJob {
  id: string;
  url: string;
  title?: string;
  mode: DownloadMode;
  formatId: string;                 // wybrany wideo format (dla video+audio)
  container?: VideoContainer;
  audioFormat?: AudioFormat;
  outputDir: string;
  status: 'queued' | 'downloading' | 'muxing' | 'done' | 'error' | 'canceled';
  progress: number;                 // 0..100
  speed?: string;
  eta?: string;
  errorPL?: string;
}

interface VideoMeta {            // wynik analyze
  url: string;
  title: string;
  durationSec: number;
  thumbnail?: string;
  formats: FormatInfo[];
}
```

Kanały IPC (`src/shared/ipc.ts`) — payloady typowane:
- `video:analyze`  `(url: string) => VideoMeta`
- `download:start` `(job: DownloadJob) => { id: string }`
- `download:cancel` `(id: string) => void`
- `download:progress` (event main→renderer) `=> { id, progress, speed, eta, status }`
- `download:done` / `download:error` (event) `=> { id, filePath } / { id, errorPL }`
- `dialog:pickOutputDir` `() => string | null`
- `store:getLastDir` `() => string | null`

---

## Strategia formatów

- **Budowa listy z `yt-dlp -J`**: bierzemy `formats[]`, klasyfikujemy:
  `vcodec!=='none'` → wideo; `vcodec==='none' && acodec!=='none'` → audio.
  Dedup po `(height, vcodec)` dla wideo i `(acodec, tbr)` dla audio. Sort wideo po `height`
  malejąco, potem fps. **Nie filtrujemy nic "dla wygody"** — pokazujemy wszystkie rozdzielczości.
- **Selektor pobierania**:
  - wideo+audio: `bv*[height=<H>]+ba/b[height=<H>]` (fallback na progressive)
  - tylko audio: `ba/b`
- **Macierz kontenerów (kiedy `-c copy`, kiedy rekodowanie)**:
  | vcodec | mp4 | mkv | webm |
  |--------|-----|-----|------|
  | avc1   | copy | copy | rekod. |
  | vp9    | rekod.→h264 | copy | copy |
  | av01   | copy(mp4 wspiera) | copy | copy |
  - audio do mp4/mkv: aac/m4a copy; opus do mp4 → rekod.; do mkv/webm → copy.
- **Konwersje audio (parametry ffmpeg)**:
  - mp3: `-c:a libmp3lame -q:a 0` (V0)
  - m4a: jeśli źródło aac → `-c:a copy`, inaczej `-c:a aac -b:a 192k`
  - opus: jeśli źródło opus → `-c:a copy`, inaczej `-c:a libopus -b:a 160k`
  - wav: `-c:a pcm_s16le`

---

## yt-dlp / ffmpeg provisioning

- Skrypt `scripts/fetch-bins.sh` (oraz `.ps1` dla Win) pobiera binarki do `bin/win/` i `bin/mac/`.
  `bin/` w `.gitignore`.
- Resolwowanie ścieżek w runtime:
  - dev: `path.join(process.cwd(), 'bin', platform)`
  - packaged: `path.join(process.resourcesPath, 'bin', platform)`
- electron-builder: `extraResources` kopiuje `bin/<platforma>` do `resources/bin`.
- Auto-update yt-dlp: przy starcie (best-effort, w tle) `yt-dlp -U`, błąd nie blokuje aplikacji.

---

## Parsowanie progressu

- `--progress-template "download:{\"p\":\"%(progress._percent_str)s\",\"s\":\"%(progress._speed_str)s\",\"e\":\"%(progress._eta_str)s\"}"`
  — jedna linia JSON na update.
- Parser w `YtDlpService` czyta stdout liniami, emituje `download:progress`.
- **Throttling**: max ~4 eventy/s do renderera (znacznik czasu ostatniego emita).
- Faza muxowania (ffmpeg) → status `muxing`, progress nieokreślony (spinner).

---

## UI (ekrany — wzorzec: standalone.html, struktura: tsx)

1. **Pasek URL**: input + przycisk „Analizuj". Walidacja URL YT.
2. **Wynik analizy**: tytuł + miniatura + czas; tabela formatów z radiobuttonami
   (kolumny: rozdzielczość, fps, kodek, audio?, rozmiar).
3. **Wybór trybu**: przełącznik Wideo+Audio / Tylko audio → odsłania selektor
   kontenera (MP4/MKV/WEBM) lub formatu audio (MP3/M4A/OPUS/WAV).
4. **Folder docelowy**: pokazana ścieżka (z `lastOutputDir`) + przycisk „Zmień".
5. **Kolejka**: lista zadań z progress barami, prędkością, ETA, przyciskiem Anuluj.
6. Komunikaty błędów po polsku (banner/toast).

Mocki z `youtube-downloader-ui.tsx` (downloadQueue, formats, qualities) zastępujemy danymi z IPC.

---

## Etapy implementacji

Każdy etap kończy się **działającym, zweryfikowanym** stanem. Status trzymamy tu jako checkboxy.
**Po każdym etapie obowiązuje BRAMKA WERYFIKACJI z sekcji „Testy" — bez zielonej bramki nie idziemy dalej.**

- [x] **Etap 1 — Skeleton + toolchain.** Electron + Vite + React + TS, `contextIsolation`,
      preload z `contextBridge`, jeden kanał IPC echo. Skrypty: `dev`, `build`, `typecheck`,
      `lint`. ESLint + tsconfig (strict).
      → Bramka: typecheck/lint/build zielone, okno startuje, echo IPC działa.
- [x] **Etap 2 — Provisioning binarek.** `scripts/fetch-bins`, resolver ścieżek dev/packaged,
      `bin/` w gitignore. → Bramka: aplikacja loguje wykrytą ścieżkę yt-dlp/ffmpeg i ich `--version`.
- [x] **Etap 3 — Analiza (`video:analyze`).** `YtDlpService.analyze` (spawn `-J`, parse),
      mapowanie do `FormatInfo[]`, IPC + tabela formatów w UI (realne dane zamiast mocków).
      → Bramka: liczba formatów w UI == liczba unikalnych w surowym JSON.
- [x] **Etap 4 — Pobieranie wideo+audio.** Selektor formatu, spawn download, mux ffmpeg
      (copy/rekod. wg macierzy), MP4/MKV/WEBM. → Bramka: ffprobe potwierdza strumienie, copy tam gdzie plan.
      (Mux: yt-dlp + --merge-output-format + --ffmpeg-location — odstępstwo od osobnej klasy FfmpegService,
      zaakceptowane; happy path, mniej kodu.)
- [x] **Etap 5 — Pobieranie audio.** MP3/M4A/OPUS/WAV wg parametrów ffmpeg.
      → Bramka: ffprobe potwierdza kodek/kontener każdego formatu.
- [x] **Etap 6 — Progress + anulowanie.** `--progress-template` (+ `--progress` wymagane dla pipe!),
      throttling ~4/s, kill drzewa procesów (taskkill /T), sprzątanie `.part`. → Bramka: progress płynny, anuluj zabija i czyści.
      (Bezpieczeństwo: pliki tymczasowe w `temp:<os-temp>/yt-grab/<jobId>`, sprzątane przy końcu/anulowaniu —
      nigdy nie ruszamy plików użytkownika w folderze docelowym.)
- [x] **Etap 7 — Folder + persystencja + kolejka.** `dialog:pickOutputDir`, electron-store
      `lastOutputDir`, kolejka sekwencyjna. → Bramka: folder przeżywa restart, kolejka leci po kolei.
      (Kolejka po stronie renderera — sterownik startuje kolejne 'queued' gdy nic się nie pobiera; single-window v1.
      Smoke interaktywny do potwierdzenia przy Etapie 7b.)
- [x] **Etap 7b — Skórka UI wg `YT-GRAB (standalone).html`.** Po skompletowaniu wszystkich
      elementów (analiza, formaty, pobieranie, progress, kolejka, folder) — jeden spójny przebieg
      przebudowy wyglądu renderera na docelowy design (kolory, layout, komponenty z referencji).
      Logika i IPC bez zmian. → Bramka: UI zgodne wizualnie z referencją; typecheck/lint/build; smoke.
      (Ciemny motyw #0a0b0d/#0d0e11, akcent #ff0033, Inter+JetBrains Mono; 2 kolumny: główny obszar
      + panel Kolejka. Zweryfikowane wizualnie (puppeteer) w 3 stanach: pusty / po analizie / audio.)
- [ ] **Etap 8 — Błędy PL + sanityzacja nazw.** Mapowanie błędów yt-dlp→PL, sanityzacja nazw
      (polskie znaki zachowane, znaki zakazane `/ : ? "` usunięte). → Bramka: błędne URL/prywatny film → PL, nazwy OK na Win.
- [ ] **Etap 9 — Pakowanie.** electron-builder (win+mac), `extraResources` z binarkami.
      → Bramka: paczka startuje i znajduje binarki z `resources`.

---

## Testy (BRAMKA WERYFIKACJI — wykonywana po KAŻDYM etapie)

Poziom: lekki, bez frameworka testowego (decyzja: zgodność z „brak over-engineeringu").
Po każdym etapie wykonuję **wszystkie** poniższe i **dokładnie sprawdzam wynik** — etap uznaję
za zamknięty dopiero gdy całość jest zielona. Wynik raportuję (output komend).

**A. Bramka automatyczna (zawsze, po każdym etapie):**
1. `npm run typecheck` (`tsc --noEmit`, strict) — **zero błędów**. Cała zmiana ma się typować.
2. `npm run lint` (ESLint, `--max-warnings 0`) — czysto.
3. `npm run build` — kompiluje się bez błędów.
4. Grep kontrolny: `src/renderer` nie zawiera `child_process` / `require('fs')` / `spawn`
   (renderer nie dotyka Node API).

**B. Smoke test ręczny (zakres zależny od etapu — minimum: „app startuje, brak błędów w konsoli"):**
- E1: okno startuje, echo IPC zwraca wartość, brak błędów w devtools.
- E2: log pokazuje ścieżki i `--version` yt-dlp + ffmpeg.
- E3: analiza realnego URL → tabela; **liczba formatów == liczba unikalnych w `yt-dlp -J`** (porównanie ręczne).
- E4: pobranie MP4/MKV/WEBM → `ffprobe` na pliku: poprawne strumienie; sprawdź czy był `-c copy` gdzie plan.
- E5: pobranie MP3/M4A/OPUS/WAV → `ffprobe`: kodek + kontener zgodne.
- E6: progress rośnie płynnie; Anuluj → procesy yt-dlp/ffmpeg zabite (Menedżer zadań), brak plików `.part`.
- E7: zmiana folderu → restart app → folder zapamiętany; kolejka 2-3 zadań leci sekwencyjnie.
- E8: URL prywatnego/usuniętego filmu → komunikat PL, app nie wisi; tytuł z `ą/ł/ó` i `/ : ? "` → poprawna nazwa pliku na Win.
- E9: zbudowana paczka startuje i znajduje binarki.

**C. Zasada raportowania:** po każdym etapie krótki raport: co działa (✅), output bramki A,
wynik smoke B. Jeśli cokolwiek czerwone — **nie przechodzę dalej**, naprawiam lub zgłaszam.

> Pełna checklista akceptacyjna projektu = `.claude/commands/validate.md` (uruchamiana na końcu,
> faza `/validate`). Bramka powyżej to jej podzbiór wykonywany inkrementalnie.

---

## Ryzyka i edge case'y

- **yt-dlp łamany przez zmiany YT** → auto-update `yt-dlp -U` przy starcie (best-effort).
- **SABR / PO-token** (część formatów wymaga) → jeśli format nie pobiera się, czytelny komunikat PL i sugestia update.
- **Długie nazwy plików / ścieżki na Win (260 znaków)** → skracanie tytułu w nazwie pliku.
- **Znaki specjalne w tytułach** → własna sanityzacja zachowująca polskie znaki (NIE `--restrict-filenames`).
- **Brak sieci / geo-block / film prywatny** → mapowanie stderr yt-dlp na komunikat PL.
- **Anulowanie w trakcie muxowania** → zabicie ffmpeg + usunięcie częściowego outputu i `.part`.
- **vp9→mp4** → wymaga rekodowania (wolne) — informujemy użytkownika statusem `muxing`.
- **standalone.html jest zbundlowany/zminifikowany** → służy tylko jako wizualna referencja
  (otwierana w przeglądarce); kod renderera piszemy od nowa w oparciu o `tsx` + ten wygląd.

---

## NIE robimy (poza scope v1)

- Playlisty, kanały, batch wielu URL naraz.
- Framework testowy (Vitest/Jest) i E2E (Playwright/WDIO) — świadomie pominięte w v1
  na rzecz bramki typecheck+lint+build+smoke. (Można dodać w v2 dla parsera formatów.)
- Logowanie do konta YT / cookies / treści wymagające subskrypcji.
- Edycja wideo, przycinanie, napisy (subtitles) — poza v1.
- Równoległe pobieranie (kolejka jest sekwencyjna w v1).
- Auto-aktualizacja samej aplikacji (tylko yt-dlp się aktualizuje).
