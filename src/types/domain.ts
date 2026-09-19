/** Tipos del dominio, independientes de la forma en que Supabase los almacena. */

export interface Person {
  id: string
  name: string
  /** Que se esta pagando: arriendo, prestamo, cuota... */
  concept: string | null
  notes: string | null
  archived: boolean
  /** Monto que se precarga al crear un periodo nuevo. No define ningun periodo. */
  defaultTargetAmount: number | null
  createdAt: string
}

export interface NewPerson {
  name: string
  concept?: string | null
  notes?: string | null
  defaultTargetAmount?: number | null
}

/** Un periodo de pago, con sus propias fechas y su propio objetivo. */
export interface PeriodDefinition {
  id: string
  personId: string
  /** Fecha de inicio, inclusive, en formato `YYYY-MM-DD`. */
  startDate: string
  /** Fecha de fin, exclusive, en formato `YYYY-MM-DD`. */
  endDate: string
  targetAmount: number
  /** Nombre opcional: "Julio", "Cuota 3", "Mes de gracia"... */
  label: string | null
}

export interface NewPeriod {
  personId: string
  startDate: string
  endDate: string
  targetAmount: number
  label?: string | null
}

export interface Payment {
  id: string
  personId: string
  /** Fecha del pago en formato `YYYY-MM-DD`. */
  paidOn: string
  amount: number
  note: string | null
  /**
   * Periodo al que se abona.
   * `null` = sin asignar: se reparte en cascada sobre los periodos pendientes.
   */
  periodId: string | null
  /** Timestamp ISO; se usa para desempatar el orden dentro del mismo dia. */
  createdAt: string
}

export interface NewPayment {
  personId: string
  paidOn: string
  amount: number
  note?: string | null
  periodId?: string | null
}

/** Comprobante de un pago: la imagen o PDF que lo respalda. */
export interface Receipt {
  id: string
  paymentId: string
  /** Ruta dentro del bucket privado. Nunca es una URL publica. */
  storagePath: string
  fileName: string
  mimeType: string
  sizeBytes: number
  createdAt: string
}

/** Datos que salen en el encabezado del PDF de estado de cuenta. */
export interface IssuerSettings {
  displayName: string | null
  phone: string | null
  email: string | null
  note: string | null
}

export const EMPTY_ISSUER: IssuerSettings = {
  displayName: null,
  phone: null,
  email: null,
  note: null,
}

/** Tipos de archivo que se aceptan como comprobante. */
export const RECEIPT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
] as const

export const LIMITS = {
  minDate: '2000-01-01',
  maxDate: '2100-12-31',
  maxAmount: 1_000_000_000_000,
  /** Duracion maxima de un periodo, en dias (unos 10 anios). */
  maxPeriodDays: 3660,
  /** Cuantos periodos puede crear de una vez el generador mensual. */
  maxGeneratedPeriods: 240,
  maxNameLength: 80,
  maxLabelLength: 80,
  maxConceptLength: 120,
  maxNoteLength: 280,
  /** Tamano maximo de un comprobante, en bytes (10 MB). */
  maxReceiptBytes: 10 * 1024 * 1024,
  /** Cuantos comprobantes se pueden subir de una vez. */
  maxReceiptsPerUpload: 10,
  maxIssuerNameLength: 120,
  maxIssuerPhoneLength: 40,
} as const
