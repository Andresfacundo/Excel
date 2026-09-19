import { useMemo } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { MoneyField } from '@/components/ui/MoneyField'
import { TextField } from '@/components/ui/TextField'
import { useForm } from '@/hooks/useForm'
import type { Validators } from '@/hooks/useForm'
import { money } from '@/lib/format'
import {
  daysBetween,
  validateAmount,
  validateLabel,
  validateNoOverlap,
  validatePeriodEnd,
  validatePeriodStart,
} from '@/lib/validation'
import { LIMITS } from '@/types/domain'
import type { PeriodDefinition } from '@/types/domain'
import styles from '../periods.module.css'

interface Values extends Record<string, string> {
  startDate: string
  endDate: string
  targetAmount: string
  label: string
}

export interface PeriodFormResult {
  startDate: string
  endDate: string
  targetAmount: number
  label: string | null
}

interface PeriodFormProps {
  /** Periodos que ya existen, para avisar de cruces antes de guardar. */
  others: PeriodDefinition[]
  initialValues: Values
  submitLabel: string
  onSubmit: (period: PeriodFormResult) => Promise<unknown>
  onCancel?: () => void
  onDone?: () => void
}

export function PeriodForm({
  others,
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  onDone,
}: PeriodFormProps) {
  const validators = useMemo<Validators<Values>>(
    () => ({
      startDate: (value) => validatePeriodStart(value),
      endDate: (value, values) =>
        validatePeriodEnd(value, values.startDate) ??
        validateNoOverlap(values.startDate, value, others),
      targetAmount: (value) => validateAmount(value, { label: 'El objetivo del periodo' }),
      label: (value) => validateLabel(value),
    }),
    [others],
  )

  const form = useForm<Values>({
    initialValues,
    validators,
    onSubmit: async (values) => {
      await onSubmit({
        startDate: values.startDate,
        endDate: values.endDate,
        targetAmount: Number(values.targetAmount),
        label: values.label.trim() || null,
      })
      onDone?.()
    },
  })

  const { values, errors } = form
  const days =
    errors.startDate || errors.endDate ? null : daysBetween(values.startDate, values.endDate)

  return (
    <form onSubmit={(event) => void form.handleSubmit(event)} noValidate>
      <TextField
        label="Fecha de inicio"
        type="date"
        min={LIMITS.minDate}
        max={LIMITS.maxDate}
        {...form.fieldProps('startDate')}
      />

      <TextField
        label="Fecha de fin"
        type="date"
        min={LIMITS.minDate}
        max={LIMITS.maxDate}
        help="El dia de fin no se cuenta: si va del 21 de julio al 21 de agosto, el 21 de agosto ya es del periodo siguiente."
        {...form.fieldProps('endDate')}
      />

      <MoneyField
        label="Objetivo de este periodo"
        placeholder="2508000"
        {...form.fieldProps('targetAmount')}
      />

      <TextField
        label="Nombre del periodo (opcional)"
        type="text"
        autoComplete="off"
        maxLength={LIMITS.maxLabelLength}
        placeholder="Ej: Julio, Cuota 3, Mes de gracia"
        {...form.fieldProps('label')}
      />

      {days !== null && days > 0 && !errors.targetAmount && (
        <p className={styles.preview}>
          {days} dia{days === 1 ? '' : 's'} · objetivo{' '}
          <span className={styles.previewStrong}>{money(Number(values.targetAmount))}</span>
        </p>
      )}

      <div className={styles.actions}>
        <Button type="submit" loading={form.submitting}>
          {submitLabel}
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
