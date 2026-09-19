import { useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { SelectOption } from '@/components/ui/Select'
import { cx } from '@/lib/cx'
import { formatPeriodRange, money } from '@/lib/format'
import { PaymentList } from '@/features/payments/components/PaymentList'
import { PeriodForm } from '@/features/periods/components/PeriodForm'
import { useDeletePeriod, useUpdatePeriod } from '@/features/periods/hooks'
import type { PeriodDefinition, Receipt } from '@/types/domain'
import { toIsoDate } from '../domain'
import type { Period } from '../domain'
import { periodName } from '../periodOptions'
import styles from '../tracking.module.css'
import periodStyles from '@/features/periods/periods.module.css'

function Row({ label, value, tone }: { label: string; value: string; tone?: string | undefined }) {
  return (
    <div className={styles.row}>
      <span className={styles.key}>{label}</span>
      <span className={cx(styles.value, tone)}>{value}</span>
    </div>
  )
}

interface PeriodCardProps {
  period: Period
  userId: string
  personId: string
  periodOptions: SelectOption[]
  receiptsByPayment: Map<string, Receipt[]>
  /** Los demas periodos de la persona, para detectar cruces al editar. */
  otherDefinitions: PeriodDefinition[]
}

export function PeriodCard({
  period,
  userId,
  personId,
  periodOptions,
  receiptsByPayment,
  otherDefinitions,
}: PeriodCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { updatePeriod } = useUpdatePeriod(userId)
  const { deletePeriod } = useDeletePeriod(userId)

  const rangeLabel = formatPeriodRange(period.start, period.end)
  const paymentCount = period.payments.length

  // El desglose solo aparece cuando hay algo que explicar. En el caso normal
  // —se abono directo y alcanzo— las tres cifras de arriba lo dicen todo.
  const hasBreakdown =
    period.carryIn > 0 || period.fromPool > 0 || period.carryOut > 0 || period.assigned > 0

  async function handleDelete() {
    if (deleting) return
    setDeleting(true)
    setError(null)
    try {
      await deletePeriod(period.id)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo eliminar el periodo.')
      setDeleting(false)
    }
  }

  return (
    <article className={styles.periodCard}>
      <div className={styles.periodHead}>
        <h3 className={styles.periodTitle}>
          <span className={styles.periodNumber}>{periodName(period)}</span>
          <span className={styles.periodRange}>{rangeLabel}</span>
        </h3>
        <Badge status={period.status}>{period.statusLabel}</Badge>
      </div>

      <ProgressBar
        percent={period.percent}
        status={period.status}
        label={`${periodName(period)}: ${period.percent}% cubierto`}
      />

      {/* Lo unico que se pregunta de un vistazo: cuanto era, cuanto entro,
          cuanto falta. El resto del calculo vive en el desglose de abajo. */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Objetivo</span>
          <span className={styles.statValue}>{money(period.target)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Cubierto</span>
          <span className={styles.statValue}>{money(period.paid)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{period.pending > 0 ? 'Falta' : 'Al dia'}</span>
          <span
            className={cx(
              styles.statValue,
              period.pending > 0 ? styles.negative : styles.positive,
            )}
          >
            {period.pending > 0 ? money(period.pending) : money(0)}
          </span>
        </div>
      </div>

      <div className={styles.periodFoot}>
        <details className={styles.fold}>
          <summary className={styles.foldSummary}>
            {paymentCount === 0
              ? 'Pagos de este periodo'
              : `Pagos de este periodo (${paymentCount})`}
          </summary>
          <PaymentList
            userId={userId}
            personId={personId}
            payments={period.payments}
            periodOptions={periodOptions}
            receiptsByPayment={receiptsByPayment}
            emptyMessage="Nada abonado directamente a este periodo."
          />
        </details>

        {hasBreakdown && (
          <details className={styles.fold}>
            <summary className={styles.foldSummary}>De donde sale lo cubierto</summary>
            <div className={styles.rows}>
              {period.assigned > 0 && (
                <Row label="Abonado directamente" value={money(period.assigned)} />
              )}
              {period.carryIn > 0 && (
                <Row label="Viene del periodo anterior" value={money(period.carryIn)} />
              )}
              {period.fromPool > 0 && (
                <Row label="Cubierto con pagos sin asignar" value={money(period.fromPool)} />
              )}
              {period.carryOut > 0 && (
                <Row
                  label="Excedente que pasa al siguiente"
                  value={money(period.carryOut)}
                  tone={styles.positive}
                />
              )}
              <Row
                label={period.cumulativeDrift < 0 ? 'Atraso acumulado' : 'Adelanto acumulado'}
                value={money(Math.abs(period.cumulativeDrift))}
                tone={period.cumulativeDrift < 0 ? styles.negative : styles.positive}
              />
            </div>
          </details>
        )}

        <details className={styles.fold}>
          <summary className={styles.foldSummary}>Editar o eliminar</summary>

          <PeriodForm
            others={otherDefinitions}
            initialValues={{
              startDate: toIsoDate(period.start),
              endDate: toIsoDate(period.end),
              targetAmount: String(period.target),
              label: period.label ?? '',
            }}
            submitLabel="Guardar cambios"
            onSubmit={(changes) => updatePeriod(period.id, changes)}
          />

          <div className={periodStyles.dangerZone}>
            <p className={periodStyles.dangerText}>
              Al eliminar el periodo, sus {paymentCount} pago{paymentCount === 1 ? '' : 's'} no se
              borra{paymentCount === 1 ? '' : 'n'}: queda{paymentCount === 1 ? '' : 'n'} sin
              asignar.
            </p>

            {confirmingDelete ? (
              <div className={periodStyles.confirmRow}>
                <span className={periodStyles.confirmText}>Seguro?</span>
                <Button variant="danger" loading={deleting} onClick={() => void handleDelete()}>
                  Si, eliminar
                </Button>
                <Button
                  variant="ghost"
                  disabled={deleting}
                  onClick={() => setConfirmingDelete(false)}
                >
                  No
                </Button>
              </div>
            ) : (
              <div className={periodStyles.confirmRow}>
                <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
                  Eliminar periodo
                </Button>
              </div>
            )}

            {error && <Alert tone="error">{error}</Alert>}
          </div>
        </details>
      </div>
    </article>
  )
}
