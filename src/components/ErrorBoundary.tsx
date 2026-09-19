import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Evita la pantalla en blanco: cualquier error de render se muestra con la
 * opcion de recargar. React no ofrece todavia una version con hooks.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error no controlado en la interfaz', error, info)
  }

  override render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div style={{ maxWidth: 520, margin: '48px auto', padding: 20 }}>
        <h1 style={{ fontSize: 18, marginBottom: 8 }}>Algo salio mal</h1>
        <p style={{ fontSize: 13.5, color: '#555', marginBottom: 14 }}>{error.message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 16px',
            fontWeight: 700,
            color: '#fff',
            background: '#1a73e8',
            border: 'none',
            borderRadius: 10,
            cursor: 'pointer',
          }}
        >
          Recargar
        </button>
      </div>
    )
  }
}
