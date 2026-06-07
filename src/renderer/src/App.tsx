import { useEffect, useState } from 'react'
import type { BinaryStatus, FormatInfo, VideoMeta } from '@shared/ipc'

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
                <input
                  type="radio"
                  name="format"
                  checked={selected === f.formatId}
                  onChange={() => onSelect(f.formatId)}
                />
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

export default function App() {
  const [url, setUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [meta, setMeta] = useState<VideoMeta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [bins, setBins] = useState<BinaryStatus[] | null>(null)

  useEffect(() => {
    window.api.checkBinaries().then(setBins)
  }, [])

  async function analyze() {
    if (!url.trim()) return
    setAnalyzing(true)
    setError(null)
    setMeta(null)
    setSelected(null)
    try {
      const result = await window.api.analyze(url.trim())
      setMeta(result)
      setSelected(result.formats[0]?.formatId ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setAnalyzing(false)
    }
  }

  const videos = meta?.formats.filter((f) => f.kind === 'video') ?? []
  const audios = meta?.formats.filter((f) => f.kind === 'audio') ?? []

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, color: '#1a1a1a', maxWidth: 820, margin: '0 auto' }}>
      <h1 style={{ margin: 0 }}>YT-GRAB</h1>
      <p style={{ color: '#666', marginTop: 4 }}>Analiza filmu (Etap 3).</p>

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
            padding: '10px 18px',
            borderRadius: 8,
            border: 'none',
            background: analyzing ? '#999' : '#ff0033',
            color: '#fff',
            fontWeight: 600,
            cursor: analyzing ? 'default' : 'pointer'
          }}
        >
          {analyzing ? 'Analizuję…' : 'Analizuj'}
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
            {meta.thumbnail && (
              <img src={meta.thumbnail} alt="" style={{ width: 160, borderRadius: 8, flexShrink: 0 }} />
            )}
            <div>
              <h2 style={{ fontSize: 17, margin: 0 }}>{meta.title}</h2>
              <p style={{ color: '#666', margin: '4px 0' }}>
                Czas: {formatDuration(meta.durationSec)} · Formatów: {meta.formats.length}
              </p>
            </div>
          </div>

          <FormatTable title="Wideo" rows={videos} selected={selected} onSelect={setSelected} />
          <FormatTable title="Audio" rows={audios} selected={selected} onSelect={setSelected} />
        </div>
      )}

      <div style={{ marginTop: 28, paddingTop: 12, borderTop: '1px solid #eee', fontSize: 12, color: '#999' }}>
        Binarki:{' '}
        {bins === null
          ? 'sprawdzam…'
          : bins.map((b) => `${b.name} ${b.found && b.version ? '✓' : '✗'}`).join('  ·  ')}
      </div>
    </div>
  )
}
