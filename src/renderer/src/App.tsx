import { useEffect, useState } from 'react'

export default function App() {
  const [pong, setPong] = useState<string>('')

  useEffect(() => {
    window.api.echo('ping').then(setPong)
  }, [])

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, color: '#1a1a1a' }}>
      <h1 style={{ margin: 0 }}>YT-GRAB</h1>
      <p style={{ color: '#666' }}>Szkielet aplikacji (Etap 1).</p>
      <p>
        IPC echo: <strong>{pong || '…'}</strong>
      </p>
    </div>
  )
}
