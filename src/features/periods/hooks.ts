import { useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { fetchPeriods } from './api'
import { mutationKeys, queryKeys } from '@/lib/queryKeys'
import type {
  CreatePeriodsVars,
  DeletePeriodVars,
  UpdatePeriodVars,
} from '@/lib/mutationDefaults'
import type { NewPeriod, PeriodDefinition } from '@/types/domain'

/** Todos los periodos del usuario, de todas sus personas. */
export function usePeriods(userId: string) {
  return useQuery<PeriodDefinition[]>({
    queryKey: queryKeys.periods(userId),
    queryFn: () => fetchPeriods(userId),
    enabled: Boolean(userId),
  })
}

/** Agrupa los periodos por persona una sola vez por cambio de datos. */
export function usePeriodsByPerson(
  periods: PeriodDefinition[] | undefined,
): Map<string, PeriodDefinition[]> {
  return useMemo(() => {
    const grouped = new Map<string, PeriodDefinition[]>()
    for (const period of periods ?? []) {
      const list = grouped.get(period.personId)
      if (list) list.push(period)
      else grouped.set(period.personId, [period])
    }
    return grouped
  }, [periods])
}

export function useCreatePeriods(userId: string) {
  const mutation = useMutation<PeriodDefinition[], Error, CreatePeriodsVars>({
    mutationKey: mutationKeys.createPeriods,
  })

  return {
    ...mutation,
    createPeriods: (periods: NewPeriod[]) => mutation.mutateAsync({ userId, periods }),
    createPeriod: (period: NewPeriod) => mutation.mutateAsync({ userId, periods: [period] }),
  }
}

export function useUpdatePeriod(userId: string) {
  const mutation = useMutation<PeriodDefinition, Error, UpdatePeriodVars>({
    mutationKey: mutationKeys.updatePeriod,
  })

  return {
    ...mutation,
    updatePeriod: (periodId: string, changes: UpdatePeriodVars['changes']) =>
      mutation.mutateAsync({ userId, periodId, changes }),
  }
}

export function useDeletePeriod(userId: string) {
  const mutation = useMutation<void, Error, DeletePeriodVars>({
    mutationKey: mutationKeys.deletePeriod,
  })

  return {
    ...mutation,
    deletePeriod: (periodId: string) => mutation.mutateAsync({ userId, periodId }),
  }
}
