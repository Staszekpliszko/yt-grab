import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IpcChannels,
  type Api,
  type DoneEvent,
  type ErrorEvent,
  type ProgressEvent
} from '@shared/ipc'

/** Pomocnik subskrypcji eventu main→renderer; zwraca funkcję odsubskrybowania. */
function subscribe<T>(channel: string, cb: (data: T) => void): () => void {
  const handler = (_e: IpcRendererEvent, data: T): void => cb(data)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: Api = {
  echo: (message: string) => ipcRenderer.invoke(IpcChannels.echo, message),
  checkBinaries: () => ipcRenderer.invoke(IpcChannels.binariesCheck),
  analyze: (url: string) => ipcRenderer.invoke(IpcChannels.videoAnalyze, url),
  getOutputDir: () => ipcRenderer.invoke(IpcChannels.outputDirGet),
  pickOutputDir: () => ipcRenderer.invoke(IpcChannels.outputDirPick),
  startDownload: (req) => ipcRenderer.invoke(IpcChannels.downloadStart, req),
  cancelDownload: (jobId) => ipcRenderer.invoke(IpcChannels.downloadCancel, jobId),
  onProgress: (cb) => subscribe<ProgressEvent>(IpcChannels.downloadProgress, cb),
  onDone: (cb) => subscribe<DoneEvent>(IpcChannels.downloadDone, cb),
  onError: (cb) => subscribe<ErrorEvent>(IpcChannels.downloadError, cb)
}

// contextIsolation jest włączone (patrz main/index.ts), więc mostkujemy przez contextBridge.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('[preload] exposeInMainWorld failed:', error)
  }
} else {
  // Ścieżka awaryjna (nie powinna wystąpić przy contextIsolation: true).
  ;(window as unknown as { api: Api }).api = api
}
