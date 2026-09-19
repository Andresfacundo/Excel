import { cx } from '@/lib/cx'
import type { PeriodStatus } from '@/features/tracking/domain'
import styles from './ui.module.css'

const statusClass: Record<PeriodStatus, string | undefined> = {
  success: styles.badgeSuccess,
  warning: styles.badgeWarning,
  danger: styles.badgeDanger,
  info: styles.badgeInfo,
}

export function Badge({ status, children }: { status: PeriodStatus; children: string }) {
  return <span className={cx(styles.badge, statusClass[status])}>{children}</span>
}
