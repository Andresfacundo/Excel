import { formatPeriodRange } from '@/lib/format'
import type { SelectOption } from '@/components/ui/Select'
import type { Period } from './domain'

/** Valor del `<select>` que representa "sin asignar". */
export const UNASSIGNED = ''

export const UNASSIGNED_OPTION: SelectOption = {
  value: UNASSIGNED,
  label: 'Sin asignar (tapa lo mas atrasado)',
}

/** Nombre legible de un periodo: su etiqueta si tiene, o su posicion. */
export function periodName(period: Period): string {
  return period.label?.trim() ? period.label : `Periodo ${period.position + 1}`
}

/** Opciones de periodo para un `<select>`, con "sin asignar" de primera. */
export function buildPeriodOptions(periods: readonly Period[]): SelectOption[] {
  return [
    UNASSIGNED_OPTION,
    ...periods.map((period) => ({
      value: period.id,
      label: `${periodName(period)} · ${formatPeriodRange(period.start, period.end)}`,
    })),
  ]
}

/** Convierte el valor del `<select>` al `periodId` del dominio. */
export function toPeriodId(value: string): string | null {
  return value === UNASSIGNED ? null : value
}

/** Convierte el `periodId` del dominio al valor del `<select>`. */
export function toSelectValue(periodId: string | null): string {
  return periodId ?? UNASSIGNED
}
