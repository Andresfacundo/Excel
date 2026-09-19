/**
 * Logica de dominio del seguimiento de pagos.
 *
 * Modulo puro: no toca React, ni red, ni el DOM. Toda la matematica vive aqui y
 * esta cubierta por pruebas en `domain.test.ts`.
 *
 * Los periodos NO se generan: llegan como filas con su fecha de inicio, su
 * fecha de fin y su propio objetivo. Pueden tener duraciones distintas, montos
 * distintos y huecos entre uno y otro; lo unico que no pueden es solaparse
 * (lo impide la base de datos).
 *
 * Como se reparte el dinero (importa el orden):
 *
 *   1. Cada pago con `periodId` suma directamente a ESE periodo. Es lo que
 *      permite decir "estos $500.000 son del periodo de agosto" aunque el de
 *      julio siga debiendo.
 *   2. Si un periodo recibe mas de su objetivo, el excedente baja al siguiente
 *      periodo pendiente (y asi sucesivamente).
 *   3. Los pagos sin asignar forman un bolsillo comun que tapa los huecos que
 *      queden, del periodo mas antiguo al mas nuevo.
 *   4. Lo que sobre al final queda como saldo a favor sin asignar.
 */

import type { Payment, PeriodDefinition } from '@/types/domain'

export type PeriodStatus = 'success' | 'warning' | 'danger' | 'info'

export interface Period {
  id: string
  /** Posicion cronologica, empezando en 0. Solo para mostrar "Periodo 3". */
  position: number
  start: Date
  end: Date
  /** Etiqueta escrita por el usuario, si le puso una. */
  label: string | null
  /** Monto que se espera cubrir en este periodo. */
  target: number

  /** Pagos marcados explicitamente para este periodo. */
  payments: Payment[]
  /** Suma de esos pagos, antes de aplicar limites. */
  assigned: number
  /** Excedente que llego desde periodos anteriores. */
  carryIn: number
  /** Excedente que este periodo pasa al siguiente. */
  carryOut: number
  /** Dinero del bolsillo sin asignar que se uso para tapar este periodo. */
  fromPool: number

  /** Total cubierto: assigned + carryIn + fromPool, con tope en el objetivo. */
  paid: number
  /** target - paid. Nunca negativo: el exceso se va en carryOut. */
  pending: number
  /** paid - target del periodo aislado. */
  drift: number
  /** Suma de `drift` desde el primer periodo hasta este. */
  cumulativeDrift: number
  status: PeriodStatus
  statusLabel: string
  /** Porcentaje cubierto, acotado a 0..100. */
  percent: number
}

export interface TrackingResult {
  periods: Period[]
  /** Pagos sin periodo asignado (o apuntando a uno que ya no existe). */
  unassignedPayments: Payment[]
  /** Dinero pagado que sobra despues de cubrir todos los periodos. */
  unallocated: number
  totalPaid: number
  totalTarget: number
  /** totalPaid - totalTarget. Negativo = atraso acumulado. */
  totalDrift: number
  /** Porcentaje global cubierto, acotado a 0..100. */
  percent: number
  /** Estado general, para el resumen y los colores. */
  status: PeriodStatus
  /** Cuantos periodos vencidos quedaron sin cubrir. */
  overduePeriods: number
  /** Suma de lo que falta en los periodos ya vencidos. */
  overdueAmount: number
}

/** Suma `count` meses conservando la semantica de `Date.prototype.setMonth`. */
export function addMonths(date: Date, count: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + count)
  return result
}

/** Convierte `YYYY-MM-DD` a una fecha local a medianoche (sin desfase UTC). */
export function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

/** Formatea una fecha local como `YYYY-MM-DD`. */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Acota un numero al rango [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** Ordena los periodos cronologicamente (no muta el arreglo). */
export function sortPeriods(periods: readonly PeriodDefinition[]): PeriodDefinition[] {
  return [...periods].sort((a, b) => {
    const byStart = a.startDate.localeCompare(b.startDate)
    return byStart !== 0 ? byStart : a.endDate.localeCompare(b.endDate)
  })
}

/**
 * Periodo que contiene esa fecha, o `null` si cae en un hueco.
 * Se usa para preseleccionar el periodo al registrar un pago.
 */
export function periodForDate(
  periods: readonly PeriodDefinition[],
  isoDate: string,
): PeriodDefinition | null {
  return (
    periods.find((period) => isoDate >= period.startDate && isoDate < period.endDate) ?? null
  )
}

/**
 * Genera periodos mensuales consecutivos. Es el atajo para no crear doce
 * periodos a mano; una vez creados, cada uno se edita por separado.
 */
export function monthlyPeriods(
  startDate: string,
  count: number,
  targetAmount: number,
): Array<{ startDate: string; endDate: string; targetAmount: number }> {
  const base = parseIsoDate(startDate)
  if (Number.isNaN(base.getTime())) return []

  const total = Math.max(0, Math.floor(count))
  return Array.from({ length: total }, (_, index) => ({
    startDate: toIsoDate(addMonths(base, index)),
    endDate: toIsoDate(addMonths(base, index + 1)),
    targetAmount,
  }))
}

function resolveStatus(
  paid: number,
  target: number,
  start: Date,
  end: Date,
  today: Date,
): { status: PeriodStatus; statusLabel: string } {
  if (target > 0 && paid >= target) {
    return { status: 'success', statusLabel: 'Pagado' }
  }
  if (end < today) {
    return { status: 'danger', statusLabel: paid > 0 ? 'Atrasado (parcial)' : 'Atrasado' }
  }
  if (start <= today) {
    return paid > 0
      ? { status: 'warning', statusLabel: 'Parcial' }
      : { status: 'info', statusLabel: 'En curso' }
  }
  return { status: 'info', statusLabel: paid > 0 ? 'Adelantado' : 'Proximo' }
}

/**
 * Calcula el estado de cada periodo a partir de sus definiciones y sus pagos.
 *
 * `today` se inyecta para que las pruebas sean deterministas.
 */
export function computeTracking(
  definitions: readonly PeriodDefinition[],
  payments: readonly Payment[],
  today: Date = new Date(),
): TrackingResult {
  const ordered = sortPeriods(definitions)
  const known = new Set(ordered.map((period) => period.id))

  // --- 1. Separar los pagos por destino ------------------------------------
  const byPeriod = new Map<string, Payment[]>()
  const unassignedPayments: Payment[] = []

  for (const payment of sortPaymentsAsc(payments)) {
    // Un periodo desconocido (por ejemplo recien borrado) se trata como dinero
    // sin asignar en vez de desaparecer de las cuentas.
    if (payment.periodId === null || !known.has(payment.periodId)) {
      unassignedPayments.push(payment)
      continue
    }
    const list = byPeriod.get(payment.periodId)
    if (list) list.push(payment)
    else byPeriod.set(payment.periodId, [payment])
  }

  let pool = sumPayments(unassignedPayments)

  // --- 2. Dinero marcado + excedente que baja de periodos anteriores --------
  interface Draft {
    definition: PeriodDefinition
    position: number
    start: Date
    end: Date
    payments: Payment[]
    assigned: number
    carryIn: number
    carryOut: number
    covered: number
    fromPool: number
  }

  let carry = 0
  const drafts: Draft[] = ordered.map((definition, position) => {
    const own = byPeriod.get(definition.id) ?? []
    const assigned = sumPayments(own)
    const carryIn = carry
    const available = assigned + carryIn
    const covered = Math.max(0, Math.min(available, definition.targetAmount))
    carry = available - covered

    return {
      definition,
      position,
      start: parseIsoDate(definition.startDate),
      end: parseIsoDate(definition.endDate),
      payments: own,
      assigned,
      carryIn,
      carryOut: carry,
      covered,
      fromPool: 0,
    }
  })

  // --- 3. El bolsillo sin asignar tapa los huecos, del mas viejo al mas nuevo
  for (const draft of drafts) {
    if (pool <= 0) break
    const gap = draft.definition.targetAmount - draft.covered
    if (gap <= 0) continue

    const take = Math.min(pool, gap)
    draft.covered += take
    draft.fromPool = take
    pool -= take
  }

  // --- 4. Estado de cada periodo -------------------------------------------
  let paidSoFar = 0
  let targetSoFar = 0
  let overduePeriods = 0
  let overdueAmount = 0

  const periods: Period[] = drafts.map((draft) => {
    const target = draft.definition.targetAmount
    paidSoFar += draft.covered
    targetSoFar += target

    const { status, statusLabel } = resolveStatus(
      draft.covered,
      target,
      draft.start,
      draft.end,
      today,
    )
    const pending = target - draft.covered
    if (status === 'danger') {
      overduePeriods += 1
      overdueAmount += pending
    }

    return {
      id: draft.definition.id,
      position: draft.position,
      start: draft.start,
      end: draft.end,
      label: draft.definition.label,
      target,
      payments: draft.payments,
      assigned: draft.assigned,
      carryIn: draft.carryIn,
      carryOut: draft.carryOut,
      fromPool: draft.fromPool,
      paid: draft.covered,
      pending,
      drift: draft.covered - target,
      cumulativeDrift: paidSoFar - targetSoFar,
      status,
      statusLabel,
      percent: target > 0 ? clamp(Math.round((draft.covered / target) * 100), 0, 100) : 0,
    }
  })

  const percent = targetSoFar > 0 ? clamp(Math.round((paidSoFar / targetSoFar) * 100), 0, 100) : 0
  const totalDrift = paidSoFar - targetSoFar

  return {
    periods,
    unassignedPayments,
    // Lo que sobro: el excedente que paso del ultimo periodo mas el bolsillo.
    unallocated: carry + pool,
    totalPaid: paidSoFar,
    totalTarget: targetSoFar,
    totalDrift,
    percent,
    status: overallStatus(totalDrift, percent, overduePeriods, periods.length),
    overduePeriods,
    overdueAmount,
  }
}

function overallStatus(
  totalDrift: number,
  percent: number,
  overduePeriods: number,
  periodCount: number,
): PeriodStatus {
  if (periodCount === 0) return 'info'
  if (percent >= 100) return 'success'
  if (overduePeriods > 0) return 'danger'
  if (totalDrift >= 0) return 'success'
  return percent >= 50 ? 'warning' : 'info'
}

/** Etiqueta corta del estado general de una persona. */
export function statusLabel(tracking: TrackingResult): string {
  if (tracking.periods.length === 0) return 'Sin periodos'
  if (tracking.percent >= 100) return 'Al dia'
  if (tracking.overduePeriods > 0) {
    return tracking.overduePeriods === 1
      ? '1 periodo atrasado'
      : `${tracking.overduePeriods} periodos atrasados`
  }
  if (tracking.totalDrift >= 0) return 'Al dia'
  return 'En curso'
}

/** Suma total de una lista de pagos. */
export function sumPayments(payments: readonly Payment[]): number {
  return payments.reduce((total, payment) => total + Number(payment.amount), 0)
}

/** Ordena los pagos del mas antiguo al mas reciente (no muta el arreglo). */
export function sortPaymentsAsc(payments: readonly Payment[]): Payment[] {
  return [...payments].sort((a, b) => {
    const byDate = a.paidOn.localeCompare(b.paidOn)
    return byDate !== 0 ? byDate : a.createdAt.localeCompare(b.createdAt)
  })
}

/** Ordena los pagos del mas reciente al mas antiguo (no muta el arreglo). */
export function sortPaymentsDesc(payments: readonly Payment[]): Payment[] {
  return sortPaymentsAsc(payments).reverse()
}

export interface GlobalSummary {
  people: number
  totalPaid: number
  totalTarget: number
  totalDrift: number
  percent: number
  peopleOverdue: number
  peopleSettled: number
  /** Suma de lo que falta en los periodos vencidos de todas las personas. */
  overdueAmount: number
}

/** Suma el seguimiento de varias personas para el resumen de la portada. */
export function summarize(trackings: readonly TrackingResult[]): GlobalSummary {
  const totalPaid = trackings.reduce((sum, t) => sum + t.totalPaid, 0)
  const totalTarget = trackings.reduce((sum, t) => sum + t.totalTarget, 0)

  return {
    people: trackings.length,
    totalPaid,
    totalTarget,
    totalDrift: totalPaid - totalTarget,
    percent: totalTarget > 0 ? clamp(Math.round((totalPaid / totalTarget) * 100), 0, 100) : 0,
    peopleOverdue: trackings.filter((t) => t.overduePeriods > 0).length,
    peopleSettled: trackings.filter((t) => t.periods.length > 0 && t.percent >= 100).length,
    overdueAmount: trackings.reduce((sum, t) => sum + t.overdueAmount, 0),
  }
}
