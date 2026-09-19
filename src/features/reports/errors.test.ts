import { describe, expect, it } from 'vitest'
import { CHUNK_FAILURE_MESSAGE, describeStatementError } from './errors'

describe('describeStatementError', () => {
  it('explica que hacer cuando falla la carga del generador', () => {
    const mensajes = [
      'Failed to fetch dynamically imported module: http://localhost:5173/src/features/reports/statementPdf.ts',
      'Importing a module script failed.',
      'error loading dynamically imported module',
      'Failed to fetch',
    ]
    for (const mensaje of mensajes) {
      expect(describeStatementError(new Error(mensaje))).toBe(CHUNK_FAILURE_MESSAGE)
    }
  })

  it('menciona npm install, que es lo que suele faltar', () => {
    expect(CHUNK_FAILURE_MESSAGE).toContain('npm install')
  })

  it('deja pasar los demas errores tal cual', () => {
    expect(describeStatementError(new Error('El bucket no existe'))).toBe('El bucket no existe')
  })

  it('no se rompe con algo que no es un Error', () => {
    expect(describeStatementError('roto')).toBe('No se pudo generar el PDF.')
    expect(describeStatementError(null)).toBe('No se pudo generar el PDF.')
  })
})
