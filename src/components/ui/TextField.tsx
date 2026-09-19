import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode, Ref, TextareaHTMLAttributes } from 'react'
import { cx } from '@/lib/cx'
import styles from './ui.module.css'

interface CommonProps {
  label: string
  error?: string | undefined
  /** Texto de ayuda bajo el campo, cuando no hay error. */
  help?: ReactNode
  /** Muestra "usados/maximo" para campos con limite de caracteres. */
  maxLength?: number
  showCounter?: boolean
}

type TextAreaProps = CommonProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>

type TextFieldProps = CommonProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
    /** Simbolo fijo dentro del campo, como el `$` de los montos. */
    prefix?: string
    inputRef?: Ref<HTMLInputElement>
  }

export function TextField({
  label,
  error,
  help,
  showCounter = false,
  prefix,
  inputRef,
  className,
  value,
  ...rest
}: TextFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const helpId = `${id}-help`
  const length = typeof value === 'string' ? value.length : 0
  const max = rest.maxLength

  const input = (
    <input
      {...rest}
      ref={inputRef}
      value={value}
      id={id}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : help ? helpId : undefined}
      className={cx(styles.input, prefix && styles.inputPrefixed, error && styles.inputInvalid, className)}
    />
  )

  return (
    <div>
      <label className={styles.label} htmlFor={id}>
        {label}
        {showCounter && max !== undefined && (
          <span className={cx(styles.counter, length > max && styles.counterOver)}>
            {length}/{max}
          </span>
        )}
      </label>
      {prefix ? (
        <div className={styles.prefixWrap}>
          <span className={styles.prefix} aria-hidden="true">
            {prefix}
          </span>
          {input}
        </div>
      ) : (
        input
      )}
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

export function TextArea({
  label,
  error,
  help,
  showCounter = true,
  className,
  value,
  ...rest
}: TextAreaProps) {
  const id = useId()
  const errorId = `${id}-error`
  const helpId = `${id}-help`
  const length = typeof value === 'string' ? value.length : 0
  const max = rest.maxLength

  return (
    <div>
      <label className={styles.label} htmlFor={id}>
        {label}
        {showCounter && max !== undefined && (
          <span className={cx(styles.counter, length > max && styles.counterOver)}>
            {length}/{max}
          </span>
        )}
      </label>
      <textarea
        {...rest}
        value={value}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : help ? helpId : undefined}
        className={cx(styles.input, styles.textarea, error && styles.inputInvalid, className)}
      />
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
