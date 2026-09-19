import type { ReactNode } from 'react'
import { useIsMutating } from '@tanstack/react-query'
import { AppHeader } from '@/components/layout/AppHeader'
import { useAuth } from '@/features/auth/useAuth'
import { useRealtimeSync } from '@/features/sync/useRealtimeSync'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

interface AppLayoutProps {
  title: string
  subtitle: string
  showBack?: boolean
  children: ReactNode
}

/** Cabecera comun + contenedor central. El estado de sincronizacion vive aqui. */
export function AppLayout({ title, subtitle, showBack = false, children }: AppLayoutProps) {
  const { user, signOut } = useAuth()
  const online = useOnlineStatus()
  const realtime = useRealtimeSync(user?.id)
  const pendingMutations = useIsMutating()

  return (
    <>
      <AppHeader
        title={title}
        subtitle={subtitle}
        email={user?.email ?? null}
        online={online}
        realtime={realtime}
        pendingMutations={pendingMutations}
        onSignOut={() => void signOut()}
        showBack={showBack}
      />
      <main className="wrap">{children}</main>
    </>
  )
}
