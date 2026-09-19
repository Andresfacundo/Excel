import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

/**
 * Cache de datos de la app.
 *
 * `gcTime` largo + persistencia en localStorage = la PWA abre con los ultimos
 * datos conocidos aunque no haya red, igual que hacia el localStorage del
 * proyecto original, pero sin duplicar la fuente de verdad.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24 * 14, // 14 dias
      retry: 2,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 1,
      // Las mutaciones sin red quedan en pausa y se reenvian al reconectar.
      networkMode: 'offlineFirst',
    },
  },
})

export const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'pago-wilfer-cache',
  throttleTime: 1000,
})
