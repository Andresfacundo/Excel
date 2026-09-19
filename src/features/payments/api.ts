import { lanzarErrorBd, supabase } from '@/lib/supabase'
import type { NewPayment, Payment } from '@/types/domain'
import type { PaymentRow } from '@/types/database'

const COLUMNS =
  'id, user_id, person_id, paid_on, amount, note, period_id, created_at, updated_at'

function toPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    personId: row.person_id,
    paidOn: row.paid_on,
    amount: Number(row.amount),
    note: row.note,
    periodId: row.period_id,
    createdAt: row.created_at,
  }
}

function toRow(userId: string, payment: NewPayment) {
  const note = payment.note?.trim()
  return {
    user_id: userId,
    person_id: payment.personId,
    paid_on: payment.paidOn,
    amount: payment.amount,
    note: note ? note : null,
    period_id: payment.periodId ?? null,
  }
}

/**
 * Trae todos los pagos del usuario de una vez.
 *
 * Son pocos registros y asi la portada puede calcular el resumen de todas las
 * personas sin una consulta por persona, y la cache offline queda completa.
 */
export async function fetchPayments(userId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('paid_on', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) lanzarErrorBd(error)
  return (data ?? []).map(toPayment)
}

export async function insertPayment(userId: string, payment: NewPayment): Promise<Payment> {
  const { data, error } = await supabase
    .from('payments')
    .insert(toRow(userId, payment))
    .select(COLUMNS)
    .single()

  if (error) lanzarErrorBd(error)
  return toPayment(data)
}

export async function insertPayments(userId: string, payments: NewPayment[]): Promise<Payment[]> {
  if (payments.length === 0) return []

  const { data, error } = await supabase
    .from('payments')
    .insert(payments.map((payment) => toRow(userId, payment)))
    .select(COLUMNS)

  if (error) lanzarErrorBd(error)
  return (data ?? []).map(toPayment)
}

/** Reasigna un pago a otro periodo, o lo deja sin asignar con `null`. */
export async function updatePaymentPeriod(
  userId: string,
  id: string,
  periodId: string | null,
): Promise<Payment> {
  const { data, error } = await supabase
    .from('payments')
    .update({ period_id: periodId })
    .eq('id', id)
    .eq('user_id', userId)
    .select(COLUMNS)
    .single()

  if (error) lanzarErrorBd(error)
  return toPayment(data)
}

export async function deletePayment(userId: string, id: string): Promise<void> {
  const { error } = await supabase.from('payments').delete().eq('id', id).eq('user_id', userId)
  if (error) lanzarErrorBd(error)
}
