import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { BinaryStatus } from '@shared/ipc'

const isWin = process.platform === 'win32'
const exe = (name: string): string => (isWin ? `${name}.exe` : name)

/**
 * Katalog z binarkami.
 * - dev: <root projektu>/bin/<platforma>
 * - packaged: <resources>/bin/<platforma>  (electron-builder: extraResources)
 */
function binDir(): string {
  const platform = isWin ? 'win' : 'mac'
  const base = app.isPackaged ? process.resourcesPath : process.cwd()
  return join(base, 'bin', platform)
}

/** Katalog z binarkami — przekazywany do yt-dlp jako --ffmpeg-location. */
export function binariesDir(): string {
  return binDir()
}

export function ytDlpPath(): string {
  return join(binDir(), exe('yt-dlp'))
}

export function ffmpegPath(): string {
  return join(binDir(), exe('ffmpeg'))
}

export function ffprobePath(): string {
  return join(binDir(), exe('ffprobe'))
}

/** Uruchamia binarkę z argumentem wersji i zwraca pierwszą linię stdout. */
function runVersion(filePath: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    let out = ''
    let settled = false
    const child = spawn(filePath, args)

    child.stdout.on('data', (chunk) => {
      out += chunk.toString()
    })
    child.on('error', (err) => {
      if (settled) return
      settled = true
      reject(err)
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      if (code === 0) {
        resolve(out.split('\n')[0]?.trim() ?? '')
      } else {
        reject(new Error(`kod wyjścia ${code}`))
      }
    })
  })
}

/**
 * Wykrywa yt-dlp, ffmpeg i ffprobe: sprawdza obecność pliku i odczytuje wersję.
 * Brak binarki nie jest błędem krytycznym — zwracamy found:false z podpowiedzią.
 */
export async function checkBinaries(): Promise<BinaryStatus[]> {
  const defs = [
    { name: 'yt-dlp', path: ytDlpPath(), args: ['--version'] },
    { name: 'ffmpeg', path: ffmpegPath(), args: ['-version'] },
    { name: 'ffprobe', path: ffprobePath(), args: ['-version'] }
  ]

  const results: BinaryStatus[] = []
  for (const def of defs) {
    if (!existsSync(def.path)) {
      results.push({
        name: def.name,
        path: def.path,
        found: false,
        error: 'nie znaleziono — uruchom: npm run fetch-bins:win (Windows) lub npm run fetch-bins:mac (macOS)'
      })
      continue
    }
    try {
      const version = await runVersion(def.path, def.args)
      results.push({ name: def.name, path: def.path, found: true, version })
    } catch (err) {
      results.push({ name: def.name, path: def.path, found: true, error: (err as Error).message })
    }
  }
  return results
}
