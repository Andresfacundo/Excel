import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { MoneyField } from '@/components/ui/MoneyField'
import { Select } from '@/components/ui/Select'
import { TextField } from '@/components/ui/TextField'
import { useForm } from '@/hooks/useForm'
import type { Validators } from '@/hooks/useForm'
import { money } from '@/lib/format'
import {
  formatBytes,
  todayIso,
  validateAmount,
  validateNote,
  validatePaymentDate,
  validateReceiptFiles,
} from '@/lib/validation'
import { periodForDate } from '@/features/tracking/domain'
import type { Period } from '@/features/tracking/domain'
import { buildPeriodOptions, toPeriodId, toSelectValue } from '@/features/tracking/periodOptions'
import { useUploadReceipts } from '@/features/receipts/hooks'
import { LIMITS, RECEIPT_MIME_TYPES } from '@/types/domain'
import type { Person, PeriodDefinition } from '@/types/domain'
import { useAddPayment } from '../hooks'
import styles from '../payments.module.css'

interface Values extends Record<string, string> {
  paidOn: string
  amount: string
  note: string
  periodId: string
}

interface PaymentFormProps {
  userId: string
  person: Person
  /** Periodos ya calculados, para sugerir cuanto falta en el elegido. */
  periods: Period[]
  definitions: PeriodDefinition[]
}

export function PaymentForm({ userId, person, periods, definitions }: PaymentFormProps) {
  const { addPayment } = useAddPayment(userId)
  const { uploadReceipts } = useUploadReceipts(userId)

  // Los archivos viven fuera de `useForm`: un File no es un valor de texto y no
  // se puede persistir en la cache, asi que se suben aparte tras crear el pago.
  const fileInputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [uploadWarning, setUploadWarning] = useState<string | null>(null)

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? [])
    setUploadWarning(null)
    if (chosen.length === 0) {
      setFiles([])
      setFileError(null)
      return
    }
    const problem = validateReceiptFiles(chosen)
    setFileError(problem ?? null)
    setFiles(problem ? [] : chosen)
  }

  function clearFiles() {
    setFiles([])
    setFileError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const options = useMemo(() => buildPeriodOptions(periods), [periods])
  const validPeriodIds = useMemo(() => new Set(periods.map((p) => p.id)), [periods])

  const validators = useMemo<Validators<Values>>(
    () => ({
      paidOn: (value) => validatePaymentDate(value),
      amount: (value) => validateAmount(value, { label: 'El monto' }),
      note: (value) => validateNote(value),
      periodId: (value) =>
        value === '' || validPeriodIds.has(value)
          ? undefined
          : 'Ese periodo ya no existe. Elige otro o deja el pago sin asignar.',
    }),
    [validPeriodIds],
  )

  const today = todayIso()
  const form = useForm<Values>({
    initialValues: {
      paidOn: today,
      amount: '',
      note: '',
      periodId: toSelectValue(periodForDate(definitions, today)?.id ?? null),
    },
    validators,
    onSubmit: async (values) => {
      if (fileError) throw new Error(fileError)

      const payment = await addPayment({
        personId: person.id,
        paidOn: values.paidOn,
        amount: Number(values.amount),
        note: values.note,
        periodId: toPeriodId(values.periodId),
      })

      // El pago ya quedo guardado: si falla la subida, se avisa pero no se
      // pierde el registro. Los comprobantes se pueden adjuntar luego.
      if (files.length > 0) {
        try {
          await uploadReceipts(person.id, payment.id, files)
        } catch (error) {
          setUploadWarning(
            error instanceof Error
              ? `El pago se guardo, pero los comprobantes no se subieron: ${error.message}`
              : 'El pago se guardo, pero los comprobantes no se subieron.',
          )
        }
      }

      clearFiles()
      form.reset({ amount: '', note: '' })
    },
  })

  // Mientras el usuario no elija periodo a mano, el periodo sigue a la fecha.
  const periodTouched = useRef(false)
  const { paidOn } = form.values
  const { setValue } = form

  useEffect(() => {
    if (periodTouched.current) return
    setValue('periodId', toSelectValue(periodForDate(definitions, paidOn)?.id ?? null))
  }, [paidOn, definitions, setValue])

  const selectedId = toPeriodId(form.values.periodId)
  const selectedPeriod = selectedId === null ? null : periods.find((p) => p.id === selectedId)

  const amountHelp = selectedPeriod
    ? selectedPeriod.pending > 0
      ? `A ese periodo le faltan ${money(selectedPeriod.pending)}.`
      : 'Ese periodo ya esta cubierto; el excedente pasa al siguiente.'
    : 'Sin asignar: el dinero tapa primero los periodos mas atrasados.'

  /**
   * Montos de un toque. Son los dos que se escriben el 90% de las veces, y
   * teclear "2508000" a mano es justo donde se cuela un cero de mas.
   */
  const suggestions = useMemo(() => {
    const list: Array<{ label: string; amount: number }> = []
    if (selectedPeriod && selectedPeriod.pending > 0) {
      list.push({ label: 'Lo que falta', amount: selectedPeriod.pending })
    }
    if (
      selectedPeriod &&
      selectedPeriod.target > 0 &&
      Math.round(selectedPeriod.target) !== Math.round(selectedPeriod.pending)
    ) {
      list.push({ label: 'Periodo completo', amount: selectedPeriod.target })
    }
    if (list.length === 0 && person.defaultTargetAmount !== null) {
      list.push({ label: 'Monto habitual', amount: person.defaultTargetAmount })
    }
    return list
  }, [selectedPeriod, person.defaultTargetAmount])

  const dateOutsideAnyPeriod =
    periods.length > 0 && form.values.paidOn !== '' && periodForDate(definitions, paidOn) === null

  if (periods.length === 0) {
    return (
      <Card title="Registrar pago">
        <Alert tone="info">
          Primero crea al menos un periodo. Igual puedes registrar pagos sin asignar, pero no habra
          contra que compararlos.
        </Alert>
      </Card>
    )
  }

  return (
    <Card title="Registrar pago">
      <form onSubmit={(event) => void form.handleSubmit(event)} noValidate>
        <TextField
          label="Fecha del pago"
          type="date"
          min={LIMITS.minDate}
          max={today}
          help={
            dateOutsideAnyPeriod
              ? 'Esa fecha no cae dentro de ningun periodo. Elige a cual abonarlo.'
              : undefined
          }
          {...form.fieldProps('paidOn')}
        />

        <Select
          label="Abonar al periodo"
          options={options}
          help="Se preselecciona el periodo de la fecha; cambialo si el abono es de otro."
          {...form.fieldProps('periodId')}
          onChange={(event) => {
            periodTouched.current = true
            form.setValue('periodId', event.target.value)
          }}
        />

        <MoneyField label="Monto" placeholder="500000" help={amountHelp} {...form.fieldProps('amount')} />

        {suggestions.length > 0 && (
          <div className={styles.suggestions}>
            <span className={styles.suggestionsLabel}>Rellenar con:</span>
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                className={styles.suggestion}
                onClick={() => form.setValue('amount', String(Math.round(suggestion.amount)))}
              >
                {suggestion.label} · {money(suggestion.amount)}
              </button>
            ))}
          </div>
        )}

        <TextField
          label="Nota (opcional)"
          type="text"
          autoComplete="off"
          maxLength={LIMITS.maxNoteLength}
          placeholder="Ej: consignacion Bancolombia"
          {...form.fieldProps('note')}
        />

        <div className={styles.attachBlock}>
          <span className={styles.attachLabel}>Comprobante de pago (opcional)</span>

          {/* El control nativo rotula sus botones en el idioma del navegador
              ("Choose Files / No file chosen"). Se oculta y se gobierna desde
              esta etiqueta, que ademas da un area comoda para el dedo. */}
          <input
            id={fileInputId}
            ref={fileInputRef}
            type="file"
            multiple
            className={`visually-hidden ${styles.fileFocus}`}
            accept={RECEIPT_MIME_TYPES.join(',')}
            onChange={handleFiles}
          />
          <div className={styles.attachActions}>
            <label htmlFor={fileInputId} className={styles.attachButton}>
              {files.length > 0 ? 'Cambiar archivos' : 'Elegir archivos'}
            </label>
            {files.length > 0 && (
              <button type="button" className={styles.attachClear} onClick={clearFiles}>
                Quitar
              </button>
            )}
          </div>

          <p className={styles.attachHint}>
            {files.length > 0
              ? `${files.length} archivo(s): ${files.map((file) => file.name).join(', ')}`
              : `Imagen o PDF, hasta ${formatBytes(LIMITS.maxReceiptBytes)} cada uno. Es el soporte que te respalda si el cliente discute un pago.`}
          </p>
          {fileError && (
            <p className={styles.attachError} role="alert">
              {fileError}
            </p>
          )}
        </div>

        <Button type="submit" loading={form.submitting}>
          Agregar pago
        </Button>

        {form.submitError && <Alert tone="error">{form.submitError}</Alert>}
        {uploadWarning && <Alert tone="warning">{uploadWarning}</Alert>}
      </form>
    </Card>
  )
}
