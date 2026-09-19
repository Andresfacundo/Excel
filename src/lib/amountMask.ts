/**
 * Separacion de miles para los campos de monto.
 *
 * La idea es que el dominio no se entere de nada: el estado del formulario
 * sigue guardando el numero crudo (`2508000`), que es lo que validan las reglas
 * de `validation.ts` y lo que viaja a la base. La mascara vive solo en lo que se
 * pinta (`2.508.000`), asi que `Number(values.amount)` sigue funcionando igual.
 *
 * Convencion colombiana, la misma que usa `money()`:
 *   - el punto agrupa los miles;
 *   - la coma separa los decimales.
 * Por eso al leer lo que el usuario escribio el punto se ignora siempre: si lo
 * tratara como decimal, `2.508` significaria dos pesos con medio y nadie que
 * escriba pesos espera eso.
 */

/** Numero crudo: digitos, y como mucho un punto decimal. */
const RAW = /^\d*(\.\d*)?$/

/** Tope de digitos enteros, muy por encima de `LIMITS.maxAmount`. */
const MAX_INTEGER_DIGITS = 15

/** Decimales que se aceptan al escribir; el resto se descarta en el momento. */
const MAX_DECIMALS = 2

/**
 * Lee lo que hay en pantalla y devuelve el numero crudo.
 * `'2.508.000,50'` -> `'2508000.5'`, `'abc'` -> `''`.
 */
export function unmaskAmount(input: string): string {
  let integer = ''
  let decimals: string | null = null

  for (const char of input) {
    if (char >= '0' && char <= '9') {
      if (decimals === null) {
        if (integer.length < MAX_INTEGER_DIGITS) integer += char
      } else if (decimals.length < MAX_DECIMALS) {
        decimals += char
      }
    } else if (char === ',' && decimals === null) {
      decimals = ''
    }
    // El punto (y cualquier otro caracter) se ignora: solo agrupa.
  }

  integer = integer.replace(/^0+(?=\d)/, '')

  if (decimals === null) return integer
  if (integer === '') integer = '0'
  return `${integer}.${decimals}`
}

/**
 * Pinta el numero crudo con separacion de miles.
 * `'2508000'` -> `'2.508.000'`, `'2508000.5'` -> `'2.508.000,5'`.
 */
export function maskAmount(raw: string): string {
  if (raw === '') return ''
  if (!RAW.test(raw)) return raw

  const dot = raw.indexOf('.')
  const integer = dot === -1 ? raw : raw.slice(0, dot)
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  return dot === -1 ? grouped : `${grouped},${raw.slice(dot + 1)}`
}

/**
 * Cuantos caracteres significativos (digitos y la coma decimal) hay en un
 * texto. Los puntos no cuentan porque los pone la mascara, no el usuario.
 */
function countSignificant(text: string): number {
  let count = 0
  for (const char of text) {
    if ((char >= '0' && char <= '9') || char === ',') count += 1
  }
  return count
}

/**
 * Posicion del cursor dentro del texto ya enmascarado, tras haber dejado atras
 * `significant` caracteres significativos.
 *
 * Sin esto, reescribir el valor en cada tecla manda el cursor al final y editar
 * un monto por la mitad se vuelve imposible.
 */
export function caretAfterMask(masked: string, significant: number): number {
  if (significant <= 0) {
    // Antes del primer digito, pero despues de los puntos que lo preceden.
    let index = 0
    while (index < masked.length && masked[index] === '.') index += 1
    return index
  }

  let seen = 0
  for (let index = 0; index < masked.length; index += 1) {
    const char = masked[index]
    if (char === undefined) break
    if ((char >= '0' && char <= '9') || char === ',') {
      seen += 1
      if (seen === significant) return index + 1
    }
  }
  return masked.length
}

/**
 * Traduce la posicion del cursor en lo que el usuario acaba de escribir a la
 * posicion equivalente en el texto ya enmascarado.
 */
export function nextCaretPosition(typed: string, selection: number, masked: string): number {
  return caretAfterMask(masked, countSignificant(typed.slice(0, selection)))
}
