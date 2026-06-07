import { useEffect, useState } from 'react'
import type { BinaryStatus } from '@shared/ipc'

export default function App() {
  const [pong, setPong] = useState<string>('')
  const [bins, setBins] = useState<BinaryStatus[] | null>(null)

  useEffect(() => {
    window.api.echo('ping').then(setPong)
    window.api.checkBinaries().then(setBins)
  }, [])

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, color: '#1a1a1a' }}>
      <h1 style={{ margin: 0 }}>YT-GRAB</h1>
      <p style={{ color: '#666' }}>Szkielet aplikacji (Etap 2 — binarki).</p>
      <p>
        IPC echo: <strong>{pong || '…'}</strong>
      </p>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Binarki</h2>
      {bins === null ? (
        <p>Sprawdzanie…</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
          {bins.map((b) => (
            <li
              key={b.name}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: b.found && b.version ? '#eef9f0' : '#fdeeee',
                border: `1px solid ${b.found && b.version ? '#bfe6c6' : '#f0c6c6'}`
              }}
            >
              <strong>{b.name}</strong>{' '}
              {b.found && b.version ? (
                <span style={{ color: '#1a7f37' }}>✓ {b.version}</span>
              ) : (
                <span style={{ color: '#b42318' }}>✗ {b.error}</span>
              )}
              <div style={{ color: '#888', fontSize: 12, marginTop: 2, wordBreak: 'break-all' }}>{b.path}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
