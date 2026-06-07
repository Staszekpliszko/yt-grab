// Typowane kanały IPC — jedyne źródło prawdy współdzielone przez main, preload i renderer.
// Renderer NIGDY nie woła yt-dlp/ffmpeg bezpośrednio — tylko przez te kanały (patrz docs/PLAN.md).

export const IpcChannels = {
  /** Etap 1: kanał testowy main↔renderer (zostanie usunięty w późniejszych etapach). */
  echo: 'app:echo'
} as const

/** API wystawiane do renderera przez preload (window.api). */
export interface Api {
  echo: (message: string) => Promise<string>
}
