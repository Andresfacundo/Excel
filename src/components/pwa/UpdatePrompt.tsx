import { useRegisterSW } from 'virtual:pwa-register/react'
import styles from './UpdatePrompt.module.css'

/**
 * Avisos del service worker: app lista para funcionar sin conexion y
 * disponibilidad de una version nueva.
 */
export function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!offlineReady && !needRefresh) return null

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  return (
    <div className={styles.bar} role="status" aria-live="polite">
      <span className={styles.text}>
        {needRefresh ? 'Hay una version nueva disponible.' : 'La app ya funciona sin conexion.'}
      </span>

      {needRefresh && (
        <button type="button" className={styles.action} onClick={() => void updateServiceWorker(true)}>
          Actualizar
        </button>
      )}

      <button type="button" className={styles.dismiss} onClick={close} aria-label="Cerrar aviso">
        &times;
      </button>
    </div>
  )
}
