import { spawn } from 'child_process'
import { binariesDir, ytDlpPath } from './binaries'
import type {
  DownloadAudioRequest,
  DownloadResult,
  DownloadVideoRequest,
  FormatInfo,
  VideoMeta
} from '@shared/ipc'

/** Podzbiór pól z `yt-dlp -J`, których faktycznie używamy. */
interface RawFormat {
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
}

interface RawInfo {
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

export class YtDlpService {
  /** Analizuje pojedynczy film i zwraca listę formatów dla UI. */
  async analyze(url: string): Promise<VideoMeta> {
    const info = await this.runJson(url)
    return this.toVideoMeta(url, info)
  }

  /**
   * Pobiera wybrany format wideo + najlepsze audio i scala do kontenera
   * (mux robi yt-dlp przez nasz ffmpeg; domyślnie -c copy, rekodowanie tylko gdy konieczne).
   */
  downloadVideo(req: DownloadVideoRequest): Promise<DownloadResult> {
    return this.runDownload([
      '-f',
      `${req.formatId}+ba/${req.formatId}`,
      '--merge-output-format',
      req.container,
      '--ffmpeg-location',
      binariesDir(),
      '-P',
      req.outputDir,
      '-o',
      '%(title)s [%(height)sp].%(ext)s',
      ...this.commonDownloadArgs(req.url)
    ])
  }

  /**
   * Pobiera najlepsze audio (ba) i ekstrahuje do wybranego formatu.
   * yt-dlp kopiuje strumień gdy format pasuje (m4a←aac, opus←opus), rekoduje gdy trzeba
   * (mp3 = libmp3lame V0 przez --audio-quality 0, wav = pcm_s16le).
   */
  downloadAudio(req: DownloadAudioRequest): Promise<DownloadResult> {
    const quality = req.audioFormat === 'mp3' ? ['--audio-quality', '0'] : []
    return this.runDownload([
      '-f',
      'ba/b',
      '-x',
      '--audio-format',
      req.audioFormat,
      ...quality,
      '--ffmpeg-location',
      binariesDir(),
      '-P',
      req.outputDir,
      '-o',
      '%(title)s.%(ext)s',
      ...this.commonDownloadArgs(req.url)
    ])
  }

  /** Wspólne argumenty kończące każde pobranie (no-playlist + druk finalnej ścieżki). */
  private commonDownloadArgs(url: string): string[] {
    return ['--no-playlist', '--no-simulate', '--print', 'after_move:filepath', url]
  }

  /** Uruchamia yt-dlp z podanymi argumentami i zwraca finalną ścieżkę (after_move:filepath). */
  private runDownload(args: string[]): Promise<DownloadResult> {
    return new Promise((resolve, reject) => {
      let out = ''
      let err = ''
      const child = spawn(ytDlpPath(), args)

      child.stdout.on('data', (d) => {
        out += d.toString()
      })
      child.stderr.on('data', (d) => {
        err += d.toString()
      })
      child.on('error', reject)
      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(err.trim() || `yt-dlp zakończył się kodem ${code}.`))
          return
        }
        const filePath = out.trim().split('\n').map((l) => l.trim()).filter(Boolean).pop()
        if (!filePath) {
          reject(new Error('Pobrano, ale nie udało się ustalić ścieżki pliku wyjściowego.'))
          return
        }
        resolve({ filePath })
      })
    })
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
    const videos: FormatInfo[] = []
    const audios: FormatInfo[] = []

    for (const f of raw) {
      const hasVideo = !!f.vcodec && f.vcodec !== 'none'
      const hasAudio = !!f.acodec && f.acodec !== 'none'
      if (!hasVideo && !hasAudio) continue // storyboardy / nie-media — to nie są ścieżki do pobrania

      const fi: FormatInfo = {
        formatId: f.format_id,
        kind: hasVideo ? 'video' : 'audio',
        ext: f.ext,
        resolution: hasVideo ? (f.height ? `${f.height}p` : f.resolution ?? undefined) : undefined,
        height: hasVideo ? f.height ?? undefined : undefined,
        fps: f.fps ?? undefined,
        vcodec: hasVideo ? f.vcodec ?? undefined : undefined,
        acodec: hasAudio ? f.acodec ?? undefined : undefined,
        hasAudio,
        tbr: f.tbr ?? undefined,
        filesize: f.filesize ?? f.filesize_approx ?? undefined
      }

      if (hasVideo) videos.push(fi)
      else audios.push(fi)
    }

    // Sort: wideo po rozdzielczości → fps → bitrate (malejąco); audio po bitrate.
    videos.sort(
      (a, b) =>
        (b.height ?? 0) - (a.height ?? 0) ||
        (b.fps ?? 0) - (a.fps ?? 0) ||
        (b.tbr ?? 0) - (a.tbr ?? 0)
    )
    audios.sort((a, b) => (b.tbr ?? 0) - (a.tbr ?? 0))

    // Dedup: wideo po (height, kodek, fps); audio po (kodek, bitrate).
    const uniqueVideos = dedupBy(videos, (v) => `${v.height}|${codecBase(v.vcodec)}|${v.fps ?? ''}`)
    const uniqueAudios = dedupBy(audios, (a) => `${codecBase(a.acodec)}|${Math.round(a.tbr ?? 0)}`)

    return {
      url,
      title: info.title ?? 'Bez tytułu',
      durationSec: info.duration ?? 0,
      thumbnail: info.thumbnail,
      formats: [...uniqueVideos, ...uniqueAudios]
    }
  }
}
