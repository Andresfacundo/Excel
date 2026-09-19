import { useMemo } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { MoneyField } from '@/components/ui/MoneyField'
import { TextField } from '@/components/ui/TextField'
import { useForm } from '@/hooks/useForm'
import type { Validators } from '@/hooks/useForm'
import { formatPeriodRange, money } from '@/lib/format'
import {
  validateAmount,
  validateGeneratedCount,
  validateNoOverlap,
  validatePeriodStart,
} from '@/lib/validation'
import { monthlyPeriods, parseIsoDate } from '@/features/tracking/domain'
import { LIMITS } from '@/types/domain'
import type { PeriodDefinition } from '@/types/domain'
import styles from '../periods.module.css'

interface Values extends Record<string, string> {
  startDate: string
  count: string
  targetAmount: string
}

interface MonthlyGeneratorFormProps {
  others: PeriodDefinition[]
  initialValues: Values
  onSubmit: (periods: Array<{ startDate: string; endDate: string; targetAmount: number }>) => Promise<unknown>
  onCancel?: () => void
  onDone?: () => void
}

/**
 * Atajo para crear varios periodos mensuales de una vez. Cada uno queda como
 * una fila normal, editable por separado despues.
 */
export function MonthlyGeneratorForm({
  others,
  initialValues,
  onSubmit,
  onCancel,
  onDone,
}: MonthlyGeneratorFormProps) {
  const validators = useMemo<Validators<Values>>(
    () => ({
      startDate: (value, values) => {
        const base = validatePeriodStart(value)
        if (base) return base

        // Se comprueba el bloque completo contra lo que ya existe.
        const countError = validateGeneratedCount(values.count)
        if (countError) return undefined

        const generated = monthlyPeriods(value, Number(values.count), 1)
        const last = generated[generated.length - 1]
        const first = generated[0]
        if (!first || !last) return undefined
        return validateNoOverlap(first.startDate, last.endDate, others)
      },
      count: (value) => validateGeneratedCount(value),
      targetAmount: (value) => validateAmount(value, { label: 'El objetivo por periodo' }),
    }),
    [others],
  )

  const form = useForm<Values>({
    initialValues,
    validators,
    onSubmit: async (values) => {
      await onSubmit(
        monthlyPeriods(values.startDate, Number(values.count), Number(values.targetAmount)),
      )
      onDone?.()
    },
  })

  const { values, errors } = form
  const preview = useMemo(() => {
    if (errors.startDate || errors.count || errors.targetAmount) return null
    const generated = monthlyPeriods(values.startDate, Number(values.count), Number(values.targetAmount))
    const first = generated[0]
    const last = generated[generated.length - 1]
    if (!first || !last) return null

    return {
      count: generated.length,
      from: formatPeriodRange(parseIsoDate(first.startDate), parseIsoDate(first.endDate)),
      lastEnd: parseIsoDate(last.endDate),
      total: generated.length * Number(values.targetAmount),
    }
  }, [values.startDate, values.count, values.targetAmount, errors])

  return (
    <form onSubmit={(event) => void form.handleSubmit(event)} noValidate>
      <TextField
        label="Fecha de inicio del primer periodo"
        type="date"
        min={LIMITS.minDate}
        max={LIMITS.maxDate}
        {...form.fieldProps('startDate')}
      />

      <TextField
        label="Cuantos periodos mensuales"
        type="number"
        inputMode="numeric"
        min={1}
        max={LIMITS.maxGeneratedPeriods}
        step={1}
        placeholder="Ej: 5"
        {...form.fieldProps('count')}
      />

      <MoneyField
        label="Objetivo de cada periodo"
        placeholder="2508000"
        help="Despues puedes cambiarle el monto o las fechas a cualquiera por separado."
        {...form.fieldProps('targetAmount')}
      />

      {preview && (
        <p className={styles.preview}>
          Se crearan {preview.count} periodo{preview.count === 1 ? '' : 's'}: el primero{' '}
          {preview.from}, y el ultimo termina el{' '}
          {preview.lastEnd.toLocaleDateString('es-CO', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
          . Total: <span className={styles.previewStrong}>{money(preview.total)}</span>.
        </p>
      )}

      <div className={styles.actions}>
        <Button type="submit" loading={form.submitting}>
          Generar periodos
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={form.submitting}>
            Cancelar
          </Button>
        )}
      </div>

      {form.submitError && <Alert tone="error">{form.submitError}</Alert>}
    </form>
  )
}
