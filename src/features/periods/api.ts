import { lanzarErrorBd, supabase } from '@/lib/supabase'
import type { NewPeriod, PeriodDefinition } from '@/types/domain'
import type { Database, PeriodRow } from '@/types/database'

const COLUMNS = 'id, user_id, person_id, start_date, end_date, target_amount, label, created_at, updated_at'

function toPeriod(row: PeriodRow): PeriodDefinition {
  return {
    id: row.id,
    personId: row.person_id,
    startDate: row.start_date,
    endDate: row.end_date,
    targetAmount: Number(row.target_amount),
    label: row.label,
  }
}

function toRow(userId: string, period: NewPeriod) {
  const label = period.label?.trim()
  return {
    user_id: userId,
    person_id: period.personId,
    start_date: period.startDate,
    end_date: period.endDate,
    target_amount: period.targetAmount,
    label: label ? label : null,
  }
}

/** Todos los periodos del usuario, de todas sus personas. */
export async function fetchPeriods(userId: string): Promise<PeriodDefinition[]> {
  const { data, error } = await supabase
    .from('periods')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('start_date', { ascending: true })

  if (error) lanzarErrorBd(error)
  return (data ?? []).map(toPeriod)
}

export async function insertPeriod(userId: string, period: NewPeriod): Promise<PeriodDefinition> {
  const { data, error } = await supabase
    .from('periods')
    .insert(toRow(userId, period))
    .select(COLUMNS)
    .single()

  if (error) lanzarErrorBd(error)
  return toPeriod(data)
}

/** Alta en bloque, para el generador de periodos mensuales. */
export async function insertPeriods(
  userId: string,
  periods: NewPeriod[],
): Promise<PeriodDefinition[]> {
  if (periods.length === 0) return []

  const { data, error } = await supabase
    .from('periods')
    .insert(periods.map((period) => toRow(userId, period)))
    .select(COLUMNS)

  if (error) lanzarErrorBd(error)
  return (data ?? []).map(toPeriod)
}

export async function updatePeriod(
  userId: string,
  periodId: string,
  changes: Partial<Omit<NewPeriod, 'personId'>>,
): Promise<PeriodDefinition> {
  const patch: Database['public']['Tables']['periods']['Update'] = {}
  if (changes.startDate !== undefined) patch.start_date = changes.startDate
  if (changes.endDate !== undefined) patch.end_date = changes.endDate
  if (changes.targetAmount !== undefined) patch.target_amount = changes.targetAmount
  if (changes.label !== undefined) patch.label = changes.label?.trim() || null

  const { data, error } = await supabase
    .from('periods')
    .update(patch)
    .eq('id', periodId)
    .eq('user_id', userId)
    .select(COLUMNS)
    .single()

  if (error) lanzarErrorBd(error)
  return toPeriod(data)
}

/** Borra el periodo; sus pagos quedan sin asignar, no se pierden. */
export async function deletePeriod(userId: string, periodId: string): Promise<void> {
  const { error } = await supabase
    .from('periods')
    .delete()
    .eq('id', periodId)
    .eq('user_id', userId)

  if (error) lanzarErrorBd(error)
}
