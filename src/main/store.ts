import { app } from 'electron'
import Store from 'electron-store'

interface Schema {
  lastOutputDir?: string
}

const store = new Store<Schema>()

/** Ostatni folder docelowy; gdy brak — systemowy katalog Pobrane. */
export function getOutputDir(): string {
  return store.get('lastOutputDir') ?? app.getPath('downloads')
}

export function setOutputDir(dir: string): void {
  store.set('lastOutputDir', dir)
}
