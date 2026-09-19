import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { money } from '@/lib/format'
import type { TrackingResult } from '../domain'
import { balanceText } from '../balance'
import styles from '../tracking.module.css'

interface SummaryCardProps {
  tracking: TrackingResult
  title?: string
}


export function SummaryCard({ tracking, title = 'Resumen general' }: SummaryCardProps) {
  return (
    <Card title={title} className={styles.summaryCard}>
      <div className={styles.summaryTop}>
        <div>
          <div className={styles.summaryLabel}>Pagado</div>
          <div className={styles.summaryValue}>{money(tracking.totalPaid)}</div>
        </div>
        <div className={styles.summaryRight}>
          <div className={styles.summaryLabel}>Objetivo total</div>
          <div className={styles.summaryValue}>{money(tracking.totalTarget)}</div>
        </div>
      </div>

      <ProgressBar
        percent={tracking.percent}
        status={tracking.status}
        label={`Avance: ${tracking.percent}%`}
      />

      {tracking.overdueAmount > 0 && (
        <p className={styles.summaryOverdue}>
          Vencido sin pagar: <strong>{money(tracking.overdueAmount)}</strong> en{' '}
          {tracking.overduePeriods} periodo{tracking.overduePeriods === 1 ? '' : 's'}
        </p>
      )}

      <p className={styles.summarySub}>
        {balanceText(tracking.totalDrift)}
        {tracking.unallocated > 0 && ` · ${money(tracking.unallocated)} sin asignar a un periodo`}
      </p>
    </Card>
  )
}
