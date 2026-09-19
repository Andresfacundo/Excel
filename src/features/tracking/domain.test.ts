import { describe, expect, it } from 'vitest'
import {
  addMonths,
  clamp,
  computeTracking,
  monthlyPeriods,
  parseIsoDate,
  periodForDate,
  sortPaymentsAsc,
  sortPaymentsDesc,
  sortPeriods,
  statusLabel,
  sumPayments,
  summarize,
  toIsoDate,
} from './domain'
import type { Payment, PeriodDefinition } from '@/types/domain'

const TARGET = 2_508_000

/** Cinco periodos mensuales, como los del caso real. */
function planMensual(count = 5, target = TARGET): PeriodDefinition[] {
  return monthlyPeriods('2026-07-21', count, target).map((period, index) => ({
    id: `per-${index}`,
    personId: 'p1',
    label: null,
    ...period,
  }))
}

/** Pago sin asignar: se reparte en cascada. */
function libre(id: string, paidOn: string, amount: number): Payment {
  return {
    id,
    personId: 'p1',
    paidOn,
    amount,
    note: null,
    periodId: null,
    createdAt: `${paidOn}T12:00:00.000Z`,
  }
}

/** Pago marcado para un periodo concreto. */
function para(id: string, paidOn: string, amount: number, periodId: string): Payment {
  return { ...libre(id, paidOn, amount), periodId }
}

describe('utilidades de fecha', () => {
  it('addMonths suma meses conservando el dia', () => {
    const result = addMonths(parseIsoDate('2026-07-21'), 1)
    expect(result.getMonth()).toBe(7)
    expect(result.getDate()).toBe(21)
  })

  it('addMonths cruza el fin de anio', () => {
    const result = addMonths(parseIsoDate('2026-11-21'), 3)
    expect(result.getFullYear()).toBe(2027)
    expect(result.getMonth()).toBe(1)
  })

  it('toIsoDate y parseIsoDate son inversas', () => {
    expect(toIsoDate(parseIsoDate('2026-02-09'))).toBe('2026-02-09')
  })

  it('clamp acota por debajo y por encima', () => {
    expect(clamp(-10, 0, 100)).toBe(0)
    expect(clamp(150, 0, 100)).toBe(100)
    expect(clamp(42, 0, 100)).toBe(42)
  })
})

describe('monthlyPeriods', () => {
  it('genera periodos consecutivos que se encadenan', () => {
    const periods = monthlyPeriods('2026-07-21', 3, 100)
    expect(periods).toHaveLength(3)
    expect(periods[0]?.startDate).toBe('2026-07-21')
    expect(periods[0]?.endDate).toBe('2026-08-21')
    expect(periods[1]?.startDate).toBe('2026-08-21')
    expect(periods[2]?.endDate).toBe('2026-10-21')
  })

  it('devuelve vacio con cuenta cero o negativa', () => {
    expect(monthlyPeriods('2026-07-21', 0, 100)).toHaveLength(0)
    expect(monthlyPeriods('2026-07-21', -2, 100)).toHaveLength(0)
  })

  it('devuelve vacio con una fecha invalida', () => {
    expect(monthlyPeriods('no-es-fecha', 3, 100)).toHaveLength(0)
  })
})

describe('sortPeriods y periodForDate', () => {
  it('ordena cronologicamente sin mutar', () => {
    const desordenados: PeriodDefinition[] = [
      { id: 'b', personId: 'p1', startDate: '2026-09-01', endDate: '2026-10-01', targetAmount: 1, label: null },
      { id: 'a', personId: 'p1', startDate: '2026-07-01', endDate: '2026-08-01', targetAmount: 1, label: null },
    ]
    expect(sortPeriods(desordenados).map((p) => p.id)).toEqual(['a', 'b'])
    expect(desordenados.map((p) => p.id)).toEqual(['b', 'a'])
  })

  it('ubica una fecha dentro de su periodo', () => {
    const periods = planMensual()
    expect(periodForDate(periods, '2026-07-21')?.id).toBe('per-0')
    expect(periodForDate(periods, '2026-08-20')?.id).toBe('per-0')
    expect(periodForDate(periods, '2026-08-21')?.id).toBe('per-1')
  })

  it('devuelve null en un hueco o fuera del plan', () => {
    const conHueco: PeriodDefinition[] = [
      { id: 'a', personId: 'p1', startDate: '2026-07-01', endDate: '2026-08-01', targetAmount: 1, label: null },
      { id: 'b', personId: 'p1', startDate: '2026-10-01', endDate: '2026-11-01', targetAmount: 1, label: null },
    ]
    expect(periodForDate(conHueco, '2026-09-15')).toBeNull()
    expect(periodForDate(conHueco, '2026-06-01')).toBeNull()
  })
})

describe('computeTracking — sin periodos', () => {
  it('no explota y reporta ceros', () => {
    const result = computeTracking([], [libre('1', '2026-07-25', 500_000)])
    expect(result.periods).toHaveLength(0)
    expect(result.totalTarget).toBe(0)
    expect(result.percent).toBe(0)
    expect(result.unallocated).toBe(500_000)
    expect(result.unassignedPayments).toHaveLength(1)
    expect(statusLabel(result)).toBe('Sin periodos')
  })
})

describe('computeTracking — pagos sin asignar (cascada)', () => {
  const today = parseIsoDate('2026-09-19')

  it('sin pagos deja todo pendiente', () => {
    const result = computeTracking(planMensual(), [], today)
    expect(result.totalPaid).toBe(0)
    expect(result.totalTarget).toBe(TARGET * 5)
    expect(result.totalDrift).toBe(-TARGET * 5)
    expect(result.unallocated).toBe(0)
  })

  it('llena los periodos del mas antiguo al mas nuevo', () => {
    const result = computeTracking(planMensual(), [libre('1', '2026-07-25', 3_000_000)], today)
    expect(result.periods[0]?.paid).toBe(TARGET)
    expect(result.periods[0]?.fromPool).toBe(TARGET)
    expect(result.periods[1]?.paid).toBe(492_000)
    expect(result.periods[2]?.paid).toBe(0)
  })

  it('reporta el sobrante cuando se paga de mas', () => {
    const result = computeTracking(planMensual(), [libre('1', '2026-07-25', 20_000_000)], today)
    expect(result.unallocated).toBe(20_000_000 - TARGET * 5)
    expect(result.percent).toBe(100)
    expect(result.status).toBe('success')
  })
})

describe('computeTracking — pagos asignados a un periodo', () => {
  const today = parseIsoDate('2026-10-15')

  it('el caso de Andres: se debe del primero y del segundo, y vamos en el tercero', () => {
    const result = computeTracking(
      planMensual(),
      [
        para('a', '2026-07-25', 1_000_000, 'per-0'),
        para('b', '2026-09-01', 500_000, 'per-1'),
        para('c', '2026-10-01', TARGET, 'per-2'),
      ],
      today,
    )

    expect(result.periods[0]?.paid).toBe(1_000_000)
    expect(result.periods[0]?.pending).toBe(1_508_000)
    expect(result.periods[0]?.status).toBe('danger')

    expect(result.periods[1]?.paid).toBe(500_000)
    expect(result.periods[1]?.pending).toBe(2_008_000)
    expect(result.periods[1]?.status).toBe('danger')

    // El dinero del tercer periodo NO tapa la deuda de los anteriores.
    expect(result.periods[2]?.paid).toBe(TARGET)
    expect(result.periods[2]?.pending).toBe(0)

    expect(result.overduePeriods).toBe(2)
    expect(result.overdueAmount).toBe(1_508_000 + 2_008_000)
  })

  it('agrupa cada pago dentro de su periodo', () => {
    const result = computeTracking(
      planMensual(),
      [
        para('a', '2026-07-25', 400_000, 'per-0'),
        para('b', '2026-08-02', 600_000, 'per-0'),
        para('c', '2026-09-01', 500_000, 'per-1'),
      ],
      today,
    )
    expect(result.periods[0]?.payments.map((p) => p.id)).toEqual(['a', 'b'])
    expect(result.periods[0]?.assigned).toBe(1_000_000)
    expect(result.periods[1]?.payments.map((p) => p.id)).toEqual(['c'])
  })

  it('el excedente de un periodo baja al siguiente', () => {
    const result = computeTracking(planMensual(), [para('a', '2026-07-25', 3_000_000, 'per-0')], today)
    expect(result.periods[0]?.paid).toBe(TARGET)
    expect(result.periods[0]?.carryOut).toBe(492_000)
    expect(result.periods[1]?.carryIn).toBe(492_000)
    expect(result.periods[1]?.assigned).toBe(0)
  })

  it('un pago de un periodo borrado se trata como sin asignar', () => {
    const result = computeTracking(planMensual(), [para('a', '2026-07-25', 500_000, 'per-borrado')], today)
    expect(result.unassignedPayments.map((p) => p.id)).toEqual(['a'])
    expect(result.periods[0]?.fromPool).toBe(500_000)
  })
})

describe('computeTracking — periodos de distinta duracion y monto', () => {
  const today = parseIsoDate('2026-12-31')

  const irregulares: PeriodDefinition[] = [
    // Quincena con medio objetivo
    { id: 'q1', personId: 'p1', startDate: '2026-07-01', endDate: '2026-07-16', targetAmount: 500_000, label: 'Primera quincena' },
    // Mes normal
    { id: 'm1', personId: 'p1', startDate: '2026-07-16', endDate: '2026-08-16', targetAmount: 1_000_000, label: null },
    // Hueco de agosto a octubre, y un periodo largo
    { id: 'l1', personId: 'p1', startDate: '2026-10-01', endDate: '2026-12-01', targetAmount: 3_000_000, label: 'Bimestre' },
  ]

  it('respeta el objetivo propio de cada periodo', () => {
    const result = computeTracking(irregulares, [], today)
    expect(result.periods.map((p) => p.target)).toEqual([500_000, 1_000_000, 3_000_000])
    expect(result.totalTarget).toBe(4_500_000)
  })

  it('conserva la etiqueta y la posicion', () => {
    const result = computeTracking(irregulares, [], today)
    expect(result.periods[0]?.label).toBe('Primera quincena')
    expect(result.periods[2]?.position).toBe(2)
  })

  it('un pago en el hueco no pertenece a ningun periodo', () => {
    expect(periodForDate(irregulares, '2026-09-10')).toBeNull()
  })

  it('el excedente de una quincena baja al mes siguiente', () => {
    const result = computeTracking(irregulares, [para('a', '2026-07-05', 800_000, 'q1')], today)
    expect(result.periods[0]?.paid).toBe(500_000)
    expect(result.periods[1]?.carryIn).toBe(300_000)
    expect(result.periods[1]?.paid).toBe(300_000)
  })

  it('ordena aunque lleguen desordenados', () => {
    const desordenados = [irregulares[2]!, irregulares[0]!, irregulares[1]!]
    const result = computeTracking(desordenados, [], today)
    expect(result.periods.map((p) => p.id)).toEqual(['q1', 'm1', 'l1'])
  })
})

describe('computeTracking — estados y bordes', () => {
  const today = parseIsoDate('2026-09-19')

  it('marca como pagado el periodo cubierto', () => {
    const result = computeTracking(planMensual(), [para('1', '2026-07-25', TARGET, 'per-0')], today)
    expect(result.periods[0]?.status).toBe('success')
    expect(result.periods[0]?.statusLabel).toBe('Pagado')
    expect(result.periods[0]?.percent).toBe(100)
  })

  it('cuenta los periodos vencidos sin cubrir', () => {
    const result = computeTracking(planMensual(), [], parseIsoDate('2026-12-01'))
    expect(result.periods[0]?.statusLabel).toBe('Atrasado')
    expect(result.overduePeriods).toBe(4)
    expect(result.overdueAmount).toBe(TARGET * 4)
    expect(result.status).toBe('danger')
  })

  it('distingue atraso parcial de atraso total', () => {
    const result = computeTracking(
      planMensual(),
      [para('1', '2026-07-25', 500_000, 'per-0')],
      parseIsoDate('2026-12-01'),
    )
    expect(result.periods[0]?.statusLabel).toBe('Atrasado (parcial)')
  })

  it('marca el periodo en curso y el siguiente como proximo', () => {
    const result = computeTracking(planMensual(), [], parseIsoDate('2026-08-01'))
    expect(result.periods[0]?.statusLabel).toBe('En curso')
    expect(result.periods[1]?.statusLabel).toBe('Proximo')
  })

  it('acumula el desface periodo a periodo', () => {
    const result = computeTracking(planMensual(), [para('1', '2026-07-25', TARGET, 'per-0')], today)
    expect(result.periods[0]?.cumulativeDrift).toBe(0)
    expect(result.periods[1]?.cumulativeDrift).toBe(-TARGET)
    expect(result.periods[2]?.cumulativeDrift).toBe(-TARGET * 2)
  })

  it('pending nunca es negativo', () => {
    const result = computeTracking(planMensual(), [para('1', '2026-07-25', 9_000_000, 'per-0')], today)
    for (const period of result.periods) {
      expect(period.pending).toBeGreaterThanOrEqual(0)
    }
  })

  it('el total pagado nunca supera el objetivo total', () => {
    const result = computeTracking(planMensual(), [libre('1', '2026-07-25', 99_000_000)], today)
    expect(result.totalPaid).toBe(result.totalTarget)
    expect(result.totalDrift).toBe(0)
  })
})

describe('statusLabel', () => {
  const today = parseIsoDate('2026-12-01')

  it('describe el atraso en plural y singular', () => {
    expect(statusLabel(computeTracking(planMensual(1), [], today))).toBe('1 periodo atrasado')
    expect(statusLabel(computeTracking(planMensual(), [], today))).toBe('4 periodos atrasados')
  })

  it('dice "Al dia" cuando esta cubierto', () => {
    const result = computeTracking(planMensual(), [libre('1', '2026-07-25', TARGET * 5)], today)
    expect(statusLabel(result)).toBe('Al dia')
  })
})

describe('sumPayments y ordenamiento', () => {
  it('suma montos', () => {
    expect(sumPayments([libre('a', '2026-07-01', 100), libre('b', '2026-08-01', 250)])).toBe(350)
  })

  it('ordena ascendente y descendente sin mutar', () => {
    const payments = [libre('a', '2026-07-01', 1), libre('b', '2026-09-01', 2)]
    expect(sortPaymentsAsc(payments).map((p) => p.id)).toEqual(['a', 'b'])
    expect(sortPaymentsDesc(payments).map((p) => p.id)).toEqual(['b', 'a'])
    expect(payments.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('desempata por fecha de creacion dentro del mismo dia', () => {
    const primero: Payment = { ...libre('a', '2026-07-01', 1), createdAt: '2026-07-01T08:00:00Z' }
    const segundo: Payment = { ...libre('b', '2026-07-01', 1), createdAt: '2026-07-01T20:00:00Z' }
    expect(sortPaymentsDesc([primero, segundo]).map((p) => p.id)).toEqual(['b', 'a'])
  })
})

describe('summarize', () => {
  const today = parseIsoDate('2026-12-01')

  it('suma el seguimiento de varias personas', () => {
    const uno = computeTracking(planMensual(), [para('1', '2026-07-25', TARGET, 'per-0')], today)
    const otros: PeriodDefinition[] = monthlyPeriods('2026-01-10', 4, 500_000).map((p, i) => ({
      id: `m-${i}`,
      personId: 'p2',
      label: null,
      ...p,
    }))
    const dos = computeTracking(otros, [libre('2', '2026-02-01', 2_000_000)], today)

    const resumen = summarize([uno, dos])
    expect(resumen.people).toBe(2)
    expect(resumen.totalTarget).toBe(TARGET * 5 + 500_000 * 4)
    expect(resumen.totalPaid).toBe(TARGET + 2_000_000)
    expect(resumen.peopleSettled).toBe(1)
    expect(resumen.peopleOverdue).toBe(1)
  })

  it('una persona sin periodos no cuenta como "al dia"', () => {
    const vacia = computeTracking([], [], today)
    expect(summarize([vacia]).peopleSettled).toBe(0)
  })

  it('no divide por cero sin personas', () => {
    expect(summarize([])).toEqual({
      people: 0,
      totalPaid: 0,
      totalTarget: 0,
      totalDrift: 0,
      percent: 0,
      peopleOverdue: 0,
      peopleSettled: 0,
      overdueAmount: 0,
    })
  })
})
