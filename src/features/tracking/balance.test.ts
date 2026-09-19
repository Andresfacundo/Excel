import { describe, expect, it } from 'vitest'
import { balanceText } from './balance'

describe('balanceText', () => {
  it('dice cuanto falta cuando la cuenta va por debajo', () => {
    expect(balanceText(-1_008_000)).toBe('Va $ 1.008.000 por debajo de lo acordado')
  })

  it('dice cuanto sobra cuando va adelantada', () => {
    expect(balanceText(500_000)).toBe('Va $ 500.000 adelantado')
  })

  it('no usa el signo negativo para hablar de un atraso', () => {
    expect(balanceText(-120_000)).not.toContain('-$')
  })

  it('trata como exacto cualquier diferencia menor a un peso', () => {
    expect(balanceText(0)).toBe('Va exacto con lo acordado')
    expect(balanceText(0.4)).toBe('Va exacto con lo acordado')
    expect(balanceText(-0.4)).toBe('Va exacto con lo acordado')
  })
})
