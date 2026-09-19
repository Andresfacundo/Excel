import { useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextArea, TextField } from '@/components/ui/TextField'
import { useForm } from '@/hooks/useForm'
import type { Validators } from '@/hooks/useForm'
import {
  validateIssuerName,
  validateNote,
  validateOptionalEmail,
  validatePhone,
} from '@/lib/validation'
import { LIMITS } from '@/types/domain'
import { useIssuerSettings, useSaveIssuerSettings } from '../hooks'
import styles from '../issuer.module.css'

interface Values extends Record<string, string> {
  displayName: string
  phone: string
  email: string
  note: string
}

const validators: Validators<Values> = {
  displayName: (value) => validateIssuerName(value),
  phone: (value) => validatePhone(value),
  email: (value) => validateOptionalEmail(value),
  note: (value) => validateNote(value),
}

/** Datos que salen en el encabezado del PDF de estado de cuenta. */
export function IssuerSettingsPanel({ userId }: { userId: string }) {
  const { issuer, isLoading } = useIssuerSettings(userId)
  const { saveIssuer } = useSaveIssuerSettings(userId)
  const [saved, setSaved] = useState(false)

  const form = useForm<Values>({
    initialValues: {
      displayName: issuer.displayName ?? '',
      phone: issuer.phone ?? '',
      email: issuer.email ?? '',
      note: issuer.note ?? '',
    },
    validators,
    onSubmit: async (values) => {
      setSaved(false)
      await saveIssuer({
        displayName: values.displayName,
        phone: values.phone,
        email: values.email,
        note: values.note,
      })
      setSaved(true)
    },
  })

  return (
    <details className={styles.panel}>
      <summary className={styles.summary}>Mis datos para el PDF</summary>

      <p className={styles.intro}>
        Lo que pongas aqui sale en el encabezado de todos los estados de cuenta, para que el cliente
        sepa de quien viene el documento.
      </p>

      {isLoading ? (
        <p className={styles.intro}>Cargando...</p>
      ) : (
        <form onSubmit={(event) => void form.handleSubmit(event)} noValidate>
          <TextField
            label="Nombre o negocio"
            type="text"
            autoComplete="organization"
            maxLength={LIMITS.maxIssuerNameLength}
            placeholder="Ej: Pepito perez"
            {...form.fieldProps('displayName')}
          />

          <TextField
            label="Telefono (opcional)"
            type="tel"
            autoComplete="tel"
            maxLength={LIMITS.maxIssuerPhoneLength}
            placeholder="Ej: 300 123 4567"
            {...form.fieldProps('phone')}
          />

          <TextField
            label="Correo de contacto (opcional)"
            type="email"
            autoComplete="email"
            maxLength={254}
            placeholder="Ej: contacto@ejemplo.com"
            {...form.fieldProps('email')}
          />

          <TextArea
            label="Linea adicional (opcional)"
            maxLength={LIMITS.maxNoteLength}
            placeholder="Ej: Administracion de inmuebles - NIT 123456"
            {...form.fieldProps('note')}
          />

          <Button type="submit" loading={form.submitting}>
            Guardar mis datos
          </Button>

          {form.submitError && <Alert tone="error">{form.submitError}</Alert>}
          {saved && <Alert tone="success">Datos guardados.</Alert>}
        </form>
      )}
    </details>
  )
}
