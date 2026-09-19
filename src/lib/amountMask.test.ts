import { describe, expect, it } from 'vitest'
import { caretAfterMask, maskAmount, nextCaretPosition, unmaskAmount } from './amountMask'
import { validateAmount } from './validation'

describe('maskAmount', () => {
  it('agrupa los miles con punto', () => {
    expect(maskAmount('')).toBe('')
    expect(maskAmount('5')).toBe('5')
    expect(maskAmount('500')).toBe('500')
    expect(maskAmount('5000')).toBe('5.000')
    expect(maskAmount('500000')).toBe('500.000')
    expect(maskAmount('2508000')).toBe('2.508.000')
    expect(maskAmount('1000000000')).toBe('1.000.000.000')
  })

  it('usa coma para los decimales', () => {
    expect(maskAmount('2508000.5')).toBe('2.508.000,5')
    expect(maskAmount('1500.25')).toBe('1.500,25')
    // El punto recien escrito aun no tiene decimales detras.
    expect(maskAmount('1500.')).toBe('1.500,')
  })

  it('devuelve tal cual lo que no es un numero crudo', () => {
    expect(maskAmount('abc')).toBe('abc')
  })
})

describe('unmaskAmount', () => {
  it('quita los puntos de miles', () => {
    expect(unmaskAmount('2.508.000')).toBe('2508000')
    expect(unmaskAmount('500.000')).toBe('500000')
    expect(unmaskAmount('')).toBe('')
  })

  it('trata la coma como separador decimal', () => {
    expect(unmaskAmount('2.508.000,50')).toBe('2508000.50')
    expect(unmaskAmount(',5')).toBe('0.5')
    expect(unmaskAmount('1500,')).toBe('1500.')
  })

  it('ignora la segunda coma y todo lo que no sea numero', () => {
    expect(unmaskAmount('1,5,7')).toBe('1.57')
    expect(unmaskAmount('12a3b')).toBe('123')
    expect(unmaskAmount('-500')).toBe('500')
  })

  it('recorta a dos decimales, que es lo maximo que admite un monto', () => {
    expect(unmaskAmount('10,999')).toBe('10.99')
  })

  it('quita los ceros que sobran a la izquierda', () => {
    expect(unmaskAmount('007')).toBe('7')
    expect(unmaskAmount('0')).toBe('0')
    expect(unmaskAmount('0,5')).toBe('0.5')
  })

  it('no deja escribir numeros absurdamente largos', () => {
    expect(unmaskAmount('9'.repeat(40))).toHaveLength(15)
  })
})

describe('ida y vuelta', () => {
  it('lo que se pinta vuelve a ser el mismo numero crudo', () => {
    for (const raw of ['0', '7', '500', '2508000', '1500.25', '999999999999']) {
      expect(unmaskAmount(maskAmount(raw))).toBe(raw)
    }
  })

  it('lo enmascarado sigue siendo un numero valido para el dominio', () => {
    const raw = unmaskAmount('2.508.000')
    expect(Number(raw)).toBe(2_508_000)
    expect(validateAmount(raw, { label: 'El monto' })).toBeUndefined()
  })

  it('escribir digito a digito va agrupando', () => {
    const teclas = ['2', '5', '0', '8', '0', '0', '0']
    let raw = ''
    const vistos: string[] = []
    for (const tecla of teclas) {
      raw = unmaskAmount(maskAmount(raw) + tecla)
      vistos.push(maskAmount(raw))
    }
    expect(vistos).toEqual(['2', '25', '250', '2.508', '25.080', '250.800', '2.508.000'])
  })
})

describe('posicion del cursor', () => {
  it('lo deja donde estaba al escribir al final', () => {
    // "250800" + "0" al final -> "2.508.000", cursor tras el ultimo digito.
    expect(nextCaretPosition('250.8000', 8, '2.508.000')).toBe(9)
  })

  it('lo mantiene sobre el mismo digito al editar por la mitad', () => {
    // En "2.508.000" el cursor esta tras el "5" (4 caracteres significativos
    // contando desde el principio: 2, 5). Al reagrupar sigue ahi.
    expect(nextCaretPosition('2.508.000', 3, '2.508.000')).toBe(3)
  })

  it('no se cuela delante de un punto de agrupacion', () => {
    expect(caretAfterMask('2.508.000', 0)).toBe(0)
    expect(caretAfterMask('2.508.000', 1)).toBe(1)
    expect(caretAfterMask('2.508.000', 4)).toBe(5)
    expect(caretAfterMask('2.508.000', 99)).toBe(9)
  })
})
