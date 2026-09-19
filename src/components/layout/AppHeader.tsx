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
      {showBack && (
        <Link to="/" className={styles.back}>
          &larr; Todas las personas
        </Link>
      )}

      <h1 className={styles.title}>{title}</h1>
      <p className={styles.subtitle}>{subtitle}</p>

      <p className={cx(styles.status, tone)} role="status" aria-live="polite">
        <span className={styles.statusDot} aria-hidden="true" />
        {text}
      </p>

      {email && (
        <>
          <p className={styles.account}>{email}</p>
          <button type="button" className={styles.signOut} onClick={onSignOut}>
            Cerrar sesion
          </button>
        </>
      )}
    </header>
  )
}
