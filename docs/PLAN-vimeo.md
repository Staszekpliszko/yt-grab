# Plan: Obsługa Vimeo w YT-GRAB

Data: 2026-06-08
Status: DO ZATWIERDZENIA
Powiązanie: rozszerzenie głównego `docs/PLAN.md` (Etapy 1–9). Wchodzi jako równoległy
tor po Etapie 7b; Etap V5 spina się z Etapem 8 (błędy PL).

---

## Po co i czy w ogóle warto

yt-dlp obsługuje Vimeo natywnie (jeden z >1000 serwisów), więc cała maszyneria pobierania,
muxowania i progressu zadziała **bez zmian w backendzie pobierania**. Problem nie leży w
„czy yt-dlp umie", tylko w naszej **warstwie klasyfikacji formatów**, która jest dziś napisana
pod układ formatów YouTube (DASH: osobny strumień wideo + osobny audio, m3u8 jako duplikat).

### Dowód z realnego filmu (`vimeo.com/76979871`, `yt-dlp -J`)

Vimeo zwraca dwa rodzaje formatów:
- **`http-<res>-sd/hd-N`** — progresywne MP4 (wideo+audio w jednym pliku), `protocol=https`,
  ale **`vcodec=null` i `acodec=null`** (yt-dlp nie raportuje kodeków dla tych formatów).
- **`hls-<bitrate>`** / **`hls-audio-*`** — strumienie HLS, `protocol=m3u8_native`
  (osobno wideo, osobno audio).

### Dlaczego dziś dałoby ZERO formatów

W `src/main/ytdlp.ts → toVideoMeta`:
1. `if ((f.protocol ?? '').includes('m3u8')) continue` (ln. 104) — wycina **wszystkie** formaty `hls-*`.
2. `const hasVideo = !!f.vcodec && f.vcodec !== 'none'` + `if (!hasVideo && !hasAudio) continue`
   (ln. 107–109) — formaty `http-*` mają `vcodec=null`, więc lecą jako „nie-media" i też wypadają.

Efekt: po analizie Vimeo lista formatów jest **pusta**. To jest cały sedno zadania.

---

## Zakres

- **W zakresie:** pojedynczy film Vimeo (publiczny lub „unlisted" dostępny bez logowania),
  tryb Wideo+Audio (MP4/MKV/WEBM) i Tylko audio (MP3/M4A/OPUS/WAV).
- **Poza zakresem:** Vimeo wymagające hasła / logowania / DRM (Vimeo OTT), embed-only z
  weryfikacją referera, playlisty/kanały. Te przypadki → czytelny komunikat PL (Etap V5).

Decyzja produktowa: produkt rozszerza się z „pobieracz YouTube" na „YouTube + Vimeo"
(a technicznie — dowolny serwis yt-dlp). Branding YT-GRAB i UI bez rewolucji. CLAUDE.md i
główny PLAN.md zaktualizować w opisie po wdrożeniu (jednozdaniowo).

---

## Zasada nadrzędna: ZERO regresji dla YouTube — izolacja w NOWYCH plikach

Wymóg: kod Vimeo powstaje w **nowych, osobnych plikach** i **nie modyfikuje istniejącej logiki YT**.
Dotychczasowa ścieżka YouTube (`toVideoMeta`, `videoSelector`) zostaje **bajt w bajt nietknięta** —
to najmocniejsza możliwa gwarancja braku regresji.

Architektura (rozgałęzienie po źródle, nie przepisywanie wspólnego kodu):
- **Nowy plik** `src/main/sources/detect.ts` — `detectSource(url): 'youtube' | 'vimeo' | 'generic'`
  (proste dopasowanie domeny; brak twardego whitelista — `generic` też przechodzi).
- **Nowy plik** `src/main/sources/vimeo.ts` — `vimeoToVideoMeta(url, rawInfo): VideoMeta`
  oraz `vimeoVideoSelector(height, container): string`. Cała wiedza o HLS / `http-*` / `vcodec=null`
  żyje tutaj, odizolowana.
- **Punkt rozgałęzienia** (jedyna zmiana w istniejących plikach, minimalna i addytywna):
  w `ytdlp.ts → analyze` po `runJson` wybór mapera: `vimeo` → `vimeoToVideoMeta`,
  w pozostałych wypadkach → dotychczasowy `toVideoMeta` (bez zmian). Analogicznie selektor
  pobierania w `downloads.ts`. To kilka linii `if`, reszta to nowe moduły.

Zasada: jeśli coś jest wspólne i kuszące do „poprawienia" w `toVideoMeta` — **nie ruszamy**,
duplikujemy minimalnie w `vimeo.ts`. Bezpieczeństwo > DRY na tym etapie.

Bramka regresji (w każdym etapie V): `analyze` na referencyjnym URL YT z głównego planu →
**liczba i kolejność wierszy formatów identyczna jak przed zmianą** (a docelowo: ścieżka YT
w ogóle nie wykonuje nowego kodu).

---

## Etapy

### Etap V1 — Maper formatów Vimeo w NOWYM module + rozgałęzienie
Nowe pliki `src/main/sources/detect.ts` i `src/main/sources/vimeo.ts`; w `ytdlp.ts → analyze`
tylko dodać `if (detectSource(url) === 'vimeo') return vimeoToVideoMeta(url, info)`. Logika
`vimeoToVideoMeta` (w nowym pliku, niezależna od `toVideoMeta`):
- **Wykrywanie wideo:** format jest „wideo", gdy ma `height` > 0 i `vcodec !== 'none'`.
  Progresywne `http-*` Vimeo (`vcodec=null`, `height` set) → wideo z `hasAudio: true` (muxed).
- **Wykrywanie audio:** `vcodec === 'none'`/brak height, a cechy audio z `acodec`/`tbr` lub
  `format_id` `hls-audio-*`.
- **m3u8:** NIE wycinamy bezwarunkowo. Grupujemy po `qualityLabel`, w grupie preferujemy
  reprezentanta nie-m3u8 (http progresywny); HLS zostaje tylko dla jakości bez alternatywy.
- **Szacowanie rozmiaru:** progresywny (muxed) → rozmiar samego formatu; ewentualny DASH
  wideo-only → `+ bestAudioSize`. (W praktyce Vimeo to głównie progresywne.)
- **Etykieta jakości:** `format_note` Vimeo pusty → etykieta z `height` (720 → „720p");
  tagi 4K/HD liczone z height. (Można wydzielić wspólny helper do importu, byle nie zmieniać YT.)

→ **Bramka V1:**
- `analyze("https://vimeo.com/76979871")` → niepusta lista; liczba wierszy wideo == liczba
  unikalnych jakości (height) w `yt-dlp -J`; jest wiersz audio.
- Regresja YT: lista formatów dla URL z głównego planu bez zmian.
- `typecheck` + `lint` + `build` zielone.

### Etap V2 — Pobieranie wideo Vimeo + weryfikacja strumieni
- `vimeoVideoSelector` w `src/main/sources/vimeo.ts` (nowy, NIE dotykamy `videoSelector` YT).
  Dla progresywnych Vimeo selektor oparty na `b[height=H]` (best muxed na danej wysokości),
  z fallbackiem `bv*[height=H]+ba/b`. W `downloads.ts → buildArgs` jedyna zmiana: gdy źródło
  to Vimeo → użyj `vimeoVideoSelector`, inaczej dotychczasowy `videoSelector` (bez zmian).
- MKV/WEBM dla Vimeo: avc1 w MKV → copy; do WEBM rekodowanie (jak macierz w głównym planie).

→ **Bramka V2:** pobranie 720p Vimeo jako MP4 → `ffprobe`: obecny strumień **wideo i audio**;
plik otwiera się. Powtórzyć dla MKV.

### Etap V3 — Audio Vimeo
- Tryb Tylko audio: `-f ba/b -x --audio-format <fmt>`. Najlepsze audio Vimeo to `hls-audio-high`
  (m3u8) — yt-dlp pobiera HLS i ekstrahuje przez ffmpeg (bundlowany). Zweryfikować każdy format.

→ **Bramka V3:** MP3/M4A/OPUS/WAV z Vimeo → `ffprobe`: kodek + kontener zgodne.

### Etap V4 — UI / UX i (nie)walidacja URL
- Teksty: placeholder (`App.tsx:364`) i pusty stan (`App.tsx:391`) „YouTube" → „YouTube / Vimeo".
- Walidacja URL: **nie** wprowadzać twardego whitelista domen — `analyze()` i tak deleguje do
  yt-dlp, który obsługuje oba serwisy (i setki innych). Zostawiamy „wklej URL", a błędny/niewspierany
  link obsługuje komunikat błędu.
- (Opcjonalnie) drobny wskaźnik wykrytego źródła w karcie filmu (YouTube/Vimeo) — kosmetyka, można pominąć.

→ **Bramka V4:** pełny happy path z UI na linku Vimeo: wklej → Analizuj → wybór jakości →
Pobierz → plik na dysku; smoke wizualny (puppeteer) jak przy Etapie 7b.

### Etap V5 — Błędy PL specyficzne dla Vimeo (łączy się z Etapem 8)
- Mapowanie stderr yt-dlp na PL dla: film prywatny / chroniony hasłem / „tylko dla zalogowanych" /
  niedostępny w regionie / DRM. Realizowane razem z Etapem 8 głównego planu (jeden słownik błędów,
  rozszerzony o wzorce Vimeo).

→ **Bramka V5:** prywatny/hasłowany film Vimeo → komunikat PL, aplikacja nie wisi.

---

## Ryzyka i edge case'y

- **Tylko HLS w wyższych rozdzielczościach** — niektóre filmy Vimeo dają http tylko do 720/1080p,
  a wyższe jakości wyłącznie przez HLS. Dedup po jakości (V1) to obsłuży: HLS zostaje, gdy jest
  jedyny dla danej wysokości. Pobranie HLS = ffmpeg składa segmenty (wolniej, ale działa).
- **`vcodec/acodec = null` na http** — nie polegać na kodeku przy klasyfikacji; klucz to `height`
  i `protocol`. Kontener wyjściowy i tak narzuca `--merge-output-format`.
- **Regresja YouTube** — patrz „Zasada nadrzędna"; bramka regresji w każdym etapie.
- **Vimeo z hasłem / OTT / DRM** — poza zakresem, komunikat PL (V5).
- **Rozmiary `filesize_approx`** — Vimeo bywa skąpe w metadanych rozmiaru; UI ma już fallback „—".

---

## Czego NIE robimy

- Logowania do Vimeo / obsługi haseł / cookies.
- Playlist i kanałów Vimeo.
- Specjalnego brandingu/trybu „Vimeo" — jeden wspólny przepływ dla wszystkich źródeł.
