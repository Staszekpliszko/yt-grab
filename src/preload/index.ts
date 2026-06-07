import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels, type Api } from '@shared/ipc'

const api: Api = {
  echo: (message: string) => ipcRenderer.invoke(IpcChannels.echo, message)
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
