import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected'

/**
 * Sustituye al `onSnapshot` de Firestore: escucha los cambios de las filas del
 * usuario y marca como obsoletas las consultas afectadas, de modo que otro
 * dispositivo vea el pago nuevo sin recargar.
 */
export function useRealtimeSync(userId: string | undefined): RealtimeStatus {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<RealtimeStatus>('connecting')

  useEffect(() => {
    if (!userId) {
      setStatus('disconnected')
      return
    }

    setStatus('connecting')
    const filter = `user_id=eq.${userId}`

    const channel = supabase
      .channel(`seguimiento-pagos:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'people', filter }, () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.people(userId) })
        // Borrar una persona arrastra sus periodos y pagos por cascada.
        void queryClient.invalidateQueries({ queryKey: queryKeys.periods(userId) })
        void queryClient.invalidateQueries({ queryKey: queryKeys.payments(userId) })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'periods', filter }, () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.periods(userId) })
        // Borrar un periodo deja sus pagos sin asignar.
        void queryClient.invalidateQueries({ queryKey: queryKeys.payments(userId) })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter }, () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.payments(userId) })
      })
      .subscribe((channelStatus) => {
        if (channelStatus === 'SUBSCRIBED') setStatus('connected')
        else if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT') {
          setStatus('disconnected')
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, queryClient])

  return status
}
