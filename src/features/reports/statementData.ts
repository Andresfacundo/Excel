/**
 * Preparacion de los datos del estado de cuenta.
 *
 * Modulo puro: arma las filas y los totales que van al PDF sin saber nada de
 * jsPDF. Asi la parte que importa —las cifras— se puede probar sin generar un
 * PDF de verdad.
 */

import { formatIsoDate, formatPeriodDate, formatPeriodRange, money } from '@/lib/format'
import { sortPaymentsDesc, sumPayments } from '@/features/tracking/domain'
import type { Period, TrackingResult } from '@/features/tracking/domain'
import { periodName } from '@/features/tracking/periodOptions'
import type { IssuerSettings, Payment, Person, Receipt } from '@/types/domain'

export interface StatementTotals {
  objetivo: string
  pagado: string
  pendiente: string
  vencido: string
  avance: string
  saldoAFavor: string | null
}

export interface StatementInput {
  person: Person
  issuer: IssuerSettings
  tracking: TrackingResult
  payments: Payment[]
  receiptsByPayment: Map<string, Receipt[]>
  generatedAt: Date
}

export interface StatementModel {
  title: string
  issuerLines: string[]
  clientLines: string[]
  generatedLabel: string
  totals: StatementTotals
  periodRows: string[][]
  paymentRows: string[][]
  /** Comprobantes en orden, con la etiqueta del pago al que pertenecen. */
  receipts: Array<{ receipt: Receipt; caption: string }>
  paymentsWithoutReceipt: number
  footerNote: string
}

const PERIOD_HEADERS = ['Periodo', 'Desde', 'Hasta', 'Objetivo', 'Cubierto', 'Falta', 'Estado']
const PAYMENT_HEADERS = ['Fecha', 'Monto', 'Abonado a', 'Nota', 'Soporte']

export function periodTableHeaders(): string[] {
  return [...PERIOD_HEADERS]
}

export function paymentTableHeaders(): string[] {
  return [...PAYMENT_HEADERS]
}

function periodRow(period: Period): string[] {
  return [
    periodName(period),
    // Fecha corta: en la tabla del PDF el formato largo parte los montos en dos
    // lineas por falta de ancho.
    formatPeriodDate(period.start),
    formatPeriodDate(period.end),
    money(period.target),
    money(period.paid),
    period.pending > 0 ? money(period.pending) : '-',
    period.statusLabel,
  ]
}

function toIso(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Arma todo lo que el PDF necesita mostrar. */
export function buildStatement(input: StatementInput): StatementModel {
  const { person, issuer, tracking, payments, receiptsByPayment, generatedAt } = input

  const periodById = new Map(tracking.periods.map((period) => [period.id, period]))
  const ordered = sortPaymentsDesc(payments)

  const issuerLines = [issuer.displayName, issuer.phone, issuer.email, issuer.note].filter(
    (line): line is string => Boolean(line && line.trim()),
  )

  const clientLines = [person.name, person.concept].filter((line): line is string =>
    Boolean(line && line.trim()),
  )

  const pendiente = Math.max(0, tracking.totalTarget - tracking.totalPaid)

  const receipts: StatementModel['receipts'] = []
  let paymentsWithoutReceipt = 0

  const paymentRows = ordered.map((payment) => {
    const attached = receiptsByPayment.get(payment.id) ?? []
    if (attached.length === 0) paymentsWithoutReceipt += 1

    const period = payment.periodId ? periodById.get(payment.periodId) : undefined
    for (const receipt of attached) {
      receipts.push({
        receipt,
        caption: `${formatIsoDate(payment.paidOn)} · ${money(payment.amount)} · ${receipt.fileName}`,
      })
    }

    return [
      formatIsoDate(payment.paidOn),
      money(payment.amount),
      period ? periodName(period) : 'Sin asignar',
      payment.note ?? '-',
      attached.length === 0 ? 'Sin soporte' : `${attached.length} archivo(s)`,
    ]
  })

  return {
    title: 'Estado de cuenta',
    issuerLines,
    clientLines,
    generatedLabel: `Generado el ${generatedAt.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })} a las ${generatedAt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`,
    totals: {
      objetivo: money(tracking.totalTarget),
      pagado: money(tracking.totalPaid),
      pendiente: money(pendiente),
      vencido: money(tracking.overdueAmount),
      avance: `${tracking.percent}%`,
      saldoAFavor: tracking.unallocated > 0 ? money(tracking.unallocated) : null,
    },
    periodRows: tracking.periods.map(periodRow),
    paymentRows,
    receipts,
    paymentsWithoutReceipt,
    footerNote:
      `Documento informativo generado por Seguimiento de Pagos. ` +
      `Total recibido: ${money(sumPayments(payments))} en ${payments.length} pago(s).`,
  }
}

/** Nombre de archivo sugerido: sin acentos ni espacios. */
export function statementFileName(person: Person, generatedAt: Date): string {
  const slug = person.name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return `estado-de-cuenta-${slug || 'cliente'}-${toIso(generatedAt)}.pdf`
}

/** Rangos de periodo legibles, para el encabezado del anexo. */
export function periodRangeLabel(period: Period): string {
  return formatPeriodRange(period.start, period.end)
}
