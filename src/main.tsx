import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { persister, queryClient } from '@/lib/queryClient'
import { registerMutationDefaults } from '@/lib/mutationDefaults'
import { App } from '@/app/App'
import '@/styles/global.css'

// Las mutaciones deben estar registradas antes de rehidratar la cache, para que
// los cambios que quedaron pendientes sin conexion se puedan reenviar.
registerMutationDefaults()

const container = document.getElementById('root')
if (!container) {
  throw new Error('No se encontro el contenedor #root en index.html')
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 1000 * 60 * 60 * 24 * 14,
          buster: 'v2',
        }}
        onSuccess={() => {
          void queryClient.resumePausedMutations()
        }}
      >
        <AuthProvider>
          <App />
        </AuthProvider>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
