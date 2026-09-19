import { cx } from '@/lib/cx'
import styles from './ui.module.css'

export function EmptyState({ children }: { children: string }) {
  return <p className={styles.empty}>{children}</p>
}

export function Spinner({ centered = false, label = 'Cargando' }: { centered?: boolean; label?: string }) {
  return (
    <div
      className={cx(styles.spinner, centered && styles.spinnerCentered)}
      role="status"
      aria-label={label}
    />
  )
}
