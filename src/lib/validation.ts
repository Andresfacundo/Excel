/**
 * Validacion de entrada del usuario.
 *
 * Funciones puras que devuelven el primer mensaje de error o `undefined`.
 * La base de datos repite cada una de estas reglas con CHECK constraints: el
 * cliente valida para dar feedback inmediato, el servidor valida porque es la
 * unica frontera en la que se puede confiar.
 */

import { LIMITS, RECEIPT_MIME_TYPES } from '@/types/domain'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Convierte `YYYY-MM-DD` a fecha local, o `null` si no es una fecha real. */
export function toDate(value: string): Date | null {
  if (!ISO_DATE.test(value)) return null
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null

  // Rechaza fechas que el navegador "corrige" solo (31 de febrero, por ejemplo).
  const normalized =
    `${date.getFullYear()}-` +
    `${String(date.getMonth() + 1).padStart(2, '0')}-` +
    `${String(date.getDate()).padStart(2, '0')}`
  return normalized === value ? date : null
}

/** Fecha de hoy como `YYYY-MM-DD` en la zona horaria local. */
export function todayIso(): string {
  const now = new Date()
  const offsetMs = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10)
}

/** Dias completos entre dos fechas ISO. Negativo si la segunda es anterior. */
export function daysBetween(fromIso: string, toIso: string): number | null {
  const from = toDate(fromIso)
  const to = toDate(toIso)
  if (!from || !to) return null
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

// --- Texto -------------------------------------------------------------------

export function validateName(value: string): string | undefined {
  const name = value.trim()
  if (!name) return 'El nombre es obligatorio.'
  if (name.length < 2) return 'El nombre debe tener al menos 2 caracteres.'
  if (name.length > LIMITS.maxNameLength) return `Maximo ${LIMITS.maxNameLength} caracteres.`
  if (!/[\p{L}\p{N}]/u.test(name)) return 'El nombre debe contener al menos una letra o numero.'
  return undefined
}

export function validateConcept(value: string): string | undefined {
  if (value.trim().length > LIMITS.maxConceptLength) {
    return `Maximo ${LIMITS.maxConceptLength} caracteres.`
  }
  return undefined
}

export function validateLabel(value: string): string | undefined {
  if (value.trim().length > LIMITS.maxLabelLength) {
    return `Maximo ${LIMITS.maxLabelLength} caracteres.`
  }
  return undefined
}

export function validateNote(value: string): string | undefined {
  if (value.trim().length > LIMITS.maxNoteLength) {
    return `Maximo ${LIMITS.maxNoteLength} caracteres.`
  }
  return undefined
}

// --- Fechas ------------------------------------------------------------------

interface DateOptions {
  label?: string
  /** Limite superior en formato `YYYY-MM-DD`. */
  max?: string
  min?: string
}

export function validateDate(value: string, options: DateOptions = {}): string | undefined {
  const label = options.label ?? 'La fecha'
  if (!value) return `${label} es obligatoria.`
  if (!toDate(value)) return `${label} no es una fecha valida.`

  const min = options.min ?? LIMITS.minDate
  const max = options.max ?? LIMITS.maxDate
  if (value < min) return `${label} no puede ser anterior a ${min}.`
  if (value > max) {
    return max === todayIso()
      ? `${label} no puede estar en el futuro.`
      : `${label} no puede ser posterior a ${max}.`
  }
  return undefined
}

/** Fecha de un pago: obligatoria, real y nunca en el futuro. */
export function validatePaymentDate(value: string): string | undefined {
  return validateDate(value, { label: 'La fecha del pago', max: todayIso() })
}

/** Fecha de inicio de un periodo. */
export function validatePeriodStart(value: string): string | undefined {
  return validateDate(value, { label: 'La fecha de inicio' })
}

/** Fecha de fin: obligatoria, posterior al inicio y de duracion razonable. */
export function validatePeriodEnd(value: string, startDate: string): string | undefined {
  const base = validateDate(value, { label: 'La fecha de fin' })
  if (base) return base

  // Si el inicio aun no es valido, no tiene sentido comparar contra el.
  if (!toDate(startDate)) return undefined

  if (value <= startDate) return 'La fecha de fin debe ser posterior a la de inicio.'

  const days = daysBetween(startDate, value)
  if (days !== null && days > LIMITS.maxPeriodDays) {
    return 'El periodo es demasiado largo (maximo 10 anios).'
  }
  return undefined
}

/**
 * Comprueba que el periodo no se solape con los que ya existen.
 * La base lo impide igual, pero avisar antes de guardar es mas amable.
 */
export function validateNoOverlap(
  startDate: string,
  endDate: string,
  others: ReadonlyArray<{ startDate: string; endDate: string }>,
): string | undefined {
  if (!toDate(startDate) || !toDate(endDate) || endDate <= startDate) return undefined

  const overlapping = others.find(
    (other) => startDate < other.endDate && other.startDate < endDate,
  )
  return overlapping
    ? `Se cruza con el periodo del ${overlapping.startDate} al ${overlapping.endDate}.`
    : undefined
}

// --- Numeros -----------------------------------------------------------------

interface AmountOptions {
  label?: string
  /** Si es `true`, el campo puede quedar vacio. */
  optional?: boolean
  max?: number
}

export function validateAmount(
  value: string | number,
  options: AmountOptions = {},
): string | undefined {
  const label = options.label ?? 'El monto'
  const raw = typeof value === 'string' ? value.trim() : String(value)
  if (raw === '') return options.optional ? undefined : `${label} es obligatorio.`

  const amount = Number(raw)
  if (!Number.isFinite(amount)) return `${label} debe ser un numero.`
  if (amount < 0) return `${label} no puede ser negativo.`
  if (amount === 0) return `${label} debe ser mayor que cero.`

  const max = options.max ?? LIMITS.maxAmount
  if (amount > max) return `${label} no puede superar ${max.toLocaleString('es-CO')}.`

  const decimals = raw.includes('.') ? (raw.split('.')[1]?.length ?? 0) : 0
  if (decimals > 2) return `${label} admite maximo 2 decimales.`

  return undefined
}

/** Cuantos periodos mensuales generar de una vez. */
export function validateGeneratedCount(value: string | number): string | undefined {
  const raw = typeof value === 'string' ? value.trim() : String(value)
  if (raw === '') return 'Indica cuantos periodos generar.'

  const count = Number(raw)
  if (!Number.isFinite(count)) return 'Debe ser un numero.'
  if (!Number.isInteger(count)) return 'Debe ser un numero entero.'
  if (count < 1) return 'Debe generar al menos un periodo.'
  if (count > LIMITS.maxGeneratedPeriods) return `Maximo ${LIMITS.maxGeneratedPeriods} periodos.`
  return undefined
}

// --- Archivos ----------------------------------------------------------------

/** Tamano legible: 1.2 MB, 340 KB... */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const ALLOWED_MIME = new Set<string>(RECEIPT_MIME_TYPES)

/**
 * Valida los archivos que se van a subir como comprobante.
 * El bucket repite estas mismas reglas (tipo y tamano), asi que un archivo que
 * se cuele por aqui igual seria rechazado por el servidor.
 */
export function validateReceiptFiles(files: readonly File[]): string | undefined {
  if (files.length === 0) return 'Elige al menos un archivo.'
  if (files.length > LIMITS.maxReceiptsPerUpload) {
    return `Maximo ${LIMITS.maxReceiptsPerUpload} archivos a la vez.`
  }

  for (const file of files) {
    if (file.size === 0) return `"${file.name}" esta vacio.`
    if (file.size > LIMITS.maxReceiptBytes) {
      return `"${file.name}" pesa ${formatBytes(file.size)}; el maximo es ${formatBytes(LIMITS.maxReceiptBytes)}.`
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return `"${file.name}" no es un tipo aceptado. Sube una imagen (JPG, PNG, WEBP, HEIC) o un PDF.`
    }
  }

  return undefined
}

// --- Emisor ------------------------------------------------------------------

export function validateIssuerName(value: string): string | undefined {
  if (value.trim().length > LIMITS.maxIssuerNameLength) {
    return `Maximo ${LIMITS.maxIssuerNameLength} caracteres.`
  }
  return undefined
}

export function validatePhone(value: string): string | undefined {
  const phone = value.trim()
  if (!phone) return undefined
  if (phone.length > LIMITS.maxIssuerPhoneLength) {
    return `Maximo ${LIMITS.maxIssuerPhoneLength} caracteres.`
  }
  if (!/^[0-9+()\s.-]+$/.test(phone)) return 'El telefono solo admite numeros y + ( ) - .'
  if (phone.replace(/\D/g, '').length < 7) return 'El telefono parece incompleto.'
  return undefined
}

/** Correo opcional: vacio es valido. */
export function validateOptionalEmail(value: string): string | undefined {
  return value.trim() ? validateEmail(value) : undefined
}

// --- Cuenta ------------------------------------------------------------------

export function validateEmail(value: string): string | undefined {
  const email = value.trim()
  if (!email) return 'El correo es obligatorio.'
  if (email.length > 254) return 'El correo es demasiado largo.'
  if (!EMAIL.test(email)) return 'Escribe un correo valido.'
  return undefined
}

export function validatePassword(value: string): string | undefined {
  if (!value) return 'La contrasena es obligatoria.'
  if (value.length < 8) return 'Usa al menos 8 caracteres.'
  if (value.length > 72) return 'Maximo 72 caracteres.'
  if (!/[a-zA-Z]/.test(value)) return 'Incluye al menos una letra.'
  if (!/\d/.test(value)) return 'Incluye al menos un numero.'
  return undefined
}

/** Solo comprueba que no este vacia: la fuerza se valida al crear la cuenta. */
export function validatePasswordPresence(value: string): string | undefined {
  return value ? undefined : 'La contrasena es obligatoria.'
}
