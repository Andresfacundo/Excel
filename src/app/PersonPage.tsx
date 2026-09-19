import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import { EmptyState, Spinner } from '@/components/ui/Feedback'
import { TabPanel, Tabs } from '@/components/ui/Tabs'
import type { TabItem } from '@/components/ui/Tabs'
import { usePayments, usePaymentsByPerson } from '@/features/payments/hooks'
import { PaymentForm } from '@/features/payments/components/PaymentForm'
import { PaymentsCard } from '@/features/payments/components/PaymentsCard'
import { PersonSettingsPanel } from '@/features/people/components/PersonSettingsPanel'
import { usePeople } from '@/features/people/hooks'
import { usePeriods, usePeriodsByPerson } from '@/features/periods/hooks'
import { useReceipts, useReceiptsByPayment } from '@/features/receipts/hooks'
import { StatementCard } from '@/features/reports/components/StatementCard'
import { computeTracking } from '@/features/tracking/domain'
import { buildPeriodOptions } from '@/features/tracking/periodOptions'
import { SummaryCard } from '@/features/tracking/components/SummaryCard'
import { PeriodList } from '@/features/tracking/components/PeriodList'
import { AppLayout } from './AppLayout'

type Tab = 'pagos' | 'periodos' | 'pdf' | 'ajustes'

export function PersonPage({ user }: { user: User }) {
  const { personId } = useParams<{ personId: string }>()
  const [tab, setTab] = useState<Tab>('pagos')

  const { data: people, isLoading: loadingPeople } = usePeople(user.id)
  const { data: periods, isLoading: loadingPeriods } = usePeriods(user.id)
  const { data: payments, isLoading: loadingPayments } = usePayments(user.id)
  const { data: receipts } = useReceipts(user.id)

  const periodsByPerson = usePeriodsByPerson(periods)
  const paymentsByPerson = usePaymentsByPerson(payments)
  const receiptsByPayment = useReceiptsByPayment(receipts)

  const person = people?.find((candidate) => candidate.id === personId)

  const personPeriods = useMemo(
    () => (personId ? (periodsByPerson.get(personId) ?? []) : []),
    [periodsByPerson, personId],
  )
  const personPayments = useMemo(
    () => (personId ? (paymentsByPerson.get(personId) ?? []) : []),
    [paymentsByPerson, personId],
  )

  const tracking = useMemo(
    () => computeTracking(personPeriods, personPayments),
    [personPeriods, personPayments],
  )

  const periodOptions = useMemo(() => buildPeriodOptions(tracking.periods), [tracking.periods])

  const firstLoad = (loadingPeople || loadingPeriods || loadingPayments) && people === undefined
  if (firstLoad) {
    return (
      <AppLayout title="Seguimiento de Pagos" subtitle="Cargando..." showBack>
        <Spinner centered label="Cargando la persona" />
      </AppLayout>
    )
  }

  if (!person) {
    return (
      <AppLayout title="Persona no encontrada" subtitle="Puede que la hayas eliminado" showBack>
        <Card>
          <EmptyState>Esta persona ya no existe.</EmptyState>
          <p style={{ textAlign: 'center', fontSize: 13 }}>
            <Link to="/">Volver a la lista</Link>
          </p>
        </Card>
      </AppLayout>
    )
  }

  // El contador rojo en "Periodos" es el aviso de que hay algo que cobrar.
  const tabs: Array<TabItem<Tab>> = [
    { id: 'pagos', label: 'Pagos', count: personPayments.length },
    {
      id: 'periodos',
      label: 'Periodos',
      count: tracking.overduePeriods > 0 ? tracking.overduePeriods : personPeriods.length,
      alert: tracking.overduePeriods > 0,
    },
    { id: 'pdf', label: 'PDF' },
    { id: 'ajustes', label: 'Ajustes' },
  ]

  return (
    <AppLayout title={person.name} subtitle={person.concept ?? 'Seguimiento de pagos'} showBack>
      {person.archived && (
        <Alert tone="info">
          Esta persona esta archivada: no cuenta en el resumen general. Puedes reactivarla desde
          Ajustes.
        </Alert>
      )}

      {person.notes && <Alert tone="info">{person.notes}</Alert>}

      {/* El resumen queda fuera de las pestanas: es la respuesta a "como va
          esta persona" y se quiere ver siempre, sin importar en que se este. */}
      <SummaryCard tracking={tracking} title={`Resumen de ${person.name}`} />

      <Tabs items={tabs} active={tab} onChange={setTab} label={`Secciones de ${person.name}`} />

      {tab === 'pagos' && (
        <TabPanel id="pagos">
          <PaymentForm
            userId={user.id}
            person={person}
            periods={tracking.periods}
            definitions={personPeriods}
          />
          <PaymentsCard
            userId={user.id}
            personId={person.id}
            payments={personPayments}
            unassigned={tracking.unassignedPayments}
            periodOptions={periodOptions}
            receiptsByPayment={receiptsByPayment}
          />
        </TabPanel>
      )}

      {tab === 'periodos' && (
        <TabPanel id="periodos">
          <PeriodList
            periods={tracking.periods}
            definitions={personPeriods}
            userId={user.id}
            person={person}
            periodOptions={periodOptions}
            receiptsByPayment={receiptsByPayment}
            overdueAmount={tracking.overdueAmount}
          />
        </TabPanel>
      )}

      {tab === 'pdf' && (
        <TabPanel id="pdf">
          <StatementCard
            userId={user.id}
            person={person}
            tracking={tracking}
            payments={personPayments}
            receiptsByPayment={receiptsByPayment}
          />
        </TabPanel>
      )}

      {tab === 'ajustes' && (
        <TabPanel id="ajustes">
          <PersonSettingsPanel
            userId={user.id}
            person={person}
            paymentCount={personPayments.length}
            periodCount={personPeriods.length}
          />
        </TabPanel>
      )}
    </AppLayout>
  )
}
