import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, traducirErrorAuth } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    let active = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session)
      })
      .finally(() => {
        if (active) setInitializing(false)
      })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      // Al cambiar de cuenta (o cerrar sesion) la cache del usuario anterior
      // ya no es valida.
      if (event === 'SIGNED_OUT') {
        queryClient.clear()
      }
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) throw new Error(traducirErrorAuth(error.message))
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) throw new Error(traducirErrorAuth(error.message))
    return { needsConfirmation: data.session === null }
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(traducirErrorAuth(error.message))
    queryClient.clear()
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      initializing,
      signIn,
      signUp,
      signOut,
    }),
    [session, initializing, signIn, signUp, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
