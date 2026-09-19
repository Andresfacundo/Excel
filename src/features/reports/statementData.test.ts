import { describe, expect, it } from 'vitest'
import { buildStatement, statementFileName } from './statementData'
import { computeTracking, monthlyPeriods, parseIsoDate } from '@/features/tracking/domain'
import { EMPTY_ISSUER } from '@/types/domain'
import type { IssuerSettings, Payment, Person, PeriodDefinition, Receipt } from '@/types/domain'

const TARGET = 2_508_000

const person: Person = {
  id: 'p1',
  name: 'Wilfer Gómez',
  concept: 'Arriendo',
  notes: null,
  archived: false,
  defaultTargetAmount: TARGET,
  createdAt: '2026-07-01T00:00:00Z',
}

function periods(count = 3): PeriodDefinition[] {
  return monthlyPeriods('2026-07-21', count, TARGET).map((period, index) => ({
    id: `per-${index}`,
    personId: 'p1',
    label: null,
    ...period,
  }))
}

function payment(id: string, paidOn: string, amount: number, periodId: string | null): Payment {
  return {
    id,
    personId: 'p1',
    paidOn,
    amount,
    note: null,
    periodId,
    createdAt: `${paidOn}T10:00:00.000Z`,
  }
}

function receipt(id: string, paymentId: string, fileName: string, mimeType: string): Receipt {
  return {
    id,
    paymentId,
    storagePath: `u/p/${paymentId}/${id}`,
    fileName,
    mimeType,
    sizeBytes: 1024,
    createdAt: '2026-07-25T10:00:00Z',
  }
}

const generatedAt = parseIsoDate('2026-10-15')

function statement(options?: {
  payments?: Payment[]
  receipts?: Map<string, Receipt[]>
  issuer?: IssuerSettings
}) {
  const pagos = options?.payments ?? [
    payment('a', '2026-07-25', 1_000_000, 'per-0'),
    payment('b', '2026-09-01', 500_000, 'per-1'),
  ]
  return buildStatement({
    person,
    issuer: options?.issuer ?? EMPTY_ISSUER,
    tracking: computeTracking(periods(), pagos, generatedAt),
    payments: pagos,
    receiptsByPayment: options?.receipts ?? new Map(),
    generatedAt,
  })
}

describe('buildStatement — totales', () => {
  it('calcula objetivo, pagado, pendiente y vencido', () => {
    const model = statement()
    expect(model.totals.objetivo).toBe('$ 7.524.000')
    expect(model.totals.pagado).toBe('$ 1.500.000')
    expect(model.totals.pendiente).toBe('$ 6.024.000')
    // Los dos primeros periodos ya vencieron el 15 de octubre.
    expect(model.totals.vencido).toBe('$ 3.516.000')
  })

  it('muestra el saldo a favor solo cuando existe', () => {
    expect(statement().totals.saldoAFavor).toBeNull()

    const conSobrante = statement({
      payments: [payment('a', '2026-07-25', 99_000_000, null)],
    })
    expect(conSobrante.totals.saldoAFavor).not.toBeNull()
  })
})

describe('buildStatement — filas', () => {
  it('arma una fila por periodo con su faltante', () => {
    const model = statement()
    expect(model.periodRows).toHaveLength(3)
    expect(model.periodRows[0]?.[0]).toBe('Periodo 1')
    expect(model.periodRows[0]?.[5]).toBe('$ 1.508.000')
    expect(model.periodRows[0]?.[6]).toBe('Atrasado (parcial)')
  })

  it('usa la etiqueta del periodo cuando tiene una', () => {
    const conEtiqueta: PeriodDefinition[] = periods(1).map((p) => ({ ...p, label: 'Julio' }))
    const model = buildStatement({
      person,
      issuer: EMPTY_ISSUER,
      tracking: computeTracking(conEtiqueta, [], generatedAt),
      payments: [],
      receiptsByPayment: new Map(),
      generatedAt,
    })
    expect(model.periodRows[0]?.[0]).toBe('Julio')
  })

  it('arma una fila por pago, del mas reciente al mas antiguo', () => {
    const model = statement()
    expect(model.paymentRows).toHaveLength(2)
    expect(model.paymentRows[0]?.[0]).toContain('septiembre')
    expect(model.paymentRows[0]?.[2]).toBe('Periodo 2')
  })

  it('marca los pagos sin periodo como "Sin asignar"', () => {
    const model = statement({ payments: [payment('a', '2026-07-25', 100, null)] })
    expect(model.paymentRows[0]?.[2]).toBe('Sin asignar')
  })
})

describe('buildStatement — comprobantes', () => {
  it('cuenta los pagos que no tienen soporte', () => {
    const model = statement()
    expect(model.paymentsWithoutReceipt).toBe(2)
    expect(model.paymentRows[0]?.[4]).toBe('Sin soporte')
  })

  it('lista los comprobantes con el pago al que pertenecen', () => {
    const receipts = new Map<string, Receipt[]>([
      ['a', [receipt('r1', 'a', 'consignacion.jpg', 'image/jpeg')]],
      ['b', [receipt('r2', 'b', 'banco.pdf', 'application/pdf')]],
    ])
    const model = statement({ receipts })

    expect(model.receipts).toHaveLength(2)
    expect(model.paymentsWithoutReceipt).toBe(0)
    // El anexo sigue el mismo orden que la tabla de pagos: del mas reciente al
    // mas antiguo, para que sea facil casar cada imagen con su fila.
    expect(model.receipts[0]?.caption).toContain('banco.pdf')
    expect(model.receipts[1]?.caption).toContain('consignacion.jpg')
    expect(model.paymentRows[0]?.[4]).toBe('1 archivo(s)')
  })

  it('soporta varios comprobantes en el mismo pago', () => {
    const receipts = new Map<string, Receipt[]>([
      [
        'a',
        [
          receipt('r1', 'a', 'foto.jpg', 'image/jpeg'),
          receipt('r2', 'a', 'banco.pdf', 'application/pdf'),
        ],
      ],
    ])
    const model = statement({ receipts })
    expect(model.receipts).toHaveLength(2)
    expect(model.paymentsWithoutReceipt).toBe(1)
  })
})

describe('buildStatement — encabezado', () => {
  it('omite las lineas vacias del emisor', () => {
    const model = statement({
      issuer: { displayName: 'Andres Facundo', phone: null, email: '  ', note: 'Inmuebles' },
    })
    expect(model.issuerLines).toEqual(['Andres Facundo', 'Inmuebles'])
  })

  it('no falla si el emisor no esta configurado', () => {
    expect(statement().issuerLines).toEqual([])
  })

  it('incluye el nombre y el concepto del cliente', () => {
    expect(statement().clientLines).toEqual(['Wilfer Gómez', 'Arriendo'])
  })
})

describe('statementFileName', () => {
  it('genera un nombre sin acentos ni espacios', () => {
    expect(statementFileName(person, generatedAt)).toBe(
      'estado-de-cuenta-wilfer-gomez-2026-10-15.pdf',
    )
  })

  it('no se rompe con un nombre sin caracteres utiles', () => {
    expect(statementFileName({ ...person, name: '???' }, generatedAt)).toBe(
      'estado-de-cuenta-cliente-2026-10-15.pdf',
    )
  })
})
