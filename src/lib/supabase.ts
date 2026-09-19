import { createClient } from '@supabase/supabase-js'
import type { PostgrestError } from '@supabase/supabase-js'
import { env } from './env'
import type { Database } from '@/types/database'

/**
 * Cliente unico y tipado de Supabase.
 *
 * La sesion se guarda en localStorage y se refresca sola, de modo que la PWA
 * sigue autenticada aunque se abra sin conexion.
 */
export const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'seguimiento-pagos-auth',
  },
  realtime: {
    params: { eventsPerSecond: 5 },
  },
})

/** Traduce los errores mas comunes de Supabase Auth al espanol. */
export function traducirErrorAuth(message: string): string {
  const mapa: Record<string, string> = {
    'Invalid login credentials': 'Correo o contrasena incorrectos.',
    'Email not confirmed': 'Debes confirmar tu correo antes de iniciar sesion.',
    'User already registered': 'Ese correo ya tiene una cuenta. Inicia sesion.',
    'Password should be at least 6 characters': 'La contrasena debe tener al menos 6 caracteres.',
    'Failed to fetch': 'Sin conexion con el servidor. Revisa tu internet.',
    'For security purposes, you can only request this after 60 seconds.':
      'Espera un minuto antes de volver a intentarlo.',
  }
  return mapa[message] ?? message
}

/**
 * Convierte un error de Postgres en un mensaje util.
 *
 * Los CHECK y UNIQUE de la base son la ultima linea de defensa; si alguno salta
 * es porque el cliente dejo pasar algo, y el usuario merece saber que fue.
 */
export function traducirErrorBd(error: PostgrestError | Error): string {
  if (!('code' in error)) {
    return error.message === 'Failed to fetch'
      ? 'Sin conexion con el servidor. El cambio se guardara al reconectar.'
      : error.message
  }

  switch (error.code) {
    case '23505':
      return error.message.includes('people_user_id_name_key')
        ? 'Ya tienes una persona registrada con ese nombre.'
        : 'Ese registro ya existe.'
    case '23503':
      return 'La persona asociada ya no existe. Recarga la pagina.'
    case '23514':
      return 'Alguno de los valores esta fuera de los limites permitidos.'
    case '22003':
      return 'El numero es demasiado grande.'
    case '42501':
      return 'No tienes permiso para hacer ese cambio.'
    case 'PGRST116':
      return 'No se encontro el registro.'
    default:
      return error.message
  }
}

/** Lanza un `Error` con el mensaje ya traducido. */
export function lanzarErrorBd(error: PostgrestError): never {
  throw new Error(traducirErrorBd(error))
}
