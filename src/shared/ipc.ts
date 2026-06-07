// Typowane kanały IPC — jedyne źródło prawdy współdzielone przez main, preload i renderer.
// Renderer NIGDY nie woła yt-dlp/ffmpeg bezpośrednio — tylko przez te kanały (patrz docs/PLAN.md).

export const IpcChannels = {
  /** Etap 1: kanał testowy main↔renderer (zostanie usunięty w późniejszych etapach). */
  echo: 'app:echo',
  /** Etap 2: wykrycie binarek (ścieżki + --version). */
  binariesCheck: 'binaries:check',
  /** Etap 3: analiza filmu (yt-dlp -J → lista formatów). */
  videoAnalyze: 'video:analyze'
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

/** API wystawiane do renderera przez preload (window.api). */
export interface Api {
  echo: (message: string) => Promise<string>
  checkBinaries: () => Promise<BinaryStatus[]>
  analyze: (url: string) => Promise<VideoMeta>
}
