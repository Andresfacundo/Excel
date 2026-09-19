import type { ButtonHTMLAttributes } from 'react'
import { cx } from '@/lib/cx'
import styles from './ui.module.css'

type Variant = 'primary' | 'danger' | 'ghost'

const variantClass: Record<Variant, string | undefined> = {
  primary: styles.primary,
  danger: styles.danger,
  ghost: styles.ghost,
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(styles.button, variantClass[variant], className)}
    >
      {loading ? 'Guardando...' : children}
    </button>
  )
}
