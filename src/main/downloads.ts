import { type ChildProcess, execFile, spawn } from 'child_process'
import { mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { app, type WebContents } from 'electron'
import { binariesDir, ytDlpPath } from './binaries'
import { detectSource } from './sources/detect'
import { vimeoVideoSelector } from './sources/vimeo'
import {
  IpcChannels,
  type DoneEvent,
  type DownloadRequest,
  type ErrorEvent,
  type ProgressEvent
} from '@shared/ipc'

interface Job {
  child: ChildProcess
  tmpDir: string
  canceled: boolean
}

const PROGRESS_PREFIX = 'PROG:'
const THROTTLE_MS = 250 // ~4 eventy/s

/**
 * Zarządza pobraniami: spawn yt-dlp z progressem na żywo, anulowanie z killem
 * drzewa procesów (yt-dlp + ffmpeg) i sprzątaniem. Pliki tymczasowe (.part itd.)
 * trafiają do dedykowanego temp-folderu per zadanie — nigdy nie ruszamy cudzych plików.
 */
export class DownloadManager {
  private jobs = new Map<string, Job>()
  private counter = 0

  start(req: DownloadRequest, sender: WebContents): string {
    const jobId = `job-${++this.counter}-${Date.now()}`
    const tmpDir = join(app.getPath('temp'), 'yt-grab', jobId)
    mkdirSync(tmpDir, { recursive: true })

    const child = spawn(ytDlpPath(), this.buildArgs(req, tmpDir))
    this.jobs.set(jobId, { child, tmpDir, canceled: false })

    let printOut = ''
    let err = ''
    let lastEmit = 0

    child.stdout.on('data', (chunk: Buffer) => {
      for (const raw of chunk.toString().split('\n')) {
        const line = raw.trim()
        if (!line) continue
        if (line.startsWith(PROGRESS_PREFIX)) {
          const now = Date.now()
          if (now - lastEmit >= THROTTLE_MS) {
            lastEmit = now
            sender.send(IpcChannels.downloadProgress, this.parseProgress(jobId, line))
          }
        } else {
          // Linia nie-progressowa = output --print after_move:filepath.
          printOut += line + '\n'
        }
      }
    })
    child.stderr.on('data', (d: Buffer) => {
      err += d.toString()
    })

    child.on('error', (e) => {
      this.cleanup(jobId)
      sender.send(IpcChannels.downloadError, { jobId, error: e.message } satisfies ErrorEvent)
    })
    child.on('close', (code) => {
      const canceled = this.jobs.get(jobId)?.canceled ?? false
      this.cleanup(jobId)
      if (canceled) return // anulowanie obsłużone po stronie renderera
      if (code === 0) {
        const filePath = printOut.trim().split('\n').map((l) => l.trim()).filter(Boolean).pop() ?? ''
        sender.send(IpcChannels.downloadDone, { jobId, filePath } satisfies DoneEvent)
      } else {
        sender.send(IpcChannels.downloadError, {
          jobId,
          error: err.trim() || `yt-dlp zakończył się kodem ${code}.`
        } satisfies ErrorEvent)
      }
    })

    return jobId
  }

  cancel(jobId: string): void {
    const job = this.jobs.get(jobId)
    if (!job) return
    job.canceled = true
    this.killTree(job.child)
    // Sprzątanie temp (.part itd.) nastąpi w handlerze 'close'.
  }

  private cleanup(jobId: string): void {
    const job = this.jobs.get(jobId)
    if (!job) return
    try {
      rmSync(job.tmpDir, { recursive: true, force: true })
    } catch {
      /* best-effort */
    }
    this.jobs.delete(jobId)
  }

  private killTree(child: ChildProcess): void {
    if (!child.pid) return
    if (process.platform === 'win32') {
      // Drzewo procesów (yt-dlp + ffmpeg) ubijamy przez taskkill /T.
      execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => {})
    } else {
      try {
        child.kill('SIGKILL')
      } catch {
        /* best-effort */
      }
    }
  }

  private buildArgs(req: DownloadRequest, tmpDir: string): string[] {
    const tail = [
      '--ffmpeg-location',
      binariesDir(),
      '-P',
      `home:${req.outputDir}`,
      '-P',
      `temp:${tmpDir}`,
      '--newline',
      '--progress',
      '--progress-template',
      `${PROGRESS_PREFIX}%(progress._percent_str)s;%(progress._speed_str)s;%(progress._eta_str)s`,
      '--no-playlist',
      '--no-simulate',
      '--print',
      'after_move:filepath',
      req.url
    ]

    if (req.kind === 'video') {
      const isVimeo = detectSource(req.url) === 'vimeo'
      // Vimeo daje h264/aac → WEBM niemożliwy bez rekodowania, schodzimy do MP4.
      const container = isVimeo && req.container === 'webm' ? 'mp4' : req.container ?? 'mp4'
      const label = req.qualityLabel?.replace(/[\\/:*?"<>|]/g, '')
      // Vimeo używa własnego selektora (progresywne muxed); pozostałe źródła — dotychczasowy YT-owy.
      const selector = isVimeo
        ? vimeoVideoSelector(req.height)
        : this.videoSelector(req.height, container)
      // Vimeo bywa pojedynczym progresywnym plikiem → --merge-output-format jest wtedy ignorowany;
      // --remux-video wymusza kontener (MKV) przez przepakowanie bez rekodowania (copy).
      const remux = isVimeo ? ['--remux-video', container] : []
      return [
        '-f',
        selector,
        '--merge-output-format',
        container,
        ...remux,
        '-o',
        label ? `%(title)s [${label}].%(ext)s` : '%(title)s [%(height)sp].%(ext)s',
        ...tail
      ]
    }

    const quality = req.audioFormat === 'mp3' ? ['--audio-quality', '0'] : []
    return [
      '-f',
      'ba/b',
      '-x',
      '--audio-format',
      req.audioFormat ?? 'mp3',
      ...quality,
      '-o',
      '%(title)s.%(ext)s',
      ...tail
    ]
  }

  /**
   * Selektor formatu wideo po wysokości i kontenerze. Zawsze dokleja `+ba`
   * (best audio) → plik wynikowy MA dźwięk. Dla MP4 preferujemy kodek
   * mp4-natywny (av01/avc1) + audio m4a, by uniknąć „niemego" VP9/Opus w MP4.
   */
  private videoSelector(height: number | undefined, container: string): string {
    if (!height) return 'bv*+ba/b'
    const h = `[height>=${height}][height<=${height}]`
    if (container === 'mp4') {
      return `bv*${h}[vcodec~='^(avc1|av01)']+ba[ext=m4a]/bv*${h}+ba/b${h}/bv*+ba/b`
    }
    if (container === 'webm') {
      return `bv*${h}[vcodec~='^(vp9|av01)']+ba/bv*${h}+ba/b${h}/bv*+ba/b`
    }
    return `bv*${h}+ba/b${h}/bv*+ba/b`
  }

  private parseProgress(jobId: string, line: string): ProgressEvent {
    const [p, speed, eta] = line.slice(PROGRESS_PREFIX.length).split(';')
    return {
      jobId,
      percent: parseFloat((p ?? '').replace('%', '').trim()) || 0,
      speed: (speed ?? '').trim(),
      eta: (eta ?? '').trim()
    }
  }
}
