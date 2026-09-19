import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { MoneyField } from '@/components/ui/MoneyField'
import { TextArea, TextField } from '@/components/ui/TextField'
import { useForm } from '@/hooks/useForm'
import type { Validators } from '@/hooks/useForm'
import {
  validateAmount,
  validateConcept,
  validateName,
  validateNote,
} from '@/lib/validation'
import { LIMITS } from '@/types/domain'
import type { NewPerson, Person } from '@/types/domain'
import styles from '../people.module.css'

interface Values extends Record<string, string> {
  name: string
  concept: string
  defaultTargetAmount: string
  notes: string
}

const validators: Validators<Values> = {
  name: (value) => validateName(value),
  concept: (value) => validateConcept(value),
  defaultTargetAmount: (value) =>
    validateAmount(value, { label: 'El monto sugerido', optional: true }),
  notes: (value) => validateNote(value),
}

function emptyValues(): Values {
  return { name: '', concept: '', defaultTargetAmount: '', notes: '' }
}

function valuesFrom(person: Person): Values {
  return {
    name: person.name,
    concept: person.concept ?? '',
    defaultTargetAmount:
      person.defaultTargetAmount === null ? '' : String(person.defaultTargetAmount),
    notes: person.notes ?? '',
  }
}

interface PersonFormProps {
  /** Si viene, el formulario edita esa persona; si no, crea una nueva. */
  person?: Person
  submitLabel: string
  onSubmit: (person: NewPerson) => Promise<unknown>
  onCancel?: () => void
  /** Se llama tras un envio correcto. */
  onDone?: () => void
}

export function PersonForm({ person, submitLabel, onSubmit, onCancel, onDone }: PersonFormProps) {
  const form = useForm<Values>({
    initialValues: person ? valuesFrom(person) : emptyValues(),
    validators,
    onSubmit: async (values) => {
      await onSubmit({
        name: values.name,
        concept: values.concept,
        notes: values.notes,
        defaultTargetAmount:
          values.defaultTargetAmount.trim() === '' ? null : Number(values.defaultTargetAmount),
      })
      onDone?.()
    },
  })

  return (
    <form onSubmit={(event) => void form.handleSubmit(event)} noValidate>
      <TextField
        label="Nombre de la persona"
        type="text"
        autoComplete="off"
        maxLength={LIMITS.maxNameLength}
        placeholder="Ej: Wilfer Gomez"
        {...form.fieldProps('name')}
      />

      <TextField
        label="Concepto (opcional)"
        type="text"
        autoComplete="off"
        maxLength={LIMITS.maxConceptLength}
        placeholder="Ej: Arriendo, prestamo, cuota del carro"
        help="Sirve para distinguir dos seguimientos de la misma persona."
        {...form.fieldProps('concept')}
      />

      <MoneyField
        label="Monto habitual por periodo (opcional)"
        placeholder="2508000"
        help="Se usa para precargar el objetivo al crear un periodo nuevo."
        {...form.fieldProps('defaultTargetAmount')}
      />

      <TextArea
        label="Notas (opcional)"
        maxLength={LIMITS.maxNoteLength}
        placeholder="Cualquier detalle que quieras recordar"
        {...form.fieldProps('notes')}
      />

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
