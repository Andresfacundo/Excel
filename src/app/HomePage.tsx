import { useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, Spinner } from '@/components/ui/Feedback'
import { TextField } from '@/components/ui/TextField'
import { cx } from '@/lib/cx'
import { usePayments, usePaymentsByPerson } from '@/features/payments/hooks'
import { PersonForm } from '@/features/people/components/PersonForm'
import { PersonListItem } from '@/features/people/components/PersonListItem'
import { useCreatePerson, usePeople } from '@/features/people/hooks'
import { usePeriods, usePeriodsByPerson } from '@/features/periods/hooks'
import { IssuerSettingsPanel } from '@/features/issuer/components/IssuerSettingsPanel'
import { computeTracking, summarize } from '@/features/tracking/domain'
import type { TrackingResult } from '@/features/tracking/domain'
import { GlobalSummaryCard } from '@/features/tracking/components/GlobalSummaryCard'
import type { Person } from '@/types/domain'
import { AppLayout } from './AppLayout'
import styles from '@/features/people/people.module.css'

type Filter = 'activas' | 'atraso' | 'aldia' | 'archivadas'

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'activas', label: 'Activas' },
  { id: 'atraso', label: 'Con atraso' },
  { id: 'aldia', label: 'Al dia' },
  { id: 'archivadas', label: 'Archivadas' },
]

function matchesFilter(person: Person, tracking: TrackingResult, filter: Filter): boolean {
  switch (filter) {
    case 'archivadas':
      return person.archived
    case 'atraso':
      return !person.archived && tracking.overduePeriods > 0
    case 'aldia':
      return !person.archived && tracking.percent >= 100
    case 'activas':
    default:
      return !person.archived
  }
}

export function HomePage({ user }: { user: User }) {
  const [filter, setFilter] = useState<Filter>('activas')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)

  const { data: people, isLoading: loadingPeople, error: peopleError } = usePeople(user.id)
  const { data: periods, isLoading: loadingPeriods, error: periodsError } = usePeriods(user.id)
  const { data: payments, isLoading: loadingPayments, error: paymentsError } = usePayments(user.id)

  const { createPerson } = useCreatePerson(user.id)
  const periodsByPerson = usePeriodsByPerson(periods)
  const paymentsByPerson = usePaymentsByPerson(payments)

  const rows = useMemo(
    () =>
      (people ?? []).map((person) => ({
        person,
        tracking: computeTracking(
          periodsByPerson.get(person.id) ?? [],
          paymentsByPerson.get(person.id) ?? [],
        ),
      })),
    [people, periodsByPerson, paymentsByPerson],
  )

  const globalSummary = useMemo(
    () => summarize(rows.filter((row) => !row.person.archived).map((row) => row.tracking)),
    [rows],
  )

  // Cada filtro lleva su numero: asi se ve cuantos hay con atraso sin tener que
  // tocar nada, y los que no tienen a nadie ni se pintan.
  const counts = useMemo(() => {
    const result = {} as Record<Filter, number>
    for (const option of FILTERS) {
      result[option.id] = rows.filter(({ person, tracking }) =>
        matchesFilter(person, tracking, option.id),
      ).length
    }
    return result
  }, [rows])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows.filter(({ person, tracking }) => {
      if (!matchesFilter(person, tracking, filter)) return false
      if (!needle) return true
      return (
        person.name.toLowerCase().includes(needle) ||
        (person.concept ?? '').toLowerCase().includes(needle)
      )
    })
  }, [rows, filter, search])

  const firstLoad = (loadingPeople || loadingPeriods || loadingPayments) && people === undefined
  const loadError = peopleError ?? periodsError ?? paymentsError

  return (
    <AppLayout title="Seguimiento de Pagos" subtitle="Control de pagos por persona y periodo">
      {loadError && (
        <Alert tone="error">
          No se pudieron cargar los datos: {loadError.message}. Se muestra lo ultimo guardado en
          este dispositivo.
        </Alert>
      )}

      {firstLoad ? (
        <Spinner centered label="Cargando tus personas" />
      ) : (
        <>
          <GlobalSummaryCard summary={globalSummary} />

          {creating ? (
            <Card title="Nueva persona">
              <PersonForm
                submitLabel="Guardar persona"
                onSubmit={createPerson}
                onCancel={() => setCreating(false)}
                onDone={() => setCreating(false)}
              />
            </Card>
          ) : rows.length === 0 ? (
            <Card>
              <EmptyState>
                Aun no tienes personas. Crea la primera, ponle sus periodos y empieza a registrar
                los pagos.
              </EmptyState>
              <Button onClick={() => setCreating(true)}>Agregar la primera persona</Button>
            </Card>
          ) : (
            <>
              {/* Barra unica: el boton de crear, los filtros y el buscador
                  juntos, en vez de una tarjeta entera solo para un boton. */}
              <div className={styles.toolbar}>
                <div className={styles.filters} role="group" aria-label="Filtrar personas">
                  {FILTERS.filter(
                    (option) => counts[option.id] > 0 || option.id === filter,
                  ).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={cx(styles.chip, filter === option.id && styles.chipActive)}
                      aria-pressed={filter === option.id}
                      onClick={() => setFilter(option.id)}
                    >
                      {option.label}
                      <span className={styles.chipCount}>{counts[option.id]}</span>
                    </button>
                  ))}
                </div>

                <Button
                  variant="ghost"
                  className={styles.addPerson}
                  onClick={() => setCreating(true)}
                >
                  + Persona
                </Button>
              </div>

              {rows.length > 4 && (
                <div className={styles.search}>
                  <TextField
                    label="Buscar"
                    type="search"
                    placeholder="Nombre o concepto"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
              )}
            </>
          )}

          {rows.length > 0 &&
            (visible.length === 0 ? (
              <Card>
                <EmptyState>
                  {search.trim()
                    ? `Ninguna persona coincide con "${search.trim()}".`
                    : 'Ninguna persona en este filtro.'}
                </EmptyState>
              </Card>
            ) : (
              <ul className={styles.list}>
                {visible.map(({ person, tracking }) => (
                  <PersonListItem key={person.id} person={person} tracking={tracking} />
                ))}
              </ul>
            ))}

          <IssuerSettingsPanel userId={user.id} />
        </>
      )}
    </AppLayout>
  )
}
