import { useEffect, useRef, useState } from 'react'
import type {
  AudioFormat,
  BinaryStatus,
  DownloadRequest,
  FormatInfo,
  VideoContainer,
  VideoMeta
} from '@shared/ipc'

function formatSize(bytes?: number): string {
  if (!bytes) return '—'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`
  return `${mb.toFixed(1)} MB`
}

function formatDuration(sec: number): string {
  if (!sec) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

// Surowe profile kodeków (avc1.640028, av01.0.08M.08…) są nieczytelne — pokazujemy przyjazne nazwy.
const VIDEO_CODECS: Record<string, string> = {
  avc1: 'H.264', avc3: 'H.264', h264: 'H.264',
  hev1: 'H.265', hvc1: 'H.265',
  vp9: 'VP9', vp09: 'VP9', vp8: 'VP8',
  av01: 'AV1', av1: 'AV1'
}
const AUDIO_CODECS: Record<string, string> = {
  mp4a: 'AAC', aac: 'AAC', opus: 'Opus', vorbis: 'Vorbis',
  mp3: 'MP3', 'ac-3': 'AC3', 'ec-3': 'E-AC3', flac: 'FLAC', dts: 'DTS'
}

function prettyCodec(codec: string | undefined, map: Record<string, string>): string {
  if (!codec) return '—'
  const base = codec.split('.')[0].toLowerCase()
  return map[base] ?? codec
}

type QueueStatus = 'queued' | 'downloading' | 'done' | 'error' | 'canceled'

interface QueueItem {
  id: string
  title: string
  label: string
  request: DownloadRequest
  status: QueueStatus
  percent: number
  speed?: string
  eta?: string
  jobId?: string
  filePath?: string
  error?: string
}

function FormatTable({
  title,
  rows,
  selected,
  onSelect
}: {
  title: string
  rows: FormatInfo[]
  selected: string | null
  onSelect: (id: string) => void
}) {
  if (rows.length === 0) return null
  const isVideo = rows[0]?.kind === 'video'
  return (
    <div style={{ marginTop: 16 }}>
      <h3 style={{ fontSize: 14, margin: '0 0 6px' }}>
        {title} <span style={{ color: '#888', fontWeight: 400 }}>({rows.length})</span>
      </h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#666', borderBottom: '1px solid #e5e5e5' }}>
            <th style={{ width: 28 }}></th>
            <th>{isVideo ? 'Rozdzielczość' : 'Kodek audio'}</th>
            <th>{isVideo ? 'FPS' : 'Bitrate'}</th>
            <th>{isVideo ? 'Kodek' : 'Format'}</th>
            {isVideo && <th>Audio?</th>}
            <th>Rozmiar</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr
              key={f.formatId}
              onClick={() => onSelect(f.formatId)}
              style={{
                cursor: 'pointer',
                borderBottom: '1px solid #f0f0f0',
                background: selected === f.formatId ? '#eef4ff' : 'transparent'
              }}
            >
              <td>
                <input type="radio" name="format" checked={selected === f.formatId} onChange={() => onSelect(f.formatId)} />
              </td>
              {isVideo ? (
                <>
                  <td>{f.resolution ?? '—'}</td>
                  <td>{f.fps ?? '—'}</td>
                  <td title={f.vcodec}>{prettyCodec(f.vcodec, VIDEO_CODECS)}</td>
                  <td>{f.hasAudio ? 'tak' : 'nie'}</td>
                </>
              ) : (
                <>
                  <td title={f.acodec}>{prettyCodec(f.acodec, AUDIO_CODECS)}</td>
                  <td>{f.tbr ? `${Math.round(f.tbr)}k` : '—'}</td>
                  <td>{f.ext}</td>
                </>
              )}
              <td>{formatSize(f.filesize)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const STATUS_LABEL: Record<QueueStatus, string> = {
  queued: 'w kolejce',
  downloading: 'pobieranie',
  done: 'gotowe',
  error: 'błąd',
  canceled: 'anulowano'
}

function QueueRow({ item, onCancelOrRemove }: { item: QueueItem; onCancelOrRemove: (i: QueueItem) => void }) {
  return (
    <li style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #eee', background: '#fff', listStyle: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.title}
          </div>
          <div style={{ fontSize: 12, color: '#888' }}>
            {item.label} · {STATUS_LABEL[item.status]}
          </div>
        </div>
        <button
          onClick={() => onCancelOrRemove(item)}
          style={{
            flexShrink: 0,
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid #ccc',
            background: '#fff',
            color: item.status === 'downloading' ? '#b42318' : '#666',
            cursor: 'pointer',
            fontSize: 12
          }}
        >
          {item.status === 'downloading' ? 'Anuluj' : 'Usuń'}
        </button>
      </div>

      {item.status === 'downloading' && (
        <div style={{ marginTop: 8 }}>
          <div style={{ height: 6, background: '#e5e5e5', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${item.percent}%`, height: '100%', background: '#0d6efd', transition: 'width .2s' }} />
          </div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
            {item.percent.toFixed(1)}% · {item.speed || '—'} · ETA {item.eta || '—'}
          </div>
        </div>
      )}
      {item.status === 'done' && item.filePath && (
        <div style={{ fontSize: 11, color: '#1a7f37', marginTop: 6, wordBreak: 'break-all' }}>✓ {item.filePath}</div>
      )}
      {item.status === 'error' && item.error && (
        <div style={{ fontSize: 11, color: '#b42318', marginTop: 6, whiteSpace: 'pre-wrap' }}>{item.error}</div>
      )}
    </li>
  )
}

export default function App() {
  const [url, setUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [meta, setMeta] = useState<VideoMeta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [bins, setBins] = useState<BinaryStatus[] | null>(null)

  const [mode, setMode] = useState<'video' | 'audio'>('video')
  const [container, setContainer] = useState<VideoContainer>('mp4')
  const [audioFormat, setAudioFormat] = useState<AudioFormat>('mp3')
  const [outputDir, setOutputDir] = useState('')

  const [queue, setQueue] = useState<QueueItem[]>([])
  const startingRef = useRef(false)

  useEffect(() => {
    window.api.checkBinaries().then(setBins)
    window.api.getOutputDir().then(setOutputDir)

    const offProgress = window.api.onProgress((e) =>
      setQueue((prev) => prev.map((i) => (i.jobId === e.jobId ? { ...i, percent: e.percent, speed: e.speed, eta: e.eta } : i)))
    )
    const offDone = window.api.onDone((e) =>
      setQueue((prev) => prev.map((i) => (i.jobId === e.jobId ? { ...i, status: 'done', percent: 100, filePath: e.filePath } : i)))
    )
    const offError = window.api.onError((e) =>
      setQueue((prev) => prev.map((i) => (i.jobId === e.jobId ? { ...i, status: 'error', error: e.error } : i)))
    )
    return () => {
      offProgress()
      offDone()
      offError()
    }
  }, [])

  // Sterownik kolejki: gdy nic się nie pobiera, startuj następne 'queued' (sekwencyjnie).
  useEffect(() => {
    if (startingRef.current) return
    if (queue.some((i) => i.status === 'downloading')) return
    const next = queue.find((i) => i.status === 'queued')
    if (!next) return

    startingRef.current = true
    window.api
      .startDownload(next.request)
      .then((jobId) => {
        setQueue((prev) => prev.map((i) => (i.id === next.id ? { ...i, status: 'downloading', jobId, percent: 0 } : i)))
      })
      .catch((e) => {
        setQueue((prev) => prev.map((i) => (i.id === next.id ? { ...i, status: 'error', error: String(e) } : i)))
      })
      .finally(() => {
        startingRef.current = false
      })
  }, [queue])

  async function analyze() {
    if (!url.trim()) return
    setAnalyzing(true)
    setError(null)
    setMeta(null)
    setSelected(null)
    try {
      const result = await window.api.analyze(url.trim())
      setMeta(result)
      setSelected(result.formats.find((f) => f.kind === 'video')?.formatId ?? result.formats[0]?.formatId ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setAnalyzing(false)
    }
  }

  async function pickFolder() {
    const dir = await window.api.pickOutputDir()
    if (dir) setOutputDir(dir)
  }

  function addToQueue() {
    if (!meta) return
    if (mode === 'video' && !selected) return
    const sel = meta.formats.find((f) => f.formatId === selected)
    const label = mode === 'video' ? `${sel?.resolution ?? '?'} · ${container.toUpperCase()}` : `Audio · ${audioFormat.toUpperCase()}`
    const request: DownloadRequest =
      mode === 'video'
        ? { kind: 'video', url: meta.url, formatId: selected!, container, outputDir }
        : { kind: 'audio', url: meta.url, audioFormat, outputDir }
    const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setQueue((prev) => [...prev, { id, title: meta.title, label, request, status: 'queued', percent: 0 }])
  }

  function cancelOrRemove(item: QueueItem) {
    if (item.status === 'downloading' && item.jobId) {
      window.api.cancelDownload(item.jobId)
      setQueue((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'canceled' } : i)))
    } else {
      setQueue((prev) => prev.filter((i) => i.id !== item.id))
    }
  }

  const videos = meta?.formats.filter((f) => f.kind === 'video') ?? []
  const audios = meta?.formats.filter((f) => f.kind === 'audio') ?? []

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, color: '#1a1a1a', maxWidth: 820, margin: '0 auto' }}>
      <h1 style={{ margin: 0 }}>YT-GRAB</h1>
      <p style={{ color: '#666', marginTop: 4 }}>Analiza, kolejka i pobieranie (Etap 7).</p>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && analyze()}
          placeholder="Wklej link do filmu YouTube…"
          style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14 }}
        />
        <button
          onClick={analyze}
          disabled={analyzing || !url.trim()}
          style={{
            padding: '10px 18px', borderRadius: 8, border: 'none',
            background: analyzing ? '#999' : '#ff0033', color: '#fff', fontWeight: 600,
            cursor: analyzing ? 'default' : 'pointer'
          }}
        >
          {analyzing ? 'Analizuję…' : 'Analizuj'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, fontSize: 13 }}>
        <span style={{ color: '#666' }}>Folder:</span>
        <span style={{ flex: 1, color: '#333', wordBreak: 'break-all' }}>{outputDir || '…'}</span>
        <button
          onClick={pickFolder}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}
        >
          Zmień
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 8, background: '#fdeeee', border: '1px solid #f0c6c6', color: '#b42318', whiteSpace: 'pre-wrap' }}>
          {error}
        </div>
      )}

      {meta && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            {meta.thumbnail && <img src={meta.thumbnail} alt="" style={{ width: 160, borderRadius: 8, flexShrink: 0 }} />}
            <div>
              <h2 style={{ fontSize: 17, margin: 0 }}>{meta.title}</h2>
              <p style={{ color: '#666', margin: '4px 0' }}>
                Czas: {formatDuration(meta.durationSec)} · Formatów: {meta.formats.length}
              </p>
            </div>
          </div>

          <FormatTable title="Wideo" rows={videos} selected={selected} onSelect={setSelected} />
          <FormatTable title="Audio" rows={audios} selected={selected} onSelect={setSelected} />

          <div style={{ marginTop: 20, padding: 16, borderRadius: 10, background: '#f7f7f5', border: '1px solid #eee' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {(['video', 'audio'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    padding: '6px 12px', borderRadius: 6, border: '1px solid #ccc',
                    background: mode === m ? '#1a1a1a' : '#fff', color: mode === m ? '#fff' : '#333',
                    cursor: 'pointer', fontSize: 13
                  }}
                >
                  {m === 'video' ? 'Wideo + Audio' : 'Tylko audio'}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {mode === 'video' ? (
                <label>
                  Kontener:{' '}
                  <select value={container} onChange={(e) => setContainer(e.target.value as VideoContainer)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #ccc' }}>
                    <option value="mp4">MP4</option>
                    <option value="mkv">MKV</option>
                    <option value="webm">WEBM</option>
                  </select>
                </label>
              ) : (
                <label>
                  Format:{' '}
                  <select value={audioFormat} onChange={(e) => setAudioFormat(e.target.value as AudioFormat)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #ccc' }}>
                    <option value="mp3">MP3</option>
                    <option value="m4a">M4A</option>
                    <option value="opus">OPUS</option>
                    <option value="wav">WAV</option>
                  </select>
                </label>
              )}
              <button
                onClick={addToQueue}
                disabled={mode === 'video' && !selected}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#0d6efd', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
              >
                Dodaj do kolejki
              </button>
            </div>

            {mode === 'audio' && (
              <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
                Pobierane jest najlepsze dostępne audio (zaznaczenie w tabeli nie jest używane w tym trybie).
              </div>
            )}
          </div>
        </div>
      )}

      {queue.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16, margin: '0 0 10px' }}>
            Kolejka <span style={{ color: '#888', fontWeight: 400 }}>({queue.length})</span>
          </h2>
          <ul style={{ display: 'grid', gap: 8, padding: 0, margin: 0 }}>
            {queue.map((item) => (
              <QueueRow key={item.id} item={item} onCancelOrRemove={cancelOrRemove} />
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: 28, paddingTop: 12, borderTop: '1px solid #eee', fontSize: 12, color: '#999' }}>
        Binarki:{' '}
        {bins === null ? 'sprawdzam…' : bins.map((b) => `${b.name} ${b.found && b.version ? '✓' : '✗'}`).join('  ·  ')}
      </div>
    </div>
  )
}
