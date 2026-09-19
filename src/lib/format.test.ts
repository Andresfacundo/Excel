import { describe, expect, it } from 'vitest'
import { formatCompactRange, formatPeriodRange, money } from './format'

const fecha = (iso: string) => new Date(`${iso}T00:00:00`)

describe('money', () => {
  it('usa punto de miles y antepone el signo', () => {
    expect(money(2_508_000)).toBe('$ 2.508.000')
    expect(money(-12_000)).toBe('-$ 12.000')
    expect(money(0)).toBe('$ 0')
  })

  it('redondea a pesos enteros', () => {
    expect(money(1500.6)).toBe('$ 1.501')
  })
})

describe('formatCompactRange', () => {
  it('escribe el ano una sola vez cuando el periodo no lo cruza', () => {
    expect(formatCompactRange(fecha('2026-07-21'), fecha('2026-08-21'))).toBe('21 jul - 21 ago 26')
  })

  it('repite el ano cuando el periodo pasa de diciembre a enero', () => {
    expect(formatCompactRange(fecha('2026-12-15'), fecha('2027-01-15'))).toBe(
      '15 dic 26 - 15 ene 27',
    )
  })

  it('es mas corto que el rango largo, que es para lo que existe', () => {
    const start = fecha('2026-07-21')
    const end = fecha('2026-08-21')
    expect(formatCompactRange(start, end).length).toBeLessThan(
      formatPeriodRange(start, end).length,
    )
  })

  it('cabe en el ancho de un select de celular', () => {
    // El `<select>` mas apretado muestra ~30 caracteres a 412px.
    expect(formatCompactRange(fecha('2026-11-30'), fecha('2026-12-30')).length).toBeLessThanOrEqual(
      20,
    )
  })
})
