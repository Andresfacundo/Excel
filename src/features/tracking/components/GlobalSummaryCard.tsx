import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { money } from '@/lib/format'
import type { GlobalSummary, PeriodStatus } from '../domain'
import { balanceText } from '../balance'
import styles from '../tracking.module.css'

function toneOf(summary: GlobalSummary): PeriodStatus {
  if (summary.percent >= 100) return 'success'
  if (summary.peopleOverdue > 0) return 'danger'
  if (summary.totalDrift >= 0) return 'success'
  return summary.percent >= 50 ? 'warning' : 'info'
}

export function GlobalSummaryCard({ summary }: { summary: GlobalSummary }) {
  const detalle =
    summary.people === 0
      ? 'Aun no hay personas activas'
      : [
          `${summary.people} persona${summary.people === 1 ? '' : 's'}`,
          summary.peopleSettled > 0 ? `${summary.peopleSettled} al dia` : null,
          summary.peopleOverdue > 0
            ? `${summary.peopleOverdue} con atraso`
            : null,
        ]
          .filter(Boolean)
          .join(' · ')

  return (
    <Card title="Resumen general" className={styles.summaryCard}>
      <div className={styles.summaryTop}>
        <div>
          <div className={styles.summaryLabel}>Recibido</div>
          <div className={styles.summaryValue}>{money(summary.totalPaid)}</div>
        </div>
        <div className={styles.summaryRight}>
          <div className={styles.summaryLabel}>Objetivo total</div>
          <div className={styles.summaryValue}>{money(summary.totalTarget)}</div>
        </div>
      </div>

      <ProgressBar
        percent={summary.percent}
        status={toneOf(summary)}
        label={`Avance global: ${summary.percent}%`}
      />

      {summary.overdueAmount > 0 && (
        <p className={styles.summaryOverdue}>
          Vencido sin pagar: <strong>{money(summary.overdueAmount)}</strong>
        </p>
      )}

      <p className={styles.summarySub}>
        {detalle}
        {summary.people > 0 && ` · ${balanceText(summary.totalDrift)}`}
      </p>
    </Card>
  )
}
