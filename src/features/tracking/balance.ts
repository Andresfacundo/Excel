import { money } from '@/lib/format'

/**
 * "Desface acumulado: -$120.000" no le dice nada a nadie. La misma cifra
 * contada como va la cuenta si lo dice.
 */
export function balanceText(drift: number): string {
  if (Math.round(drift) === 0) return 'Va exacto con lo acordado'
  return drift > 0
    ? `Va ${money(drift)} adelantado`
    : `Va ${money(Math.abs(drift))} por debajo de lo acordado`
}
