import type { ReactNode } from 'react'
import { cx } from '@/lib/cx'
import styles from './ui.module.css'

type Tone = 'error' | 'success' | 'info' | 'warning'

const toneClass: Record<Tone, string | undefined> = {
  error: styles.alertError,
  success: styles.alertSuccess,
  info: styles.alertInfo,
  warning: styles.alertWarning,
}

export function Alert({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <p
      className={cx(styles.alert, toneClass[tone])}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
    >
      {children}
    </p>
  )
}
