import { useSyncExternalStore } from 'react'
import { onlineManager } from '@tanstack/react-query'

/** `true` cuando el navegador cree tener conexion. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    (listener) => onlineManager.subscribe(listener),
    () => onlineManager.isOnline(),
    () => true,
  )
}
