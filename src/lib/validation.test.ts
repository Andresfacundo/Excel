import { describe, expect, it } from 'vitest'
import {
  daysBetween,
  toDate,
  todayIso,
  validateAmount,
  validateConcept,
  validateDate,
  validateEmail,
  validateGeneratedCount,
  validateLabel,
  validateName,
  validateNoOverlap,
  validateNote,
  validatePassword,
  validatePaymentDate,
  validatePeriodEnd,
  validatePeriodStart,
  validatePhone,
  validateReceiptFiles,
  formatBytes,
} from './validation'

describe('toDate', () => {
  it('acepta una fecha real', () => {
    expect(toDate('2026-07-21')).toBeInstanceOf(Date)
  })

  it('rechaza formatos invalidos', () => {
    expect(toDate('21/07/2026')).toBeNull()
    expect(toDate('2026-7-1')).toBeNull()
    expect(toDate('')).toBeNull()
  })

  it('rechaza fechas que no existen', () => {
    expect(toDate('2026-02-31')).toBeNull()
    expect(toDate('2026-13-01')).toBeNull()
    expect(toDate('2025-02-29')).toBeNull()
  })

  it('acepta el 29 de febrero en anio bisiesto', () => {
    expect(toDate('2028-02-29')).toBeInstanceOf(Date)
  })
})

describe('daysBetween', () => {
  it('cuenta los dias entre dos fechas', () => {
    expect(daysBetween('2026-07-21', '2026-08-21')).toBe(31)
    expect(daysBetween('2026-08-21', '2026-07-21')).toBe(-31)
  })

  it('devuelve null con fechas invalidas', () => {
    expect(daysBetween('nada', '2026-08-21')).toBeNull()
  })
})

describe('validateName', () => {
  it('acepta nombres normales', () => {
    expect(validateName('Wilfer')).toBeUndefined()
    expect(validateName('  Ana Maria  ')).toBeUndefined()
    expect(validateName('José Ñuñez')).toBeUndefined()
  })

  it('rechaza vacio, un caracter, sin letras y demasiado largo', () => {
    expect(validateName('')).toBeTruthy()
    expect(validateName('    ')).toBeTruthy()
    expect(validateName('A')).toBeTruthy()
    expect(validateName('---')).toBeTruthy()
    expect(validateName('a'.repeat(81))).toBeTruthy()
    expect(validateName('a'.repeat(80))).toBeUndefined()
  })
})

describe('validateConcept / validateLabel / validateNote', () => {
  it('permiten vacio', () => {
    expect(validateConcept('')).toBeUndefined()
    expect(validateLabel('')).toBeUndefined()
    expect(validateNote('')).toBeUndefined()
  })

  it('cortan en el limite', () => {
    expect(validateConcept('a'.repeat(121))).toBeTruthy()
    expect(validateLabel('a'.repeat(81))).toBeTruthy()
    expect(validateNote('a'.repeat(281))).toBeTruthy()
  })
})

describe('validateDate y sus variantes', () => {
  it('exige la fecha', () => {
    expect(validateDate('')).toBeTruthy()
    expect(validatePeriodStart('')).toBeTruthy()
  })

  it('respeta el rango soportado', () => {
    expect(validateDate('1999-12-31')).toBeTruthy()
    expect(validateDate('2101-01-01')).toBeTruthy()
    expect(validatePeriodStart('2026-07-21')).toBeUndefined()
  })

  it('el pago no puede ser futuro', () => {
    expect(validatePaymentDate(todayIso())).toBeUndefined()
    expect(validatePaymentDate('2099-01-01')).toBeTruthy()
  })
})

describe('validatePeriodEnd', () => {
  it('acepta un fin posterior al inicio', () => {
    expect(validatePeriodEnd('2026-08-21', '2026-07-21')).toBeUndefined()
  })

  it('rechaza un fin anterior o igual al inicio', () => {
    expect(validatePeriodEnd('2026-07-01', '2026-07-21')).toBeTruthy()
    expect(validatePeriodEnd('2026-07-21', '2026-07-21')).toBeTruthy()
  })

  it('rechaza periodos absurdamente largos', () => {
    expect(validatePeriodEnd('2060-01-01', '2026-01-01')).toBeTruthy()
  })

  it('no compara si el inicio aun no es valido', () => {
    expect(validatePeriodEnd('2026-08-21', '')).toBeUndefined()
  })

  it('exige la fecha de fin', () => {
    expect(validatePeriodEnd('', '2026-07-21')).toBeTruthy()
  })
})

describe('validateNoOverlap', () => {
  const existentes = [
    { startDate: '2026-07-21', endDate: '2026-08-21' },
    { startDate: '2026-10-01', endDate: '2026-11-01' },
  ]

  it('permite un periodo en un hueco', () => {
    expect(validateNoOverlap('2026-08-21', '2026-09-21', existentes)).toBeUndefined()
  })

  it('permite periodos contiguos', () => {
    expect(validateNoOverlap('2026-11-01', '2026-12-01', existentes)).toBeUndefined()
  })

  it('detecta un cruce parcial', () => {
    expect(validateNoOverlap('2026-08-01', '2026-09-01', existentes)).toBeTruthy()
  })

  it('detecta un periodo contenido en otro', () => {
    expect(validateNoOverlap('2026-07-25', '2026-08-01', existentes)).toBeTruthy()
  })

  it('detecta un periodo que envuelve a otro', () => {
    expect(validateNoOverlap('2026-01-01', '2027-01-01', existentes)).toBeTruthy()
  })

  it('no opina si las fechas aun no son validas', () => {
    expect(validateNoOverlap('', '2026-09-01', existentes)).toBeUndefined()
    expect(validateNoOverlap('2026-09-01', '2026-08-01', existentes)).toBeUndefined()
  })
})

describe('validateAmount', () => {
  it('acepta montos positivos', () => {
    expect(validateAmount('500000')).toBeUndefined()
    expect(validateAmount('1500.50')).toBeUndefined()
  })

  it('rechaza vacio, cero, negativos y texto', () => {
    expect(validateAmount('')).toBeTruthy()
    expect(validateAmount('0')).toBeTruthy()
    expect(validateAmount('-5')).toBeTruthy()
    expect(validateAmount('abc')).toBeTruthy()
  })

  it('permite vacio cuando es opcional', () => {
    expect(validateAmount('', { optional: true })).toBeUndefined()
    expect(validateAmount('0', { optional: true })).toBeTruthy()
  })

  it('rechaza mas de dos decimales y montos absurdos', () => {
    expect(validateAmount('100.123')).toBeTruthy()
    expect(validateAmount('100.12')).toBeUndefined()
    expect(validateAmount('9999999999999')).toBeTruthy()
  })
})

describe('validateGeneratedCount', () => {
  it('exige un entero entre 1 y 240', () => {
    expect(validateGeneratedCount('5')).toBeUndefined()
    expect(validateGeneratedCount('')).toBeTruthy()
    expect(validateGeneratedCount('0')).toBeTruthy()
    expect(validateGeneratedCount('2.5')).toBeTruthy()
    expect(validateGeneratedCount('241')).toBeTruthy()
    expect(validateGeneratedCount('240')).toBeUndefined()
  })
})

describe('validateEmail y validatePassword', () => {
  it('valida el correo', () => {
    expect(validateEmail('andres@ejemplo.com')).toBeUndefined()
    expect(validateEmail('  andres@ejemplo.com ')).toBeUndefined()
    expect(validateEmail('andres@')).toBeTruthy()
    expect(validateEmail('')).toBeTruthy()
  })

  it('exige 8 caracteres con letra y numero', () => {
    expect(validatePassword('ClaveSegura1')).toBeUndefined()
    expect(validatePassword('corta1')).toBeTruthy()
    expect(validatePassword('solotextolargo')).toBeTruthy()
    expect(validatePassword('12345678')).toBeTruthy()
  })
})

function fakeFile(name: string, type: string, size: number): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('formatBytes', () => {
  it('usa la unidad que toca', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB')
  })
})

describe('validateReceiptFiles', () => {
  it('acepta imagenes y PDF', () => {
    expect(validateReceiptFiles([fakeFile('foto.jpg', 'image/jpeg', 120_000)])).toBeUndefined()
    expect(validateReceiptFiles([fakeFile('banco.pdf', 'application/pdf', 50_000)])).toBeUndefined()
  })

  it('exige al menos un archivo', () => {
    expect(validateReceiptFiles([])).toBeTruthy()
  })

  it('rechaza tipos que no son comprobante', () => {
    expect(validateReceiptFiles([fakeFile('hoja.xlsx', 'application/vnd.ms-excel', 1000)])).toBeTruthy()
    expect(validateReceiptFiles([fakeFile('video.mp4', 'video/mp4', 1000)])).toBeTruthy()
  })

  it('rechaza archivos vacios y demasiado grandes', () => {
    expect(validateReceiptFiles([fakeFile('vacio.jpg', 'image/jpeg', 0)])).toBeTruthy()
    expect(validateReceiptFiles([fakeFile('grande.jpg', 'image/jpeg', 11 * 1024 * 1024)])).toBeTruthy()
  })

  it('limita cuantos se suben de una vez', () => {
    const muchos = Array.from({ length: 11 }, (_, i) => fakeFile(`f${i}.jpg`, 'image/jpeg', 1000))
    expect(validateReceiptFiles(muchos)).toBeTruthy()
  })

  it('nombra el archivo que tiene el problema', () => {
    const mensaje = validateReceiptFiles([
      fakeFile('buena.jpg', 'image/jpeg', 1000),
      fakeFile('mala.txt', 'text/plain', 1000),
    ])
    expect(mensaje).toContain('mala.txt')
  })
})

describe('validatePhone', () => {
  it('permite vacio', () => {
    expect(validatePhone('')).toBeUndefined()
  })

  it('acepta formatos comunes', () => {
    expect(validatePhone('300 123 4567')).toBeUndefined()
    expect(validatePhone('+57 (1) 234-5678')).toBeUndefined()
  })

  it('rechaza letras y numeros incompletos', () => {
    expect(validatePhone('llamame')).toBeTruthy()
    expect(validatePhone('12345')).toBeTruthy()
  })
})
