import { lanzarErrorBd, supabase } from '@/lib/supabase'
import type { NewPerson, Person } from '@/types/domain'
import type { Database, PersonRow } from '@/types/database'

const COLUMNS =
  'id, user_id, name, concept, notes, default_target_amount, archived, created_at, updated_at'

function toPerson(row: PersonRow): Person {
  return {
    id: row.id,
    name: row.name,
    concept: row.concept,
    notes: row.notes,
    archived: row.archived,
    defaultTargetAmount:
      row.default_target_amount === null ? null : Number(row.default_target_amount),
    createdAt: row.created_at,
  }
}

/** Normaliza lo que escribio el usuario antes de mandarlo a la base. */
function toRow(person: NewPerson) {
  const concept = person.concept?.trim()
  const notes = person.notes?.trim()
  return {
    name: person.name.trim().replace(/\s+/g, ' '),
    concept: concept ? concept : null,
    notes: notes ? notes : null,
    default_target_amount: person.defaultTargetAmount ?? null,
  }
}

export async function fetchPeople(userId: string): Promise<Person[]> {
  const { data, error } = await supabase
    .from('people')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('archived', { ascending: true })
    .order('name', { ascending: true })

  if (error) lanzarErrorBd(error)
  return (data ?? []).map(toPerson)
}

export async function insertPerson(userId: string, person: NewPerson): Promise<Person> {
  const { data, error } = await supabase
    .from('people')
    .insert({ user_id: userId, ...toRow(person) })
    .select(COLUMNS)
    .single()

  if (error) lanzarErrorBd(error)
  return toPerson(data)
}

export async function updatePerson(
  userId: string,
  personId: string,
  changes: Partial<NewPerson> & { archived?: boolean },
): Promise<Person> {
  const patch: Database['public']['Tables']['people']['Update'] = {}

  if (changes.name !== undefined) patch.name = changes.name.trim().replace(/\s+/g, ' ')
  if (changes.concept !== undefined) patch.concept = changes.concept?.trim() || null
  if (changes.notes !== undefined) patch.notes = changes.notes?.trim() || null
  if (changes.defaultTargetAmount !== undefined) {
    patch.default_target_amount = changes.defaultTargetAmount
  }
  if (changes.archived !== undefined) patch.archived = changes.archived

  const { data, error } = await supabase
    .from('people')
    .update(patch)
    .eq('id', personId)
    .eq('user_id', userId)
    .select(COLUMNS)
    .single()

  if (error) lanzarErrorBd(error)
  return toPerson(data)
}

/** Borra la persona; sus periodos y pagos caen con ella por la cascada. */
export async function deletePerson(userId: string, personId: string): Promise<void> {
  const { error } = await supabase
    .from('people')
    .delete()
    .eq('id', personId)
    .eq('user_id', userId)

  if (error) lanzarErrorBd(error)
}
