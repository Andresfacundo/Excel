import { useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import type { SelectOption } from '@/components/ui/Select'
import { cx } from '@/lib/cx'
import { money } from '@/lib/format'
import { sumPayments } from '@/features/tracking/domain'
import type { Payment, Receipt } from '@/types/domain'
import { PaymentList } from './PaymentList'
import styles from '../payments.module.css'

interface PaymentsCardProps {
  userId: string
  personId: string
  payments: Payment[]
  /** Los que no estan marcados para ningun periodo. */
  unassigned: Payment[]
  periodOptions: SelectOption[]
  receiptsByPayment: Map<string, Receipt[]>
}

/**
 * Historial de pagos de la persona.
 *
 * Antes eran dos tarjetas —"Pagos sin asignar" e "Historial completo"— que
 * repetian las mismas filas una debajo de la otra. Ahora es una sola lista con
 * un filtro: la misma informacion, la mitad de pantalla.
 */
export function PaymentsCard({
  userId,
  personId,
  payments,
  unassigned,
  periodOptions,
  receiptsByPayment,
}: PaymentsCardProps) {
  const [onlyUnassigned, setOnlyUnassigned] = useState(false)

  const hasUnassigned = unassigned.length > 0
  const shown = onlyUnassigned && hasUnassigned ? unassigned : payments
  const withoutReceipt = shown.filter(
    (payment) => (receiptsByPayment.get(payment.id)?.length ?? 0) === 0,
  ).length

  return (
    <Card
      title="Pagos"
      action={
        shown.length > 0 ? (
          <span className={styles.cardMeta}>
            {shown.length} · {money(sumPayments(shown))}
          </span>
        ) : undefined
      }
    >
      {hasUnassigned && (
        <div className={styles.filters} role="group" aria-label="Filtrar pagos">
          <button
            type="button"
            className={cx(styles.filter, !onlyUnassigned && styles.filterActive)}
            aria-pressed={!onlyUnassigned}
            onClick={() => setOnlyUnassigned(false)}
          >
            Todos ({payments.length})
          </button>
          <button
            type="button"
            className={cx(styles.filter, onlyUnassigned && styles.filterActive)}
            aria-pressed={onlyUnassigned}
            onClick={() => setOnlyUnassigned(true)}
          >
            Sin asignar ({unassigned.length})
          </button>
        </div>
      )}

      {hasUnassigned && onlyUnassigned && (
        <Alert tone="info">
          Este dinero ya cuenta: esta tapando los periodos mas atrasados. Si sabes a que periodo
          corresponde cada pago, eligelo aqui y las cuentas por periodo quedan exactas.
        </Alert>
      )}

      <PaymentList
        userId={userId}
        personId={personId}
        payments={shown}
        periodOptions={periodOptions}
        receiptsByPayment={receiptsByPayment}
        emptyMessage={
          onlyUnassigned ? 'Todos los pagos estan asignados.' : 'Aun no hay pagos registrados.'
        }
      />

      {withoutReceipt > 0 && (
        <p className={styles.cardFoot}>
          {withoutReceipt} de estos pagos no tiene comprobante. Son justo los que no podrias
          sustentar si el cliente los discute.
        </p>
      )}
    </Card>
  )
}
