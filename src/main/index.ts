import { join } from 'path'
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { IpcChannels, type DownloadRequest } from '@shared/ipc'
import { checkBinaries } from './binaries'
import { YtDlpService } from './ytdlp'
import { DownloadManager } from './downloads'
import { getOutputDir, setOutputDir } from './store'

const ytDlp = new YtDlpService()
const downloads = new DownloadManager()

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
  // Etap 6: start/anulowanie pobierania (postęp przez eventy download:progress/done/error).
  ipcMain.handle(IpcChannels.downloadStart, (event, req: DownloadRequest) => downloads.start(req, event.sender))
  ipcMain.handle(IpcChannels.downloadCancel, (_event, jobId: string) => downloads.cancel(jobId))
  // Etap 7: odczyt folderu docelowego (lastOutputDir z electron-store lub Pobrane).
  ipcMain.handle(IpcChannels.outputDirGet, () => getOutputDir())
  // Etap 7: natywny dialog wyboru folderu; zapis do electron-store.
  ipcMain.handle(IpcChannels.outputDirPick, async () => {
    const win = BrowserWindow.getFocusedWindow()
    const opts: Electron.OpenDialogOptions = { properties: ['openDirectory'], defaultPath: getOutputDir() }
    const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (result.canceled || result.filePaths.length === 0) return null
    const dir = result.filePaths[0]
    setOutputDir(dir)
    return dir
  })
  // Otwarcie pobranego pliku w domyślnej aplikacji / pokazanie w eksploratorze.
  ipcMain.handle(IpcChannels.fileOpen, (_event, path: string) => shell.openPath(path))
  ipcMain.handle(IpcChannels.fileReveal, (_event, path: string) => shell.showItemInFolder(path))
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
