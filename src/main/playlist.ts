import { spawn } from 'child_process'
import { ytDlpPath } from './binaries'
import { mapErrorToPL } from './errors'
import type { PlaylistEntry, PlaylistMeta } from '@shared/ipc'

/** Surowy wpis z `yt-dlp --flat-playlist -J` (podzbiór pól, których używamy). */
interface RawEntry {
  id?: string
  url?: string
  webpage_url?: string
  title?: string
  duration?: number
}

interface RawPlaylist {
  title?: string
  entries?: RawEntry[]
}

/**
 * Szybka analiza playlisty: `--flat-playlist` NIE pobiera formatów każdego filmu
 * (to byłoby wolne dla długich list) — zwraca tylko id/tytuł/czas trwania.
 * Formaty rozwiązujemy później: per-URL przy pobieraniu (Metoda A) lub przez
 * pełną `analyze()` w stepperze (Metoda B). Ścieżka pojedynczego filmu bez zmian.
 */
export class PlaylistService {
  async analyze(url: string): Promise<PlaylistMeta> {
    const raw = await this.runJson(url)
    const entries: PlaylistEntry[] = (raw.entries ?? [])
      .filter((e) => e.id || e.url)
      .map((e) => ({
        id: e.id ?? '',
        url: this.entryUrl(e),
        title: e.title ?? 'Bez tytułu',
        durationSec: e.duration ?? 0
      }))
    return {
      url,
      title: raw.title ?? 'Playlista',
      entries
    }
  }

  /** Stabilny URL wpisu: preferuj webpage_url, potem pełny url, w ostateczności złóż z id. */
  private entryUrl(e: RawEntry): string {
    if (e.webpage_url) return e.webpage_url
    if (e.url && /^https?:\/\//.test(e.url)) return e.url
    return `https://www.youtube.com/watch?v=${e.id ?? e.url ?? ''}`
  }

  private runJson(url: string): Promise<RawPlaylist> {
    return new Promise((resolve, reject) => {
      let out = ''
      let err = ''
      // --flat-playlist: nie wchodzi w każdy film (szybko). --yes-playlist: nie ignoruj listy.
      const child = spawn(ytDlpPath(), ['-J', '--flat-playlist', '--yes-playlist', url])

      child.stdout.on('data', (d) => {
        out += d.toString()
      })
      child.stderr.on('data', (d) => {
        err += d.toString()
      })
      child.on('error', reject)
      child.on('close', (code) => {
        if (code === 0) {
          try {
            resolve(JSON.parse(out) as RawPlaylist)
          } catch {
            reject(new Error('Nie udało się sparsować playlisty (yt-dlp --flat-playlist).'))
          }
        } else {
          reject(new Error(mapErrorToPL(err)))
        }
      })
    })
  }
}
