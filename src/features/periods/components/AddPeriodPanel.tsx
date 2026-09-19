import { useState } from 'react'
import { cx } from '@/lib/cx'
import { addMonths, parseIsoDate, sortPeriods, toIsoDate } from '@/features/tracking/domain'
import { todayIso } from '@/lib/validation'
import type { NewPeriod, Person, PeriodDefinition } from '@/types/domain'
import { useCreatePeriods } from '../hooks'
import { MonthlyGeneratorForm } from './MonthlyGeneratorForm'
import { PeriodForm } from './PeriodForm'
import styles from '../periods.module.css'

type Mode = 'one' | 'monthly'

interface AddPeriodPanelProps {
  userId: string
  person: Person
  periods: PeriodDefinition[]
  onClose: () => void
}

/**
 * Alta de periodos, uno a uno o varios mensuales de golpe.
 *
 * Vive dentro de la tarjeta de periodos en vez de en una tarjeta aparte: crear
 * un periodo y mirar los que ya hay son la misma tarea, y tenerlas separadas
 * obligaba a recorrer media pantalla entre una y otra.
 *
 * Precarga la fecha de inicio justo donde termino el ultimo periodo y repite su
 * objetivo, que es lo que se quiere el 95% de las veces.
 */
export function AddPeriodPanel({ userId, person, periods, onClose }: AddPeriodPanelProps) {
  const [mode, setMode] = useState<Mode>('one')
  const { createPeriod, createPeriods } = useCreatePeriods(userId)

  const ordered = sortPeriods(periods)
  const last = ordered[ordered.length - 1]
  const suggestedStart = last ? last.endDate : todayIso()
  const suggestedEnd = toIsoDate(addMonths(parseIsoDate(suggestedStart), 1))
  const suggestedAmount = last?.targetAmount ?? person.defaultTargetAmount ?? ''

  return (
    <div className={styles.addPanel}>
      <div className={styles.tabs} role="group" aria-label="Como agregar periodos">
        <button
          type="button"
          className={cx(styles.tab, mode === 'one' && styles.tabActive)}
          aria-pressed={mode === 'one'}
          onClick={() => setMode('one')}
        >
          Un periodo
        </button>
        <button
          type="button"
          className={cx(styles.tab, mode === 'monthly' && styles.tabActive)}
          aria-pressed={mode === 'monthly'}
          onClick={() => setMode('monthly')}
        >
          Varios mensuales
        </button>
      </div>

      <p className={styles.addHint}>
        {mode === 'one'
          ? 'Cada periodo tiene sus propias fechas y su propio objetivo. Pueden durar distinto y puede haber huecos entre uno y otro; lo unico que no pueden es cruzarse.'
          : 'Crea de una vez varios periodos de un mes, todos con el mismo objetivo. Despues puedes cambiarle las fechas o el monto a cualquiera por separado.'}
      </p>

      {mode === 'one' ? (
        <PeriodForm
          others={ordered}
          initialValues={{
            startDate: suggestedStart,
            endDate: suggestedEnd,
            targetAmount: String(suggestedAmount),
            label: '',
          }}
          submitLabel="Guardar periodo"
          onSubmit={(period) => createPeriod({ personId: person.id, ...period } satisfies NewPeriod)}
          onCancel={onClose}
          onDone={onClose}
        />
      ) : (
        <MonthlyGeneratorForm
          others={ordered}
          initialValues={{
            startDate: suggestedStart,
            count: '5',
            targetAmount: String(suggestedAmount),
          }}
          onSubmit={(generated) =>
            createPeriods(generated.map((period) => ({ personId: person.id, ...period })))
          }
          onCancel={onClose}
          onDone={onClose}
        />
      )}
    </div>
  )
}
