import { useEffect, useState, type CSSProperties } from 'react'
import type {
  AudioFormat,
  DownloadRequest,
  PlaylistMeta,
  VideoContainer,
  VideoMeta
} from '@shared/ipc'
import { FormatTable, MONO, formatDuration, useC } from './App'

/** Pozycja gotowa do dodania do kolejki (tytuł + opis + żądanie pobrania). */
export interface NewQueueItem {
  title: string
  meta: string
  request: DownloadRequest
}

type Step = 'scope' | 'loading' | 'method' | 'profile' | 'stepper'

const VIDEO_CONTAINERS: VideoContainer[] = ['mp4', 'mkv', 'webm']
const AUDIO_FORMATS: AudioFormat[] = ['mp3', 'm4a', 'opus', 'wav']
/** Wartość 0 = „Najlepsza dostępna" (height nieokreślony → selektor best). */
const QUALITY_OPTS: { label: string; height: number }[] = [
  { label: 'Najlepsza', height: 0 },
  { label: '2160p (4K)', height: 2160 },
  { label: '1440p', height: 1440 },
  { label: '1080p', height: 1080 },
  { label: '720p', height: 720 },
  { label: '480p', height: 480 },
  { label: '360p', height: 360 }
]

/**
 * Pełny przepływ obsługi playlisty (modal): zakres → metoda → (profil dla wszystkich
 * | analiza każdego osobno). Izolowany od App, dodaje pozycje przez onEnqueue.
 */
export function PlaylistFlow({
  plUrl,
  outputDir,
  onSingleVideo,
  onEnqueue,
  onClose
}: {
  plUrl: string
  outputDir: string
  onSingleVideo: () => void
  onEnqueue: (items: NewQueueItem[]) => void
  onClose: () => void
}) {
  const C = useC()
  const [step, setStep] = useState<Step>('scope')
  const [pl, setPl] = useState<PlaylistMeta | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadPlaylist() {
    setStep('loading')
    setError(null)
    try {
      const r = await window.api.analyzePlaylist(plUrl)
      if (r.entries.length === 0) {
        setError('Playlista jest pusta lub niedostępna.')
        return
      }
      setPl(r)
      setStep('method')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  /* ── Style ── */
  const overlay: CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
    display: 'grid', placeItems: 'center', zIndex: 1000, padding: 20
  }
  const cardStyle: CSSProperties = {
    background: C.panel, border: `1px solid ${C.borderStrong}`, borderRadius: 14,
    padding: 22, width: 'min(640px, 100%)', maxHeight: '86vh', overflow: 'auto',
    boxShadow: '0 18px 60px rgba(0,0,0,.5)'
  }
  const h: CSSProperties = { margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: C.text }
  const sub: CSSProperties = { margin: '0 0 18px', fontSize: 13, color: C.muted }
  const primary: CSSProperties = {
    padding: '11px 16px', borderRadius: 9, border: 'none', background: C.red,
    color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer'
  }
  const ghost: CSSProperties = {
    padding: '11px 16px', borderRadius: 9, border: `1px solid ${C.border}`,
    background: 'transparent', color: C.text, fontSize: 14, fontWeight: 600, cursor: 'pointer'
  }
  const bigChoice: CSSProperties = {
    display: 'block', width: '100%', textAlign: 'left', padding: '16px 18px', marginBottom: 12,
    borderRadius: 11, border: `1px solid ${C.border}`, background: C.surface, color: C.text, cursor: 'pointer'
  }

  function Card({ children }: { children: React.ReactNode }) {
    return (
      <div style={overlay} onClick={onClose}>
        <div style={cardStyle} onClick={(e) => e.stopPropagation()}>{children}</div>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <h2 style={h}>Błąd playlisty</h2>
        <p style={{ ...sub, color: C.err }}>{error}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button style={ghost} onClick={onClose}>Zamknij</button>
          <button style={primary} onClick={loadPlaylist}>Spróbuj ponownie</button>
        </div>
      </Card>
    )
  }

  if (step === 'scope') {
    return (
      <Card>
        <h2 style={h}>Wykryto playlistę</h2>
        <p style={sub}>Ten link zawiera całą playlistę. Co pobrać?</p>
        <button style={bigChoice} onClick={() => { onSingleVideo() }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>🎬 Tylko ten film</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Pobierz pojedynczy film z linku.</div>
        </button>
        <button style={{ ...bigChoice, borderColor: C.red }} onClick={loadPlaylist}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>📃 Cała playlista</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Dodaj wszystkie filmy do kolejki naraz.</div>
        </button>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <button style={ghost} onClick={onClose}>Anuluj</button>
        </div>
      </Card>
    )
  }

  if (step === 'loading') {
    return (
      <Card>
        <h2 style={h}>Wczytywanie playlisty…</h2>
        <p style={sub}>yt-dlp pobiera listę filmów. To zwykle kilka sekund.</p>
      </Card>
    )
  }

  if (!pl) return null

  if (step === 'method') {
    return (
      <Card>
        <h2 style={h}>{pl.title}</h2>
        <p style={sub}>{pl.entries.length} filmów w playliście. Jak wybrać format?</p>
        <button style={{ ...bigChoice, borderColor: C.red }} onClick={() => setStep('profile')}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>⚡ Jeden profil dla wszystkich</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
            Wybierasz raz (np. „Wideo MP4 1080p" albo „Audio MP3") i stosuje się do każdego filmu. Szybkie.
          </div>
        </button>
        <button style={bigChoice} onClick={() => setStep('stepper')}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>🎛 Analiza każdego osobno</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
            Przeglądasz film po filmie i wybierasz format ręcznie. Dokładne, ale wolniejsze.
          </div>
        </button>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <button style={ghost} onClick={onClose}>Anuluj</button>
        </div>
      </Card>
    )
  }

  if (step === 'profile') {
    return (
      <Card>
        <ProfilePicker
          pl={pl}
          outputDir={outputDir}
          onCancel={() => setStep('method')}
          onConfirm={(items) => { onEnqueue(items); onClose() }}
        />
      </Card>
    )
  }

  // step === 'stepper'
  return (
    <Card>
      <Stepper
        pl={pl}
        outputDir={outputDir}
        onEnqueue={onEnqueue}
        onClose={onClose}
      />
    </Card>
  )
}

/* ── Metoda A: jeden profil dla całej listy ── */
function ProfilePicker({
  pl,
  outputDir,
  onCancel,
  onConfirm
}: {
  pl: PlaylistMeta
  outputDir: string
  onCancel: () => void
  onConfirm: (items: NewQueueItem[]) => void
}) {
  const C = useC()
  const [mode, setMode] = useState<'video' | 'audio'>('video')
  const [container, setContainer] = useState<VideoContainer>('mp4')
  const [height, setHeight] = useState<number>(1080)
  const [audioFormat, setAudioFormat] = useState<AudioFormat>('mp3')

  const seg = (active: boolean): CSSProperties => ({
    padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
    background: active ? C.red : C.surface2, color: active ? '#fff' : C.muted, fontWeight: 600, fontSize: 13
  })
  const chip = (active: boolean): CSSProperties => ({
    padding: '7px 13px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
    border: `1px solid ${active ? C.red : C.border}`, background: active ? C.red : 'transparent',
    color: active ? '#fff' : C.text
  })
  const label: CSSProperties = { fontSize: 12, color: C.dim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', margin: '16px 0 8px' }

  function confirm() {
    const items: NewQueueItem[] = pl.entries.map((e) => {
      if (mode === 'video') {
        const qLabel = height ? `${height}p` : 'Najlepsza'
        return {
          title: e.title,
          meta: `${qLabel} · ${container.toUpperCase()}`,
          request: {
            kind: 'video',
            url: e.url,
            height: height || undefined,
            container,
            outputDir
          } satisfies DownloadRequest
        }
      }
      return {
        title: e.title,
        meta: `${audioFormat.toUpperCase()} · best audio`,
        request: { kind: 'audio', url: e.url, audioFormat, outputDir } satisfies DownloadRequest
      }
    })
    onConfirm(items)
  }

  return (
    <>
      <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: C.text }}>Profil dla całej playlisty</h2>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: C.muted }}>{pl.entries.length} filmów · {pl.title}</p>

      <div style={{ display: 'flex', gap: 8 }}>
        <button style={seg(mode === 'video')} onClick={() => setMode('video')}>Wideo + audio</button>
        <button style={seg(mode === 'audio')} onClick={() => setMode('audio')}>Tylko audio</button>
      </div>

      {mode === 'video' ? (
        <>
          <div style={label}>Kontener</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {VIDEO_CONTAINERS.map((c) => (
              <button key={c} style={chip(container === c)} onClick={() => setContainer(c)}>{c.toUpperCase()}</button>
            ))}
          </div>
          <div style={label}>Maks. jakość</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {QUALITY_OPTS.map((q) => (
              <button key={q.height} style={chip(height === q.height)} onClick={() => setHeight(q.height)}>{q.label}</button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: C.dim, marginTop: 10 }}>
            Filmy bez wybranej jakości dostaną najbliższą dostępną (lub niższą).
          </p>
        </>
      ) : (
        <>
          <div style={label}>Format audio</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {AUDIO_FORMATS.map((a) => (
              <button key={a} style={chip(audioFormat === a)} onClick={() => setAudioFormat(a)}>{a.toUpperCase()}</button>
            ))}
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
        <button
          style={{ padding: '11px 16px', borderRadius: 9, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          onClick={onCancel}
        >
          Wstecz
        </button>
        <button
          style={{ padding: '11px 18px', borderRadius: 9, border: 'none', background: C.red, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          onClick={confirm}
        >
          Dodaj {pl.entries.length} do kolejki
        </button>
      </div>
    </>
  )
}

/* ── Metoda B: analiza każdego filmu osobno (stepper) ── */
function Stepper({
  pl,
  outputDir,
  onEnqueue,
  onClose
}: {
  pl: PlaylistMeta
  outputDir: string
  onEnqueue: (items: NewQueueItem[]) => void
  onClose: () => void
}) {
  const C = useC()
  const [idx, setIdx] = useState(0)
  const [vmeta, setVmeta] = useState<VideoMeta | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [mode, setMode] = useState<'video' | 'audio'>('video')
  const [sel, setSel] = useState<string | null>(null)
  const [container, setContainer] = useState<VideoContainer>('mp4')
  const [audioFormat, setAudioFormat] = useState<AudioFormat>('mp3')

  const entry = pl.entries[idx]

  useEffect(() => {
    let alive = true
    setVmeta(null); setErr(null); setSel(null); setMode('video'); setLoading(true)
    window.api
      .analyze(entry.url)
      .then((r) => {
        if (!alive) return
        setVmeta(r)
        setSel(r.formats.find((f) => f.kind === 'video')?.formatId ?? r.formats[0]?.formatId ?? null)
      })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : String(e)) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [entry.url])

  function next() {
    if (idx + 1 < pl.entries.length) setIdx(idx + 1)
    else onClose()
  }

  function addAndNext() {
    if (!vmeta) return
    const f = vmeta.formats.find((x) => x.formatId === sel)
    if (mode === 'video' && f?.kind === 'video') {
      onEnqueue([{
        title: vmeta.title,
        meta: `${f.qualityLabel ?? f.resolution ?? '?'} · ${container.toUpperCase()}`,
        request: { kind: 'video', url: entry.url, height: f.height, qualityLabel: f.qualityLabel, container, outputDir }
      }])
    } else if (mode === 'audio') {
      onEnqueue([{
        title: vmeta.title,
        meta: `${audioFormat.toUpperCase()} · best audio`,
        request: { kind: 'audio', url: entry.url, audioFormat, outputDir }
      }])
    }
    next()
  }

  const rows = vmeta ? vmeta.formats.filter((f) => f.kind === mode) : []
  const seg = (active: boolean): CSSProperties => ({
    padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
    background: active ? C.red : C.surface2, color: active ? '#fff' : C.muted, fontWeight: 600, fontSize: 13
  })
  const chip = (active: boolean): CSSProperties => ({
    padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
    border: `1px solid ${active ? C.red : C.border}`, background: active ? C.red : 'transparent',
    color: active ? '#fff' : C.text
  })
  const btn: CSSProperties = { padding: '10px 14px', borderRadius: 9, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.text }}>Film {idx + 1} / {pl.entries.length}</h2>
        <span style={{ fontSize: 12, color: C.dim, fontFamily: MONO }}>{formatDuration(entry.durationSec)}</span>
      </div>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {vmeta?.title ?? entry.title}
      </p>

      {loading && <p style={{ fontSize: 13, color: C.muted }}>Analiza formatów…</p>}
      {err && <p style={{ fontSize: 13, color: C.err }}>⚠ {err}</p>}

      {vmeta && !loading && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <button style={seg(mode === 'video')} onClick={() => { setMode('video'); setSel(vmeta.formats.find((f) => f.kind === 'video')?.formatId ?? null) }}>Wideo + audio</button>
            <button style={seg(mode === 'audio')} onClick={() => { setMode('audio'); setSel(vmeta.formats.find((f) => f.kind === 'audio')?.formatId ?? null) }}>Tylko audio</button>
          </div>

          {mode === 'video' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {VIDEO_CONTAINERS.map((c) => (
                <button key={c} style={chip(container === c)} onClick={() => setContainer(c)}>{c.toUpperCase()}</button>
              ))}
            </div>
          )}
          {mode === 'audio' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {AUDIO_FORMATS.map((a) => (
                <button key={a} style={chip(audioFormat === a)} onClick={() => setAudioFormat(a)}>{a.toUpperCase()}</button>
              ))}
            </div>
          )}

          {rows.length > 0
            ? <FormatTable rows={rows} selected={sel} onSelect={setSel} />
            : <p style={{ fontSize: 13, color: C.muted, marginTop: 12 }}>Brak formatów dla tego trybu.</p>}
        </>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 20 }}>
        <button style={btn} onClick={onClose}>Zakończ</button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={btn} onClick={next}>Pomiń</button>
          <button
            style={{ padding: '10px 16px', borderRadius: 9, border: 'none', background: C.red, color: '#fff', fontSize: 13, fontWeight: 700, cursor: loading ? 'default' : 'pointer', opacity: loading || !vmeta ? .5 : 1 }}
            disabled={loading || !vmeta}
            onClick={addAndNext}
          >
            {idx + 1 < pl.entries.length ? 'Dodaj i dalej →' : 'Dodaj i zakończ'}
          </button>
        </div>
      </div>
    </>
  )
}
