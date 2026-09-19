import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/Feedback'
import type { SelectOption } from '@/components/ui/Select'
import { money } from '@/lib/format'
import { AddPeriodPanel } from '@/features/periods/components/AddPeriodPanel'
import { PeriodCard } from './PeriodCard'
import type { Period } from '../domain'
import type { Person, PeriodDefinition, Receipt } from '@/types/domain'
import styles from '../tracking.module.css'

interface PeriodListProps {
  periods: Period[]
  definitions: PeriodDefinition[]
  userId: string
  person: Person
  periodOptions: SelectOption[]
  receiptsByPayment: Map<string, Receipt[]>
  /** Suma de lo que falta en los periodos ya vencidos. */
  overdueAmount: number
}

export function PeriodList({
  periods,
  definitions,
  userId,
  person,
  periodOptions,
  receiptsByPayment,
  overdueAmount,
}: PeriodListProps) {
  const [adding, setAdding] = useState(false)

  return (
    <Card
      title="Periodos"
      action={
        <div className={styles.headActions}>
          {overdueAmount > 0 && (
            <span className={styles.headOverdue}>{money(overdueAmount)} vencido</span>
          )}
          {!adding && periods.length > 0 && (
            <Button variant="ghost" onClick={() => setAdding(true)}>
              + Agregar
            </Button>
          )}
        </div>
      }
    >
      {adding && (
        <AddPeriodPanel
          userId={userId}
          person={person}
          periods={definitions}
          onClose={() => setAdding(false)}
        />
      )}

      {periods.length === 0 ? (
        adding ? null : (
          <>
            <EmptyState>
              Un periodo es un tramo con su fecha de inicio, su fecha de fin y lo que se debe pagar
              en el. Es contra lo que se comparan los pagos.
            </EmptyState>
            <Button onClick={() => setAdding(true)}>Crear el primer periodo</Button>
          </>
        )
      ) : (
        periods.map((period) => (
          <PeriodCard
            key={period.id}
            period={period}
            userId={userId}
            personId={person.id}
            periodOptions={periodOptions}
            receiptsByPayment={receiptsByPayment}
            otherDefinitions={definitions.filter((definition) => definition.id !== period.id)}
          />
        ))
      )}
    </Card>
  )
}
