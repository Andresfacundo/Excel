import { useCallback, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'

/**
 * Formularios controlados con validacion por campo.
 *
 * Reglas de presentacion que aplica el hook:
 * - El error de un campo solo se muestra cuando el usuario ya lo toco (blur) o
 *   cuando intento enviar. Nadie quiere ver "es obligatorio" antes de escribir.
 * - Tras el primer intento de envio, los errores se actualizan mientras escribe,
 *   para que se vea desaparecer el mensaje al corregir.
 * - `handleSubmit` bloquea el doble envio y captura el error del servidor.
 */

export type Validator<T> = (value: string, values: T) => string | undefined

export type Validators<T extends Record<string, string>> = {
  [K in keyof T]?: Validator<T>
}

export type FormErrors<T> = Partial<Record<keyof T, string>>

interface UseFormOptions<T extends Record<string, string>> {
  initialValues: T
  validators: Validators<T>
  onSubmit: (values: T) => Promise<void> | void
}

export function useForm<T extends Record<string, string>>({
  initialValues,
  validators,
  onSubmit,
}: UseFormOptions<T>) {
  const [values, setValues] = useState<T>(initialValues)
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const submittingRef = useRef(false)

  const errors = useMemo<FormErrors<T>>(() => {
    const next: FormErrors<T> = {}
    for (const key of Object.keys(validators) as Array<keyof T>) {
      const validate = validators[key]
      if (!validate) continue
      const message = validate(values[key] ?? '', values)
      if (message) next[key] = message
    }
    return next
  }, [values, validators])

  const isValid = Object.keys(errors).length === 0

  /** El error que debe pintarse ahora mismo para un campo. */
  const errorFor = useCallback(
    (key: keyof T): string | undefined =>
      touched[key] || submitAttempted ? errors[key] : undefined,
    [errors, touched, submitAttempted],
  )

  const setValue = useCallback((key: keyof T, value: string) => {
    setValues((current) => ({ ...current, [key]: value }))
    setSubmitError(null)
  }, [])

  const handleBlur = useCallback((key: keyof T) => {
    setTouched((current) => ({ ...current, [key]: true }))
  }, [])

  const reset = useCallback((next?: Partial<T>) => {
    setValues((current) => ({ ...current, ...next }))
    setTouched({})
    setSubmitAttempted(false)
    setSubmitError(null)
  }, [])

  const resetTo = useCallback((next: T) => {
    setValues(next)
    setTouched({})
    setSubmitAttempted(false)
    setSubmitError(null)
  }, [])

  const handleSubmit = useCallback(
    async (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault()
      setSubmitAttempted(true)
      setSubmitError(null)

      if (Object.keys(errors).length > 0) return false
      if (submittingRef.current) return false

      submittingRef.current = true
      setSubmitting(true)
      try {
        await onSubmit(values)
        return true
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Algo salio mal. Intenta de nuevo.')
        return false
      } finally {
        submittingRef.current = false
        setSubmitting(false)
      }
    },
    [errors, onSubmit, values],
  )

  /** Props listas para pasarle a `<TextField>`. */
  const fieldProps = useCallback(
    (key: keyof T) => ({
      value: values[key],
      error: errorFor(key),
      onChange: (event: { target: { value: string } }) => setValue(key, event.target.value),
      onBlur: () => handleBlur(key),
    }),
    [values, errorFor, setValue, handleBlur],
  )

  return {
    values,
    errors,
    errorFor,
    fieldProps,
    isValid,
    submitting,
    submitError,
    setSubmitError,
    setValue,
    handleBlur,
    handleSubmit,
    reset,
    resetTo,
  }
}
