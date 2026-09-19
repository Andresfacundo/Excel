import { lanzarErrorBd, supabase } from '@/lib/supabase'
import { EMPTY_ISSUER } from '@/types/domain'
import type { IssuerSettings } from '@/types/domain'
import type { IssuerSettingsRow } from '@/types/database'

const COLUMNS = 'user_id, display_name, phone, email, note, created_at, updated_at'

function toIssuer(row: IssuerSettingsRow): IssuerSettings {
  return {
    displayName: row.display_name,
    phone: row.phone,
    email: row.email,
    note: row.note,
  }
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/** Datos del emisor. Si nunca se configuraron, devuelve todo vacio. */
export async function fetchIssuerSettings(userId: string): Promise<IssuerSettings> {
  const { data, error } = await supabase
    .from('issuer_settings')
    .select(COLUMNS)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) lanzarErrorBd(error)
  return data ? toIssuer(data) : EMPTY_ISSUER
}

export async function saveIssuerSettings(
  userId: string,
  settings: IssuerSettings,
): Promise<IssuerSettings> {
  const { data, error } = await supabase
    .from('issuer_settings')
    .upsert(
      {
        user_id: userId,
        display_name: clean(settings.displayName),
        phone: clean(settings.phone),
        email: clean(settings.email),
        note: clean(settings.note),
      },
      { onConflict: 'user_id' },
    )
    .select(COLUMNS)
    .single()

  if (error) lanzarErrorBd(error)
  return toIssuer(data)
}
