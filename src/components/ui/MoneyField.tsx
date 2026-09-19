import { useLayoutEffect, useRef } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { maskAmount, nextCaretPosition, unmaskAmount } from '@/lib/amountMask'
import { TextField } from './TextField'

interface MoneyFieldProps {
  label: string
  /** Numero crudo, sin puntos: `2508000`. Es lo que guarda el formulario. */
  value: string | undefined
  /** Recibe el numero crudo, con la misma forma que un `<input>` normal. */
  onChange: (event: { target: { value: string } }) => void
  onBlur?: () => void
  error?: string | undefined
  help?: ReactNode
  /** Placeholder sin `$` ni puntos: se enmascara solo. */
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
}

/**
 * Campo de monto con separacion de miles mientras se escribe.
 *
 * Es un `<input type="text">` y no un `type="number"` a proposito: los
 * navegadores no dejan meter puntos de miles en un campo numerico. A cambio se
 * pone `inputMode="decimal"`, que en el celular abre el mismo teclado de
 * numeros, e `enterKeyHint` para que la tecla de envio diga lo que hace.
 *
 * Hacia afuera se comporta igual que `TextField`: entra y sale el numero crudo,
 * asi que `form.fieldProps('amount')` encaja tal cual y ni los validadores ni
 * el dominio cambian.
 */
export function MoneyField({
  label,
  value,
  onChange,
  onBlur,
  error,
  help,
  placeholder,
  disabled,
  autoFocus,
}: MoneyFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)

  // El valor se reescribe en cada tecla, asi que hay que devolver el cursor a
  // donde estaba antes de que el navegador lo mande al final.
  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input || caret.current === null) return
    const position = caret.current
    caret.current = null
    input.setSelectionRange(position, position)
  })

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const typed = event.target.value
    const selection = event.target.selectionStart ?? typed.length
    const raw = unmaskAmount(typed)
    caret.current = nextCaretPosition(typed, selection, maskAmount(raw))
    onChange({ target: { value: raw } })
  }

  return (
    <TextField
      label={label}
      type="text"
      inputMode="decimal"
      enterKeyHint="done"
      autoComplete="off"
      prefix="$"
      inputRef={inputRef}
      value={maskAmount(value ?? '')}
      onChange={handleChange}
      {...(onBlur ? { onBlur } : {})}
      error={error}
      help={help}
      placeholder={placeholder === undefined ? undefined : maskAmount(placeholder)}
      disabled={disabled}
      autoFocus={autoFocus}
    />
  )
}
