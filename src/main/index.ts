import { join } from 'path'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { IpcChannels } from '@shared/ipc'
import { checkBinaries } from './binaries'
import { YtDlpService } from './ytdlp'

const ytDlp = new YtDlpService()

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 880,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())

  // Linki zewnętrzne otwieramy w przeglądarce systemowej, nie w oknie aplikacji.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  // Etap 1: echo. Kolejne etapy dokładają tu video:analyze, download:*, dialog:*.
  ipcMain.handle(IpcChannels.echo, (_event, message: string): string => `echo: ${message}`)
  // Etap 2: wykrycie binarek (ścieżki + --version).
  ipcMain.handle(IpcChannels.binariesCheck, () => checkBinaries())
  // Etap 3: analiza filmu (yt-dlp -J → lista formatów).
  ipcMain.handle(IpcChannels.videoAnalyze, (_event, url: string) => ytDlp.analyze(url))
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()

  // Bramka Etapu 2: zaloguj wykryte ścieżki i wersje binarek przy starcie.
  checkBinaries().then((bins) => {
    for (const b of bins) {
      if (b.found && b.version) {
        console.log(`[binaries] ${b.name}: ${b.version}  (${b.path})`)
      } else {
        console.warn(`[binaries] ${b.name}: ${b.error}  (${b.path})`)
      }
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
