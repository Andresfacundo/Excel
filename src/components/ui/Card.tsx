import type { ReactNode } from 'react'
import { cx } from '@/lib/cx'
import styles from './ui.module.css'

interface CardProps {
  title?: ReactNode
  children: ReactNode
  className?: string
  /** Contenido alineado a la derecha del titulo. */
  action?: ReactNode
}

export function Card({ title, children, className, action }: CardProps) {
  return (
    <section className={cx(styles.card, className)}>
      {title !== undefined && (
        <h2 className={styles.cardTitle}>
          <span className={styles.dot} aria-hidden="true" />
          <span style={{ flex: 1 }}>{title}</span>
          {action}
        </h2>
      )}
      {children}
    </section>
  )
}
