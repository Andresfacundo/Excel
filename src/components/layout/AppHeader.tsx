import { Link } from 'react-router-dom'
import { cx } from '@/lib/cx'
import type { RealtimeStatus } from '@/features/sync/useRealtimeSync'
import styles from './AppHeader.module.css'

interface AppHeaderProps {
  title: string
  subtitle: string
  email: string | null
  online: boolean
  realtime: RealtimeStatus
  /** Numero de cambios guardados en el dispositivo que aun no llegan al servidor. */
  pendingMutations: number
  onSignOut: () => void
  /** Si viene, muestra el enlace de regreso a la portada. */
  showBack?: boolean
}

function describeSync(
  online: boolean,
  realtime: RealtimeStatus,
  pendingMutations: number,
): { text: string; tone: string | undefined } {
  if (!online) {
    return {
      text:
        pendingMutations > 0
          ? `Sin conexion — ${pendingMutations} cambio(s) por enviar`
          : 'Sin conexion — viendo datos guardados',
      tone: styles.offline,
    }
  }
  if (pendingMutations > 0) {
    return { text: `Enviando ${pendingMutations} cambio(s)...`, tone: styles.pending }
  }
  if (realtime === 'connected') return { text: 'Sincronizado en la nube', tone: styles.online }
  if (realtime === 'connecting') return { text: 'Conectando...', tone: styles.pending }
  return { text: 'Sin sincronizacion en vivo', tone: styles.offline }
}

/**
 * Cabecera compacta.
 *
 * Antes ocupaba cinco lineas apiladas —volver, titulo, subtitulo, estado,
 * correo y boton de salir— y en un celular eso se comia el 40% de la pantalla
 * antes de mostrar un solo dato. Ahora la navegacion y la cuenta comparten una
 * fila arriba, y el correo vive en el `title` del boton de salir: sigue
 * disponible al mantenerlo pulsado, sin gastar una linea entera.
 */
export function AppHeader({
  title,
  subtitle,
  email,
  online,
  realtime,
  pendingMutations,
  onSignOut,
  showBack = false,
}: AppHeaderProps) {
  const { text, tone } = describeSync(online, realtime, pendingMutations)

  return (
    <header className={styles.header}>
      <div className={styles.topRow}>
        {showBack ? (
          <Link to="/" className={styles.back}>
            &larr; Personas
          </Link>
        ) : (
          <span aria-hidden="true" />
        )}

        {email && (
          <button
            type="button"
            className={styles.signOut}
            title={`Sesion de ${email}`}
            onClick={onSignOut}
          >
            Salir
          </button>
        )}
      </div>

      <h1 className={styles.title}>{title}</h1>
      <p className={styles.subtitle}>{subtitle}</p>

      <p className={cx(styles.status, tone)} role="status" aria-live="polite">
        <span className={styles.statusDot} aria-hidden="true" />
        {text}
      </p>
    </header>
  )
}
