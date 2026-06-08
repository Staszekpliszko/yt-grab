// Maper formatów Vimeo — ODIZOLOWANY od ścieżki YouTube (src/main/ytdlp.ts).
// Powód istnienia: Vimeo zwraca formaty inaczej niż YT —
//   • progresywne `http-*` (wideo+audio w jednym pliku) mają `vcodec=null`/`acodec=null`,
//   • wideo w wyższych jakościach bywa tylko jako HLS (`protocol=m3u8_native`).
// Ścieżka YT odrzuciłaby jedne i drugie (filtr m3u8 + filtr „nie-media"), dając pustą listę.
// Tu klasyfikujemy po `height`/`protocol`, a nie po obecności kodeka.

import type { FormatInfo, VideoMeta } from '@shared/ipc'
import type { RawFormat, RawInfo } from '../ytdlp'

const codecBase = (codec?: string | null): string => (codec ? codec.split('.')[0] : '')
const sizeOf = (f: RawFormat): number => f.filesize ?? f.filesize_approx ?? 0
const isHls = (f: RawFormat): boolean => (f.protocol ?? '').includes('m3u8')

/** Etykieta jakości — Vimeo ma pusty `format_note`, więc realnie leci z `height` (720 → „720p"). */
function qualityLabelOf(note?: string | null, height?: number | null): string {
  const m = note?.match(/^\d{2,4}p\d*/)
  if (m) return m[0]
  return height ? `${height}p` : '—'
}

function qualityTagOf(label: string): string | undefined {
  const n = parseInt(label, 10)
  if (!n) return undefined
  if (n >= 4320) return '8K'
  if (n >= 2160) return '4K'
  if (n >= 1080) return 'HD'
  return undefined
}

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

export function vimeoToVideoMeta(url: string, info: RawInfo): VideoMeta {
  const raw = info.formats ?? []
  const videoFormats: RawFormat[] = []
  const audios: FormatInfo[] = []

  for (const f of raw) {
    const hasHeight = (f.height ?? 0) > 0
    // Wideo: ma wysokość i kodek wideo NIE jest jawnie 'none' (null = progresywny http Vimeo).
    const isVideo = f.vcodec !== 'none' && hasHeight
    if (isVideo) {
      videoFormats.push(f)
      continue
    }
    // Audio: nie-wideo wyglądające na ścieżkę dźwięku (hls-audio-*, vcodec=none, lub acodec ustawiony).
    const looksAudio =
      f.vcodec === 'none' ||
      (f.acodec != null && f.acodec !== 'none') ||
      f.format_id.startsWith('hls-audio')
    if (looksAudio) {
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

  const bestAudioSize = audios.reduce((mx, a) => Math.max(mx, a.filesize ?? 0), 0)

  // Grupowanie po etykiecie jakości → jeden wiersz na jakość.
  const groups = new Map<string, RawFormat[]>()
  for (const f of videoFormats) {
    const label = qualityLabelOf(f.format_note, f.height)
    const g = groups.get(label)
    if (g) g.push(f)
    else groups.set(label, [f])
  }

  const videos: FormatInfo[] = []
  for (const [label, list] of groups) {
    // Preferuj reprezentanta progresywnego (http, nie-HLS) — prostszy, muxed, bez składania.
    const nonHls = list.filter((f) => !isHls(f))
    const pool = nonHls.length ? nonHls : list
    const rep = [...pool].sort((a, b) => sizeOf(b) - sizeOf(a))[0]
    const muxed = !isHls(rep) // progresywny http Vimeo = ma już audio
    const height = list.reduce((mx, f) => Math.max(mx, f.height ?? 0), 0)
    const repSize = sizeOf(rep)
    const total = muxed ? repSize : repSize + bestAudioSize

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
      hasAudio: true, // po pobraniu (progresywny lub merge) zawsze z dźwiękiem
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

/**
 * Selektor pobierania wideo dla Vimeo. Vimeo udostępnia głównie progresywne MP4
 * (muxed) — celujemy w best muxed na danej wysokości, z fallbackiem na składanie
 * wideo+audio (gdy daną jakość daje tylko HLS, np. video-only + osobne audio).
 */
export function vimeoVideoSelector(height: number | undefined): string {
  if (!height) return 'b/bv*+ba'
  const h = `[height>=${height}][height<=${height}]`
  return `b${h}/bv*${h}+ba/b/bv*+ba`
}
