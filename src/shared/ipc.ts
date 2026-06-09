// Typowane kanały IPC — jedyne źródło prawdy współdzielone przez main, preload i renderer.
// Renderer NIGDY nie woła yt-dlp/ffmpeg bezpośrednio — tylko przez te kanały (patrz docs/PLAN.md).

export const IpcChannels = {
  /** Etap 1: kanał testowy main↔renderer. */
  echo: 'app:echo',
  /** Etap 2: wykrycie binarek (ścieżki + --version). */
  binariesCheck: 'binaries:check',
  /** Etap 3: analiza filmu (yt-dlp -J → lista formatów). */
  videoAnalyze: 'video:analyze',
  /** Playlisty: szybka analiza listy (yt-dlp --flat-playlist → wpisy bez formatów). */
  playlistAnalyze: 'playlist:analyze',
  /** Etap 6: start pobierania (zwraca jobId; postęp/koniec przez eventy). */
  downloadStart: 'download:start',
  /** Etap 6: anulowanie pobierania. */
  downloadCancel: 'download:cancel',
  /** Etap 6: event postępu (main→renderer). */
  downloadProgress: 'download:progress',
  /** Etap 6: event zakończenia (main→renderer). */
  downloadDone: 'download:done',
  /** Etap 6: event błędu (main→renderer). */
  downloadError: 'download:error',
  /** Etap 7: odczyt folderu docelowego (lastOutputDir lub Pobrane). */
  outputDirGet: 'dir:get',
  /** Etap 7: natywny dialog wyboru folderu (zapis do electron-store). */
  outputDirPick: 'dir:pick',
  /** Otwiera pobrany plik w domyślnej aplikacji. */
  fileOpen: 'file:open',
  /** Pokazuje pobrany plik w eksploratorze (zaznaczony). */
  fileReveal: 'file:reveal'
} as const

/** Status pojedynczej binarki (yt-dlp / ffmpeg / ffprobe). */
export interface BinaryStatus {
  name: string
  path: string
  found: boolean
  version?: string
  error?: string
}

/** Jeden format (wiersz w tabeli wyboru). */
export interface FormatInfo {
  formatId: string
  kind: 'video' | 'audio'
  ext: string
  resolution?: string
  /** Etykieta jakości wg YouTube (np. „2160p") — dla filmów nie-16:9 różna od height. */
  qualityLabel?: string
  /** Znacznik typu jakości: „8K" / „4K" / „HD". */
  qualityTag?: string
  height?: number
  fps?: number
  vcodec?: string
  acodec?: string
  hasAudio: boolean
  tbr?: number
  filesize?: number
}

/** Wynik analizy filmu. */
export interface VideoMeta {
  url: string
  title: string
  durationSec: number
  thumbnail?: string
  formats: FormatInfo[]
}

/** Jeden wpis playlisty (z --flat-playlist, bez listy formatów). */
export interface PlaylistEntry {
  id: string
  url: string
  title: string
  durationSec: number
}

/** Wynik szybkiej analizy playlisty. */
export interface PlaylistMeta {
  url: string
  title: string
  entries: PlaylistEntry[]
}

/**
 * Czy URL zawiera playlistę (parametr `list=`). Czysta funkcja bez zależności
 * node — używana też w rendererze do decyzji „pytać o zakres czy nie".
 * Pomijamy automiksy YT (list=RD…/UL…/RDMM…), bo to nieskończone radio, nie lista.
 */
export function hasPlaylistUrl(url: string): boolean {
  const m = url.match(/[?&]list=([^&]+)/)
  if (!m) return false
  const id = decodeURIComponent(m[1])
  return !/^(RD|UL|RDMM|RDCLAK)/.test(id)
}

export type VideoContainer = 'mp4' | 'mkv' | 'webm'
export type AudioFormat = 'mp3' | 'm4a' | 'opus' | 'wav'
export type DownloadKind = 'video' | 'audio'

/** Żądanie pobrania (wideo+audio lub tylko audio). */
export interface DownloadRequest {
  kind: DownloadKind
  url: string
  outputDir: string
  /** kind === 'video': docelowa wysokość strumienia (selektor) + auto best audio. */
  height?: number
  /** kind === 'video': etykieta jakości do nazwy pliku (np. „2160p"). */
  qualityLabel?: string
  container?: VideoContainer
  /** kind === 'audio': format docelowy. */
  audioFormat?: AudioFormat
}

export interface ProgressEvent {
  jobId: string
  percent: number
  speed: string
  eta: string
}

export interface DoneEvent {
  jobId: string
  filePath: string
}

export interface ErrorEvent {
  jobId: string
  error: string
}

/** API wystawiane do renderera przez preload (window.api). */
export interface Api {
  echo: (message: string) => Promise<string>
  checkBinaries: () => Promise<BinaryStatus[]>
  analyze: (url: string) => Promise<VideoMeta>
  /** Szybka analiza playlisty (wpisy bez formatów). */
  analyzePlaylist: (url: string) => Promise<PlaylistMeta>
  /** Zwraca aktualny folder docelowy (zapamiętany lub Pobrane). */
  getOutputDir: () => Promise<string>
  /** Otwiera dialog wyboru folderu; zwraca wybraną ścieżkę lub null (anulowano). */
  pickOutputDir: () => Promise<string | null>
  /** Otwiera pobrany plik w domyślnej aplikacji. */
  openFile: (path: string) => Promise<void>
  /** Pokazuje pobrany plik w eksploratorze (zaznaczony). */
  revealFile: (path: string) => Promise<void>
  /** Startuje pobranie i zwraca jobId. Postęp/koniec/błąd przez onProgress/onDone/onError. */
  startDownload: (req: DownloadRequest) => Promise<string>
  cancelDownload: (jobId: string) => Promise<void>
  /** Subskrypcje zdarzeń — zwracają funkcję odsubskrybowania. */
  onProgress: (cb: (e: ProgressEvent) => void) => () => void
  onDone: (cb: (e: DoneEvent) => void) => () => void
  onError: (cb: (e: ErrorEvent) => void) => () => void
}
