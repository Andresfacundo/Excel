import { useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/Feedback'
import type { SelectOption } from '@/components/ui/Select'
import { sortPaymentsDesc } from '@/features/tracking/domain'
import type { Payment, Receipt } from '@/types/domain'
import { PaymentRow } from './PaymentRow'
import styles from '../payments.module.css'

interface PaymentListProps {
  userId: string
  personId: string
  payments: Payment[]
  periodOptions: SelectOption[]
  receiptsByPayment: Map<string, Receipt[]>
  emptyMessage: string
}

/** Lista de pagos reutilizable: dentro de un periodo, sin asignar, o completa. */
export function PaymentList({
  userId,
  personId,
  payments,
  periodOptions,
  receiptsByPayment,
  emptyMessage,
}: PaymentListProps) {
  const [error, setError] = useState<string | null>(null)
  const ordered = sortPaymentsDesc(payments)

  if (ordered.length === 0) {
    return <EmptyState>{emptyMessage}</EmptyState>
  }

  return (
    <>
      <ul className={styles.list}>
        {ordered.map((payment) => (
          <PaymentRow
            key={payment.id}
            userId={userId}
            personId={personId}
            payment={payment}
            periodOptions={periodOptions}
            receipts={receiptsByPayment.get(payment.id) ?? []}
            onError={setError}
          />
        ))}
      </ul>
      {error && <Alert tone="error">{error}</Alert>}
    </>
  )
}
