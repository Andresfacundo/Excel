import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import type { SelectOption } from '@/components/ui/Select'
import { cx } from '@/lib/cx'
import { formatIsoDate, money } from '@/lib/format'
import { ReceiptsPanel } from '@/features/receipts/components/ReceiptsPanel'
import { toPeriodId, toSelectValue } from '@/features/tracking/periodOptions'
import type { Payment, Receipt } from '@/types/domain'
import { useDeletePayment, useUpdatePaymentPeriod } from '../hooks'
import styles from '../payments.module.css'
import uiStyles from '@/components/ui/ui.module.css'

interface PaymentRowProps {
  userId: string
  personId: string
  payment: Payment
  /** Opciones para reasignar el pago a otro periodo. */
  periodOptions: SelectOption[]
  receipts: Receipt[]
  onError: (message: string) => void
}

export function PaymentRow({
  userId,
  personId,
  payment,
  periodOptions,
  receipts,
  onError,
}: PaymentRowProps) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const { deletePayment } = useDeletePayment(userId)
  const { updatePaymentPeriod } = useUpdatePaymentPeriod(userId)

  // Un pago recien creado sin conexion aun no tiene id real en el servidor.
  const isOptimistic = payment.id.startsWith('temp-')

  async function handleDelete() {
    if (busy) return
    setBusy(true)
    try {
      await deletePayment(payment.id)
      setConfirming(false)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'No se pudo eliminar el pago.')
    } finally {
      setBusy(false)
    }
  }

  async function handleReassign(value: string) {
    if (busy) return
    setBusy(true)
    try {
      await updatePaymentPeriod(payment.id, toPeriodId(value))
    } catch (error) {
      onError(error instanceof Error ? error.message : 'No se pudo cambiar el periodo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        {/* El monto manda: es lo que se busca al recorrer la lista. La fecha
            acompana, no encabeza. */}
        <div className={styles.amount}>{money(payment.amount)}</div>
        <div className={styles.date}>
          {formatIsoDate(payment.paidOn)}
          {isOptimistic && <span className={styles.pendingTag}>por sincronizar</span>}
        </div>
        {payment.note && <div className={styles.note}>{payment.note}</div>}

        <Select
          label={`Periodo del pago del ${formatIsoDate(payment.paidOn)}`}
          hideLabel
          options={periodOptions}
          value={toSelectValue(payment.periodId)}
          disabled={isOptimistic || busy}
          className={cx(uiStyles.selectCompact, styles.rowSelect)}
          onChange={(event) => void handleReassign(event.target.value)}
        />

        <ReceiptsPanel
          userId={userId}
          personId={personId}
          paymentId={payment.id}
          receipts={receipts}
          disabled={isOptimistic}
        />
      </div>

      <div className={styles.actions}>
        {confirming ? (
          <>
            <span className={styles.confirmText}>Eliminar?</span>
            <Button variant="danger" loading={busy} onClick={() => void handleDelete()}>
              Si
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
              No
            </Button>
          </>
        ) : (
          <Button
            variant="danger"
            disabled={isOptimistic || busy}
            onClick={() => setConfirming(true)}
            aria-label={`Eliminar el pago del ${formatIsoDate(payment.paidOn)}`}
          >
            Eliminar
          </Button>
        )}
      </div>
    </li>
  )
}
