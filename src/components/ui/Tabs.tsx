import { useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { cx } from '@/lib/cx'
import styles from './ui.module.css'

export interface TabItem<T extends string> {
  id: T
  label: string
  /** Numero pequeno a la derecha de la etiqueta (pagos, periodos...). */
  count?: number
  /** Pinta el contador en rojo: hay algo que mirar en esa pestana. */
  alert?: boolean
}

interface TabsProps<T extends string> {
  items: Array<TabItem<T>>
  active: T
  onChange: (id: T) => void
  label: string
}

/**
 * Pestanas con el patron de accesibilidad estandar: una sola parada de
 * tabulacion y flechas para moverse entre ellas.
 */
export function Tabs<T extends string>({ items, active, onChange, label }: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null)

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (offset === 0) return
    event.preventDefault()

    const index = items.findIndex((item) => item.id === active)
    const next = items[(index + offset + items.length) % items.length]
    if (!next) return

    onChange(next.id)
    listRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${next.id}"]`)?.focus()
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      className={styles.tabs}
      onKeyDown={handleKeyDown}
    >
      {items.map((item) => {
        const selected = item.id === active
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            data-tab={item.id}
            id={`tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            className={cx(styles.tab, selected && styles.tabActive)}
            onClick={() => onChange(item.id)}
          >
            {item.label}
            {item.count !== undefined && item.count > 0 && (
              <span className={cx(styles.tabCount, item.alert && styles.tabCountAlert)}>
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} tabIndex={-1}>
      {children}
    </div>
  )
}
