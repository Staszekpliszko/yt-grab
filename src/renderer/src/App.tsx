import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type {
  AudioFormat,
  BinaryStatus,
  DownloadRequest,
  FormatInfo,
  VideoContainer,
  VideoMeta
} from '@shared/ipc'

/* ── Paleta wyciągnięta z YT-GRAB (standalone).html ── */
const C = {
  bg: '#0a0b0d',
  panel: '#0d0e11',
  surface: '#15171b',
  surface2: '#191c21',
  border: '#23272e',
  borderStrong: '#30353d',
  text: '#e8eaed',
  muted: '#939aa4',
  dim: '#646b75',
  red: '#ff0033',
  green: '#34d27f',
  blue: '#5aa9ff',
  amber: '#e0a33e',
  err: '#ff5a7a'
}
const MONO = "'JetBrains Mono', ui-monospace, Consolas, monospace"

/* ── Helpery ── */
function formatSize(bytes?: number): string {
  if (!bytes) return '—'
  const mb = bytes / (1024 * 1024)
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(0)} MB`
}
function formatDuration(sec: number): string {
  if (!sec) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}
const AUDIO_CODECS: Record<string, string> = {
  mp4a: 'AAC', aac: 'AAC', opus: 'Opus', vorbis: 'Vorbis',
  mp3: 'MP3', 'ac-3': 'AC3', 'ec-3': 'E-AC3', flac: 'FLAC', dts: 'DTS'
}
function prettyCodec(codec: string | undefined, map: Record<string, string>): string {
  if (!codec) return '—'
  return map[codec.split('.')[0].toLowerCase()] ?? codec
}

/* ── Ikony (inline SVG) ── */
const Ico = {
  download: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12M7 11l5 5 5-5M5 21h14" />
    </svg>
  ),
  search: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
    </svg>
  ),
  folder: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  )
}

/* ── Typy kolejki ── */
type QueueStatus = 'queued' | 'downloading' | 'done' | 'error' | 'canceled'
interface QueueItem {
  id: string
  title: string
  meta: string
  request: DownloadRequest
  status: QueueStatus
  percent: number
  speed?: string
  eta?: string
  jobId?: string
  filePath?: string
  error?: string
}

/* ── Tabela formatów ── */
function FormatTable({
  rows,
  selected,
  onSelect
}: {
  rows: FormatInfo[]
  selected: string | null
  onSelect: (id: string) => void
}) {
  const isVideo = rows[0]?.kind === 'video'
  const th: CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 11, letterSpacing: '.04em', color: C.dim, fontWeight: 600, textTransform: 'uppercase' }
  return (
    <div style={{ marginTop: 14, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: C.surface }}>
            <th style={{ ...th, width: 34 }}></th>
            {isVideo ? (
              <>
                <th style={th}>Jakość</th>
                <th style={th}>FPS</th>
                <th style={th}>Rozmiar</th>
              </>
            ) : (
              <>
                <th style={th}>Kodek</th>
                <th style={th}>Bitrate</th>
                <th style={th}>Format</th>
                <th style={th}>Rozmiar</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => {
            const sel = selected === f.formatId
            const td: CSSProperties = { padding: '9px 10px', borderTop: `1px solid ${C.border}` }
            return (
              <tr
                key={f.formatId}
                onClick={() => onSelect(f.formatId)}
                style={{ cursor: 'pointer', background: sel ? C.surface2 : 'transparent', boxShadow: sel ? `inset 3px 0 0 ${C.red}` : 'none' }}
              >
                <td style={{ ...td, textAlign: 'center' }}>
                  <span
                    style={{
                      display: 'inline-block', width: 13, height: 13, borderRadius: '50%',
                      border: `2px solid ${sel ? C.red : C.dim}`, background: sel ? C.red : 'transparent',
                      boxShadow: sel ? `inset 0 0 0 2px ${C.panel}` : 'none'
                    }}
                  />
                </td>
                {isVideo ? (
                  <>
                    <td style={{ ...td, fontWeight: 600 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        {f.qualityLabel ?? f.resolution ?? '—'}
                        {f.qualityTag && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: C.red, border: `1px solid ${C.red}`, borderRadius: 4, padding: '0 4px', letterSpacing: '.03em' }}>{f.qualityTag}</span>
                        )}
                        {f.fps && f.fps >= 48 && <sup style={{ color: C.red, fontSize: 10 }}>{f.fps}</sup>}
                      </span>
                    </td>
                    <td style={{ ...td, color: C.muted, fontFamily: MONO }}>{f.fps ?? '—'}</td>
                    <td style={{ ...td, fontFamily: MONO }}>{formatSize(f.filesize)}</td>
                  </>
                ) : (
                  <>
                    <td style={{ ...td, fontWeight: 600 }} title={f.acodec}>{prettyCodec(f.acodec, AUDIO_CODECS)}</td>
                    <td style={{ ...td, color: C.muted, fontFamily: MONO }}>{f.tbr ? `${Math.round(f.tbr)}k` : '—'}</td>
                    <td style={{ ...td, color: C.muted, fontFamily: MONO }}>{f.ext}</td>
                    <td style={{ ...td, fontFamily: MONO }}>{formatSize(f.filesize)}</td>
                  </>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ── Karta zadania w kolejce ── */
const STATUS = {
  queued: { label: 'w kolejce', color: C.muted, bar: C.dim },
  downloading: { label: 'pobieranie', color: C.amber, bar: C.amber },
  done: { label: 'gotowe', color: C.green, bar: C.green },
  error: { label: 'błąd', color: C.err, bar: C.err },
  canceled: { label: 'anulowano', color: C.dim, bar: C.dim }
} as const

function QueueCard({ item, onRemove, onRetry }: { item: QueueItem; onRemove: (i: QueueItem) => void; onRetry: (i: QueueItem) => void }) {
  const st = STATUS[item.status]
  const isErr = item.status === 'error'
  return (
    <li style={{
      listStyle: 'none', padding: 12, borderRadius: 10, background: C.surface,
      border: `1px solid ${isErr ? '#3a2030' : C.border}`,
      boxShadow: isErr ? `inset 3px 0 0 ${C.err}` : 'none'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
          <div style={{ fontSize: 11, color: C.muted, fontFamily: MONO, marginTop: 2 }}>{item.meta}</div>
        </div>
        <button onClick={() => onRemove(item)} title={item.status === 'downloading' ? 'Anuluj' : 'Usuń'}
          style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', lineHeight: 1 }}>✕</button>
      </div>

      {(item.status === 'downloading' || item.status === 'done') && (
        <div style={{ height: 5, background: '#000', borderRadius: 3, overflow: 'hidden', marginTop: 10 }}>
          <div style={{ width: `${item.percent}%`, height: '100%', background: st.bar, transition: 'width .2s' }} />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontSize: 11, color: st.color }}>
          {item.status === 'downloading' && `${item.percent.toFixed(0)}% · ${item.speed || '—'} · ETA ${item.eta || '—'}`}
          {item.status === 'done' && '✓ Gotowe'}
          {item.status === 'error' && `⚠ ${item.error}`}
          {item.status === 'queued' && st.label}
          {item.status === 'canceled' && st.label}
        </span>
        {isErr && (
          <button onClick={() => onRetry(item)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, cursor: 'pointer' }}>↻ Ponów</button>
        )}
      </div>
      {item.status === 'done' && item.filePath && (
        <>
          <div style={{ fontSize: 10, color: C.dim, marginTop: 4, wordBreak: 'break-all', fontFamily: MONO }}>{item.filePath}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => window.api.openFile(item.filePath!)}
              style={{ flex: 1, fontSize: 12, padding: '6px 10px', borderRadius: 7, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, cursor: 'pointer' }}>
              ▶ Otwórz plik
            </button>
            <button onClick={() => window.api.revealFile(item.filePath!)}
              style={{ flex: 1, fontSize: 12, padding: '6px 10px', borderRadius: 7, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, cursor: 'pointer' }}>
              📁 Otwórz folder
            </button>
          </div>
        </>
      )}
    </li>
  )
}

/* ── Aplikacja ── */
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
    const offP = window.api.onProgress((e) => setQueue((q) => q.map((i) => (i.jobId === e.jobId ? { ...i, percent: e.percent, speed: e.speed, eta: e.eta } : i))))
    const offD = window.api.onDone((e) => setQueue((q) => q.map((i) => (i.jobId === e.jobId ? { ...i, status: 'done', percent: 100, filePath: e.filePath } : i))))
    const offE = window.api.onError((e) => setQueue((q) => q.map((i) => (i.jobId === e.jobId ? { ...i, status: 'error', error: e.error } : i))))
    return () => { offP(); offD(); offE() }
  }, [])

  // Sterownik kolejki — sekwencyjnie startuje kolejne 'queued'.
  useEffect(() => {
    if (startingRef.current || queue.some((i) => i.status === 'downloading')) return
    const next = queue.find((i) => i.status === 'queued')
    if (!next) return
    startingRef.current = true
    window.api.startDownload(next.request)
      .then((jobId) => setQueue((q) => q.map((i) => (i.id === next.id ? { ...i, status: 'downloading', jobId, percent: 0 } : i))))
      .catch((e) => setQueue((q) => q.map((i) => (i.id === next.id ? { ...i, status: 'error', error: String(e) } : i))))
      .finally(() => { startingRef.current = false })
  }, [queue])

  async function analyze() {
    if (!url.trim()) return
    setAnalyzing(true); setError(null); setMeta(null); setSelected(null)
    try {
      const r = await window.api.analyze(url.trim())
      setMeta(r)
      setSelected(r.formats.find((f) => f.kind === 'video')?.formatId ?? r.formats[0]?.formatId ?? null)
      setMode('video')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setAnalyzing(false)
    }
  }

  function switchMode(m: 'video' | 'audio') {
    setMode(m)
    if (meta) setSelected(meta.formats.find((f) => f.kind === m)?.formatId ?? null)
  }

  async function pickFolder() {
    const dir = await window.api.pickOutputDir()
    if (dir) setOutputDir(dir)
  }

  function addToQueue() {
    if (!meta) return
    const sel = meta.formats.find((f) => f.formatId === selected)
    if (mode === 'video') {
      if (!sel || sel.kind !== 'video') return
      const effContainer = isVimeo && container === 'webm' ? 'mp4' : container
      const m = `${sel.qualityLabel ?? sel.resolution ?? '?'} · ${effContainer.toUpperCase()}`
      addItem(m, { kind: 'video', url: meta.url, height: sel.height, qualityLabel: sel.qualityLabel, container, outputDir })
    } else {
      addItem(`${audioFormat.toUpperCase()} · best audio`, { kind: 'audio', url: meta.url, audioFormat, outputDir })
    }
  }
  function addItem(metaLine: string, request: DownloadRequest) {
    const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setQueue((q) => [...q, { id, title: meta?.title ?? 'Pobieranie', meta: metaLine, request, status: 'queued', percent: 0 }])
  }
  function removeItem(item: QueueItem) {
    if (item.status === 'downloading' && item.jobId) {
      window.api.cancelDownload(item.jobId)
      setQueue((q) => q.map((i) => (i.id === item.id ? { ...i, status: 'canceled' } : i)))
    } else {
      setQueue((q) => q.filter((i) => i.id !== item.id))
    }
  }
  function retryItem(item: QueueItem) {
    setQueue((q) => q.map((i) => (i.id === item.id ? { ...i, status: 'queued', percent: 0, error: undefined, jobId: undefined } : i)))
  }
  function clearFinished() {
    setQueue((q) => q.filter((i) => i.status === 'queued' || i.status === 'downloading'))
  }

  const rows = meta ? meta.formats.filter((f) => f.kind === mode) : []
  const selectedFmt = meta?.formats.find((f) => f.formatId === selected)
  // Vimeo serwuje H.264/AAC → WEBM wymagałby rekodowania; pokazujemy MP4 i informujemy.
  const isVimeo = /vimeo\.com/i.test(meta?.url ?? '')
  const vimeoWebmFallback = isVimeo && mode === 'video' && container === 'webm'
  const doneCount = queue.filter((i) => i.status === 'done').length
  const btnSize = mode === 'video' ? formatSize(selectedFmt?.filesize) : ''

  /* ── Style współdzielone ── */
  const card: CSSProperties = { background: C.panel, border: `1px solid ${C.borderStrong}`, borderRadius: 12 }
  const toggleBtn = (active: boolean): CSSProperties => ({
    padding: '7px 14px', borderRadius: 7, border: `1px solid ${active ? 'transparent' : C.border}`,
    background: active ? (C.red) : 'transparent', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer'
  })
  const segBtn = (active: boolean): CSSProperties => ({
    padding: '7px 14px', borderRadius: 7, border: 'none',
    background: active ? C.surface2 : 'transparent', color: active ? C.text : C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer'
  })

  return (
    <div style={{ minHeight: '100vh', padding: 18, boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 6px 14px' }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: C.red, display: 'grid', placeItems: 'center', color: '#fff' }}>{Ico.download(17)}</div>
        <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: '.02em' }}>
          <span style={{ color: '#fff' }}>YT</span><span style={{ color: C.red }}>-GRAB</span>
        </div>
        <span style={{ color: C.dim, fontSize: 12, fontFamily: MONO }}>v0.1.0</span>
      </div>

      {/* URL bar */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', ...card, borderColor: C.border }}>
          <span style={{ color: C.dim }}>🔗</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && analyze()}
            placeholder="Wklej adres URL filmu z YouTube lub Vimeo…"
            style={{ flex: 1, padding: '13px 0', border: 'none', outline: 'none', background: 'transparent', color: C.text, fontSize: 14 }}
          />
          {url && <button onClick={() => setUrl('')} style={{ border: 'none', background: 'transparent', color: C.dim, cursor: 'pointer', fontSize: 16 }}>✕</button>}
        </div>
        <button
          onClick={analyze}
          disabled={analyzing || !url.trim()}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 22px', borderRadius: 12, border: 'none', background: analyzing || !url.trim() ? '#5a1020' : C.red, color: '#fff', fontWeight: 700, fontSize: 14, cursor: analyzing || !url.trim() ? 'default' : 'pointer' }}
        >
          {Ico.search(16)} {analyzing ? 'Analizuję…' : 'Analizuj'}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 14, padding: '11px 14px', borderRadius: 10, background: '#211519', border: '1px solid #3a2030', color: C.err, whiteSpace: 'pre-wrap', fontSize: 13 }}>{error}</div>
      )}

      {/* Układ jednokolumnowy: główny obszar, a pod nim kolejka na pełną szerokość */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
        {/* Główny obszar */}
        <div style={{ ...card, padding: 16, minHeight: 420 }}>
          {!meta ? (
            <div style={{ height: 420, display: 'grid', placeItems: 'center', textAlign: 'center', color: C.muted }}>
              <div>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: C.surface, display: 'grid', placeItems: 'center', margin: '0 auto 14px', color: C.muted }}>{Ico.search(24)}</div>
                <div style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>Brak wczytanego filmu</div>
                <div style={{ fontSize: 13, marginTop: 6, maxWidth: 320 }}>Wklej adres URL z YouTube lub Vimeo powyżej i kliknij „Analizuj", aby pobrać listę dostępnych formatów.</div>
              </div>
            </div>
          ) : (
            <>
              {/* Karta filmu */}
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ position: 'relative', width: 168, flexShrink: 0 }}>
                  {meta.thumbnail
                    ? <img src={meta.thumbnail} alt="" style={{ width: '100%', borderRadius: 10, display: 'block' }} />
                    : <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: 10, background: C.surface }} />}
                  <span style={{ position: 'absolute', right: 6, bottom: 6, background: 'rgba(0,0,0,.8)', color: '#fff', fontSize: 11, padding: '1px 6px', borderRadius: 4, fontFamily: MONO }}>{formatDuration(meta.durationSec)}</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ fontSize: 16, margin: 0, lineHeight: 1.3 }}>{meta.title}</h2>
                  <div style={{ color: C.muted, fontSize: 12, marginTop: 8, fontFamily: MONO }}>{meta.formats.length} formatów · {formatDuration(meta.durationSec)}</div>
                </div>
              </div>

              <FormatTable rows={rows} selected={selected} onSelect={setSelected} />

              {/* TRYB / FORMAT */}
              <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: C.dim, fontWeight: 600 }}>TRYB</span>
                  <div style={{ display: 'flex', gap: 4, background: C.surface, padding: 4, borderRadius: 10 }}>
                    <button onClick={() => switchMode('video')} style={toggleBtn(mode === 'video')}>Wideo+Audio</button>
                    <button onClick={() => switchMode('audio')} style={mode === 'audio' ? toggleBtn(true) : segBtn(false)}>Tylko audio</button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: C.dim, fontWeight: 600 }}>FORMAT</span>
                  <div style={{ display: 'flex', gap: 4, background: C.surface, padding: 4, borderRadius: 10 }}>
                    {mode === 'video'
                      ? (['mp4', 'mkv', 'webm'] as VideoContainer[]).map((c) => (
                          <button key={c} onClick={() => setContainer(c)} style={segBtn(container === c)}>{c.toUpperCase()}</button>
                        ))
                      : (['mp3', 'm4a', 'opus', 'wav'] as AudioFormat[]).map((a) => (
                          <button key={a} onClick={() => setAudioFormat(a)} style={segBtn(audioFormat === a)}>{a.toUpperCase()}</button>
                        ))}
                  </div>
                </div>
              </div>

              {vimeoWebmFallback && (
                <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 9, background: '#2a2417', border: '1px solid #4a3d1e', color: C.amber, fontSize: 12 }}>
                  Vimeo udostępnia wideo w H.264/AAC — WEBM wymagałby rekodowania, więc plik zostanie zapisany jako <b>MP4</b>.
                </div>
              )}

              {/* Folder */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, padding: '10px 12px', background: C.surface, borderRadius: 10 }}>
                <span style={{ color: C.dim }}>{Ico.folder(16)}</span>
                <span style={{ flex: 1, fontSize: 12, color: C.muted, fontFamily: MONO, wordBreak: 'break-all' }}>{outputDir || '…'}</span>
                <button onClick={pickFolder} style={{ padding: '6px 14px', borderRadius: 7, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, cursor: 'pointer', fontSize: 13 }}>Zmień…</button>
              </div>

              {/* Pobierz */}
              <button
                onClick={addToQueue}
                disabled={mode === 'video' && !selectedFmt}
                style={{ width: '100%', marginTop: 14, padding: '14px', borderRadius: 11, border: 'none', background: C.red, color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {Ico.download(18)} Pobierz{btnSize && btnSize !== '—' ? ` · ${btnSize}` : ''}
              </button>
            </>
          )}
        </div>

        {/* Kolejka — pełna szerokość pod przyciskiem Pobierz */}
        <div style={{ ...card, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: C.red }}>{Ico.download(16)}</span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Kolejka pobierań</span>
            {queue.length > 0 && <span style={{ fontSize: 11, color: C.dim, fontFamily: MONO }}>{doneCount}/{queue.length}</span>}
            <span style={{ flex: 1 }} />
            {queue.length > 0 && <button onClick={clearFinished} style={{ fontSize: 12, color: C.muted, background: 'transparent', border: 'none', cursor: 'pointer' }}>Wyczyść</button>}
          </div>

          {queue.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '20px 0', textAlign: 'center', color: C.muted, fontSize: 13 }}>
              <span style={{ color: C.dim }}>{Ico.download(18)}</span>
              <span>Brak zadań. Wybierz format i kliknij <b style={{ color: C.text }}>Pobierz</b>.</span>
            </div>
          ) : (
            <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10, padding: 0, margin: '12px 0 0' }}>
              {queue.map((i) => <QueueCard key={i.id} item={i} onRemove={removeItem} onRetry={retryItem} />)}
            </ul>
          )}
        </div>
      </div>

      <div style={{ marginTop: 18, fontSize: 11, color: C.dim, fontFamily: MONO, textAlign: 'right' }}>
        {bins === null ? 'binarki: …' : bins.map((b) => `${b.name} ${b.found && b.version ? '✓' : '✗'}`).join('  ·  ')}
      </div>
    </div>
  )
}
