// Typowane kanały IPC — jedyne źródło prawdy współdzielone przez main, preload i renderer.
// Renderer NIGDY nie woła yt-dlp/ffmpeg bezpośrednio — tylko przez te kanały (patrz docs/PLAN.md).

export const IpcChannels = {
  /** Etap 1: kanał testowy main↔renderer (zostanie usunięty w późniejszych etapach). */
  echo: 'app:echo',
  /** Etap 2: wykrycie binarek (ścieżki + --version). */
  binariesCheck: 'binaries:check'
} as const

/** Status pojedynczej binarki (yt-dlp / ffmpeg / ffprobe). */
export interface BinaryStatus {
  name: string
  path: string
  found: boolean
  version?: string
  error?: string
}

/** API wystawiane do renderera przez preload (window.api). */
export interface Api {
  echo: (message: string) => Promise<string>
  checkBinaries: () => Promise<BinaryStatus[]>
}
