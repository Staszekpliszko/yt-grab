import { spawn } from 'child_process'
import { ytDlpPath } from './binaries'
import type { FormatInfo, VideoMeta } from '@shared/ipc'
import { detectSource } from './sources/detect'
import { vimeoToVideoMeta } from './sources/vimeo'

/** Podzbiór pól z `yt-dlp -J`, których faktycznie używamy. */
export interface RawFormat {
  format_id: string
  ext: string
  vcodec?: string | null
  acodec?: string | null
  height?: number | null
  fps?: number | null
  tbr?: number | null
  filesize?: number | null
  filesize_approx?: number | null
  resolution?: string | null
  format_note?: string | null
  protocol?: string | null
}

export interface RawInfo {
  title?: string
  duration?: number
  thumbnail?: string
  formats?: RawFormat[]
}

const codecBase = (codec?: string): string => (codec ? codec.split('.')[0] : '')

/** Zachowuje pierwszy element dla danego klucza (lista wejściowa już posortowana malejąco jakością). */
function dedupBy(list: FormatInfo[], key: (f: FormatInfo) => string): FormatInfo[] {
  const seen = new Set<string>()
  const out: FormatInfo[] = []
  for (const f of list) {
    const k = key(f)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(f)
  }
  return out
}

/**
 * Etykieta jakości wg YouTube (np. „2160p", „1080p60") — kluczowe dla filmów
 * nie-16:9, gdzie height (np. 1620) różni się od nazwy YT (2160p).
 */
function qualityLabelOf(note?: string | null, height?: number | null): string {
  const m = note?.match(/^\d{2,4}p\d*/)
  if (m) return m[0]
  return height ? `${height}p` : '—'
}

/** „8K" / „4K" / „HD" na podstawie liczby z etykiety jakości. */
function qualityTagOf(label: string): string | undefined {
  const n = parseInt(label, 10)
  if (!n) return undefined
  if (n >= 4320) return '8K'
  if (n >= 2160) return '4K'
  if (n >= 1080) return 'HD'
  return undefined
}

export class YtDlpService {
  /** Analizuje pojedynczy film i zwraca listę formatów dla UI. */
  async analyze(url: string): Promise<VideoMeta> {
    const info = await this.runJson(url)
    // Vimeo ma odmienny układ formatów → osobny, odizolowany maper. Ścieżka YT bez zmian.
    if (detectSource(url) === 'vimeo') return vimeoToVideoMeta(url, info)
    return this.toVideoMeta(url, info)
  }

  private runJson(url: string): Promise<RawInfo> {
    return new Promise((resolve, reject) => {
      let out = ''
      let err = ''
      const child = spawn(ytDlpPath(), ['-J', '--no-playlist', url])

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
            resolve(JSON.parse(out) as RawInfo)
          } catch {
            reject(new Error('Nie udało się sparsować odpowiedzi yt-dlp (-J).'))
          }
        } else {
          // Pełne mapowanie błędów na PL przyjdzie w Etapie 8 — na razie surowy stderr.
          reject(new Error(err.trim() || `yt-dlp zakończył się kodem ${code}.`))
        }
      })
    })
  }

  private toVideoMeta(url: string, info: RawInfo): VideoMeta {
    const raw = info.formats ?? []
    const rawVideos: RawFormat[] = []
    const audios: FormatInfo[] = []

    for (const f of raw) {
      // Pomijamy strumienie HLS (m3u8) — to duplikaty DASH-a, zaśmiecają listę.
      if ((f.protocol ?? '').includes('m3u8')) continue

      const hasVideo = !!f.vcodec && f.vcodec !== 'none'
      const hasAudio = !!f.acodec && f.acodec !== 'none'
      if (!hasVideo && !hasAudio) continue // storyboardy / nie-media

      if (hasVideo) {
        rawVideos.push(f)
      } else {
        audios.push({
          formatId: f.format_id,
          kind: 'audio',
          ext: f.ext,
          acodec: f.acodec ?? undefined,
          hasAudio: true,
          tbr: f.tbr ?? undefined,
          filesize: f.filesize ?? f.filesize_approx ?? undefined
        })
      }
    }

    // Najlepsze audio (do oszacowania rozmiaru „wideo+audio" w wierszu jakości).
    const sizeOf = (f: RawFormat) => f.filesize ?? f.filesize_approx ?? 0
    const bestAudioSize = audios.reduce((mx, a) => Math.max(mx, a.filesize ?? 0), 0)

    // Grupowanie wideo po etykiecie jakości → JEDEN wiersz na jakość (każdy = wideo+audio po merge).
    const groups = new Map<string, RawFormat[]>()
    for (const f of rawVideos) {
      const label = qualityLabelOf(f.format_note, f.height)
      const g = groups.get(label)
      if (g) g.push(f)
      else groups.set(label, [f])
    }

    const codecRank: Record<string, number> = { av01: 0, avc1: 1, vp9: 2 }
    const videos: FormatInfo[] = []
    for (const [label, list] of groups) {
      // Reprezentant: najmniejszy rozmiar wideo (zwykle AV1) — taki realnie pobierzemy.
      const minVideoSize = list.reduce(
        (mn, f) => (sizeOf(f) > 0 && sizeOf(f) < mn ? sizeOf(f) : mn),
        Infinity
      )
      const rep = [...list].sort(
        (a, b) =>
          (codecRank[codecBase(a.vcodec ?? undefined)] ?? 9) -
          (codecRank[codecBase(b.vcodec ?? undefined)] ?? 9)
      )[0]
      const height = list.reduce((mx, f) => Math.max(mx, f.height ?? 0), 0)
      const total = (minVideoSize === Infinity ? 0 : minVideoSize) + bestAudioSize

      videos.push({
        formatId: rep.format_id,
        kind: 'video',
        ext: rep.ext,
        resolution: label,
        qualityLabel: label,
        qualityTag: qualityTagOf(label),
        height: height || undefined,
        fps: rep.fps ?? undefined,
        vcodec: rep.vcodec ?? undefined,
        hasAudio: true, // po merge zawsze z dźwiękiem
        filesize: total || undefined
      })
    }

    videos.sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.fps ?? 0) - (a.fps ?? 0))
    audios.sort((a, b) => (b.tbr ?? 0) - (a.tbr ?? 0))
    const uniqueAudios = dedupBy(audios, (a) => `${codecBase(a.acodec)}|${Math.round(a.tbr ?? 0)}`)

    return {
      url,
      title: info.title ?? 'Bez tytułu',
      durationSec: info.duration ?? 0,
      thumbnail: info.thumbnail,
      formats: [...videos, ...uniqueAudios]
    }
  }
}
