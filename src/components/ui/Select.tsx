import { useId } from 'react'
import type { SelectHTMLAttributes } from 'react'
import { cx } from '@/lib/cx'
import styles from './ui.module.css'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'children'> {
  label: string
  options: SelectOption[]
  error?: string | undefined
  help?: string
  /** Oculta visualmente la etiqueta sin quitarla de los lectores de pantalla. */
  hideLabel?: boolean
}

export function Select({
  label,
  options,
  error,
  help,
  hideLabel = false,
  className,
  ...rest
}: SelectProps) {
  const id = useId()
  const errorId = `${id}-error`
  const helpId = `${id}-help`

  return (
    <div>
      <label className={cx(styles.label, hideLabel && 'visually-hidden')} htmlFor={id}>
        {label}
      </label>
      <select
        {...rest}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : help ? helpId : undefined}
        className={cx(styles.input, styles.select, error && styles.inputInvalid, className)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p className={styles.hint} id={errorId} role="alert">
          {error}
        </p>
      ) : help ? (
        <p className={styles.help} id={helpId}>
          {help}
        </p>
      ) : null}
    </div>
  )
}
