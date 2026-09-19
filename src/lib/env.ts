/**
 * Lectura y validacion de las variables de entorno del cliente.
 *
 * Se valida al arrancar para fallar con un mensaje claro en vez de con un
 * `undefined` en mitad de una peticion.
 */

interface Env {
  supabaseUrl: string
  supabasePublishableKey: string
}

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '' || value.includes('TU_PROJECT_REF')) {
    throw new Error(
      `Falta la variable de entorno ${name}. Copia .env.example a .env y completa los valores de tu proyecto Supabase.`,
    )
  }
  return value.trim()
}

export const env: Env = {
  supabaseUrl: required('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL),
  supabasePublishableKey: required(
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  ),
}
