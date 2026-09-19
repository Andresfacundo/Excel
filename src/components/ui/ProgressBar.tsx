import { cx } from '@/lib/cx'
import type { PeriodStatus } from '@/features/tracking/domain'
import styles from './ui.module.css'

const fillClass: Record<PeriodStatus, string | undefined> = {
  success: styles.fillSuccess,
  warning: styles.fillWarning,
  danger: styles.fillDanger,
  info: styles.fillInfo,
}

interface ProgressBarProps {
  percent: number
  status: PeriodStatus
  label: string
}

export function ProgressBar({ percent, status, label }: ProgressBarProps) {
  return (
    <div
      className={styles.track}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={cx(styles.fill, fillClass[status])} style={{ width: `${percent}%` }} />
    </div>
  )
}
