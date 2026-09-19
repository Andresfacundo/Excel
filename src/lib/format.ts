/** Formateo de montos y fechas en convencion colombiana (es-CO). */

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 0,
})

const periodDateFormatter = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  year: '2-digit',
})

const longDateFormatter = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})

/** `$ 2.508.000` / `-$ 12.000`. Redondea a pesos enteros. */
export function money(value: number): string {
  const sign = value < 0 ? '-$ ' : '$ '
  return sign + currencyFormatter.format(Math.round(Math.abs(value)))
}

/** `21 jul 26` */
export function formatPeriodDate(date: Date): string {
  return periodDateFormatter.format(date)
}

/** `21 de julio de 2026` a partir de un `YYYY-MM-DD`. */
export function formatIsoDate(value: string): string {
  return longDateFormatter.format(new Date(`${value}T00:00:00`))
}

/** `21 jul 26 - 21 ago 26` */
export function formatPeriodRange(start: Date, end: Date): string {
  return `${formatPeriodDate(start)} - ${formatPeriodDate(end)}`
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/**
 * Rango corto para donde el espacio manda: `21 jul - 21 ago 26`.
 *
 * `formatPeriodRange` pasa por `Intl`, que en es-CO mete "de" entre cada parte
 * ("21 de jul de 26") y deja un rango de 31 caracteres. Dentro de un `<select>`
 * en un celular eso se corta a media fecha, asi que aqui se arma a mano. El
 * ano solo se repite cuando el periodo cruza de un ano al siguiente.
 */
export function formatCompactRange(start: Date, end: Date): string {
  const day = (date: Date) => `${date.getDate()} ${MESES[date.getMonth()] ?? ''}`
  const year = (date: Date) => String(date.getFullYear()).slice(2)

  return start.getFullYear() === end.getFullYear()
    ? `${day(start)} - ${day(end)} ${year(end)}`
    : `${day(start)} ${year(start)} - ${day(end)} ${year(end)}`
}

/** Fecha de hoy como `YYYY-MM-DD` en la zona horaria local. */
export function todayIso(): string {
  const now = new Date()
  const offsetMs = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10)
}
