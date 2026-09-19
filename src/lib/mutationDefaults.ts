/**
 * Definiciones por defecto de las mutaciones.
 *
 * Se registran en el QueryClient (y no dentro de cada hook) por una razon
 * concreta: TanStack Query pausa las mutaciones cuando no hay red y las guarda
 * en la cache persistida. Al reabrir la app, `resumePausedMutations()` necesita
 * encontrar la funcion asociada a cada `mutationKey`; si solo viviera dentro de
 * un componente, el cambio hecho sin conexion se perderia.
 */

import { deletePayment, insertPayment, updatePaymentPeriod } from '@/features/payments/api'
import { deletePerson, insertPerson, updatePerson } from '@/features/people/api'
import { deletePeriod, insertPeriods, updatePeriod } from '@/features/periods/api'
import { queryClient } from './queryClient'
import { mutationKeys, queryKeys } from './queryKeys'
import type {
  NewPayment,
  NewPerson,
  NewPeriod,
  Payment,
  Person,
  PeriodDefinition,
} from '@/types/domain'

// --- Personas ----------------------------------------------------------------

export interface CreatePersonVars {
  userId: string
  person: NewPerson
}

export interface UpdatePersonVars {
  userId: string
  personId: string
  changes: Partial<NewPerson> & { archived?: boolean }
}

export interface DeletePersonVars {
  userId: string
  personId: string
}

// --- Periodos ----------------------------------------------------------------

export interface CreatePeriodsVars {
  userId: string
  periods: NewPeriod[]
}

export interface UpdatePeriodVars {
  userId: string
  periodId: string
  changes: Partial<Omit<NewPeriod, 'personId'>>
}

export interface DeletePeriodVars {
  userId: string
  periodId: string
}

// --- Pagos -------------------------------------------------------------------

export interface AddPaymentVars {
  userId: string
  payment: NewPayment
  /** Id temporal usado por la actualizacion optimista. */
  optimisticId: string
}

export interface UpdatePaymentPeriodVars {
  userId: string
  id: string
  periodId: string | null
}

export interface DeletePaymentVars {
  userId: string
  id: string
}

function snapshotOf<T>(context: unknown): T | undefined {
  return (context as { previous?: T } | undefined)?.previous
}

function invalidatePeople(userId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.people(userId) })
}
function invalidatePeriods(userId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.periods(userId) })
}
function invalidatePayments(userId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.payments(userId) })
}

export function registerMutationDefaults(): void {
  // --- Personas -------------------------------------------------------------

  queryClient.setMutationDefaults(mutationKeys.createPerson, {
    mutationFn: ({ userId, person }: CreatePersonVars) => insertPerson(userId, person),
    onSettled: (_d, _e, { userId }: CreatePersonVars) => invalidatePeople(userId),
  })

  queryClient.setMutationDefaults(mutationKeys.updatePerson, {
    mutationFn: ({ userId, personId, changes }: UpdatePersonVars) =>
      updatePerson(userId, personId, changes),

    onMutate: async ({ userId, personId, changes }: UpdatePersonVars) => {
      const key = queryKeys.people(userId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Person[]>(key)

      queryClient.setQueryData<Person[]>(
        key,
        (previous ?? []).map((person) =>
          person.id === personId
            ? {
                ...person,
                ...(changes.name !== undefined ? { name: changes.name } : {}),
                ...(changes.concept !== undefined ? { concept: changes.concept ?? null } : {}),
                ...(changes.notes !== undefined ? { notes: changes.notes ?? null } : {}),
                ...(changes.defaultTargetAmount !== undefined
                  ? { defaultTargetAmount: changes.defaultTargetAmount ?? null }
                  : {}),
                ...(changes.archived !== undefined ? { archived: changes.archived } : {}),
              }
            : person,
        ),
      )
      return { previous }
    },

    onError: (_e, { userId }: UpdatePersonVars, context) => {
      const previous = snapshotOf<Person[]>(context)
      if (previous) queryClient.setQueryData(queryKeys.people(userId), previous)
    },

    onSettled: (_d, _e, { userId }: UpdatePersonVars) => invalidatePeople(userId),
  })

  queryClient.setMutationDefaults(mutationKeys.deletePerson, {
    mutationFn: ({ userId, personId }: DeletePersonVars) => deletePerson(userId, personId),

    onMutate: async ({ userId, personId }: DeletePersonVars) => {
      const peopleKey = queryKeys.people(userId)
      await queryClient.cancelQueries({ queryKey: peopleKey })
      const previous = queryClient.getQueryData<Person[]>(peopleKey)

      queryClient.setQueryData<Person[]>(
        peopleKey,
        (previous ?? []).filter((person) => person.id !== personId),
      )
      // Sus periodos y pagos caen con ella por la cascada de la base.
      queryClient.setQueryData<PeriodDefinition[]>(queryKeys.periods(userId), (current) =>
        (current ?? []).filter((period) => period.personId !== personId),
      )
      queryClient.setQueryData<Payment[]>(queryKeys.payments(userId), (current) =>
        (current ?? []).filter((payment) => payment.personId !== personId),
      )

      return { previous }
    },

    onError: (_e, { userId }: DeletePersonVars, context) => {
      const previous = snapshotOf<Person[]>(context)
      if (previous) queryClient.setQueryData(queryKeys.people(userId), previous)
      invalidatePeriods(userId)
      invalidatePayments(userId)
    },

    onSettled: (_d, _e, { userId }: DeletePersonVars) => {
      invalidatePeople(userId)
      invalidatePeriods(userId)
      invalidatePayments(userId)
    },
  })

  // --- Periodos -------------------------------------------------------------

  queryClient.setMutationDefaults(mutationKeys.createPeriods, {
    mutationFn: ({ userId, periods }: CreatePeriodsVars) => insertPeriods(userId, periods),
    onSettled: (_d, _e, { userId }: CreatePeriodsVars) => invalidatePeriods(userId),
  })

  queryClient.setMutationDefaults(mutationKeys.updatePeriod, {
    mutationFn: ({ userId, periodId, changes }: UpdatePeriodVars) =>
      updatePeriod(userId, periodId, changes),

    onMutate: async ({ userId, periodId, changes }: UpdatePeriodVars) => {
      const key = queryKeys.periods(userId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<PeriodDefinition[]>(key)

      queryClient.setQueryData<PeriodDefinition[]>(
        key,
        (previous ?? []).map((period) =>
          period.id === periodId
            ? {
                ...period,
                ...(changes.startDate !== undefined ? { startDate: changes.startDate } : {}),
                ...(changes.endDate !== undefined ? { endDate: changes.endDate } : {}),
                ...(changes.targetAmount !== undefined
                  ? { targetAmount: changes.targetAmount }
                  : {}),
                ...(changes.label !== undefined ? { label: changes.label ?? null } : {}),
              }
            : period,
        ),
      )
      return { previous }
    },

    onError: (_e, { userId }: UpdatePeriodVars, context) => {
      const previous = snapshotOf<PeriodDefinition[]>(context)
      if (previous) queryClient.setQueryData(queryKeys.periods(userId), previous)
    },

    onSettled: (_d, _e, { userId }: UpdatePeriodVars) => invalidatePeriods(userId),
  })

  queryClient.setMutationDefaults(mutationKeys.deletePeriod, {
    mutationFn: ({ userId, periodId }: DeletePeriodVars) => deletePeriod(userId, periodId),

    onMutate: async ({ userId, periodId }: DeletePeriodVars) => {
      const key = queryKeys.periods(userId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<PeriodDefinition[]>(key)

      queryClient.setQueryData<PeriodDefinition[]>(
        key,
        (previous ?? []).filter((period) => period.id !== periodId),
      )
      // Los pagos no se borran: quedan sin asignar.
      queryClient.setQueryData<Payment[]>(queryKeys.payments(userId), (current) =>
        (current ?? []).map((payment) =>
          payment.periodId === periodId ? { ...payment, periodId: null } : payment,
        ),
      )

      return { previous }
    },

    onError: (_e, { userId }: DeletePeriodVars, context) => {
      const previous = snapshotOf<PeriodDefinition[]>(context)
      if (previous) queryClient.setQueryData(queryKeys.periods(userId), previous)
      invalidatePayments(userId)
    },

    onSettled: (_d, _e, { userId }: DeletePeriodVars) => {
      invalidatePeriods(userId)
      invalidatePayments(userId)
    },
  })

  // --- Pagos ----------------------------------------------------------------

  queryClient.setMutationDefaults(mutationKeys.addPayment, {
    mutationFn: ({ userId, payment }: AddPaymentVars) => insertPayment(userId, payment),

    onMutate: async ({ userId, payment, optimisticId }: AddPaymentVars) => {
      const key = queryKeys.payments(userId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Payment[]>(key)

      const optimistic: Payment = {
        id: optimisticId,
        personId: payment.personId,
        paidOn: payment.paidOn,
        amount: payment.amount,
        note: payment.note ?? null,
        periodId: payment.periodId ?? null,
        createdAt: new Date().toISOString(),
      }
      queryClient.setQueryData<Payment[]>(key, [optimistic, ...(previous ?? [])])

      return { previous }
    },

    onError: (_e, { userId }: AddPaymentVars, context) => {
      const previous = snapshotOf<Payment[]>(context)
      if (previous) queryClient.setQueryData(queryKeys.payments(userId), previous)
    },

    onSettled: (_d, _e, { userId }: AddPaymentVars) => invalidatePayments(userId),
  })

  queryClient.setMutationDefaults(mutationKeys.updatePaymentPeriod, {
    mutationFn: ({ userId, id, periodId }: UpdatePaymentPeriodVars) =>
      updatePaymentPeriod(userId, id, periodId),

    onMutate: async ({ userId, id, periodId }: UpdatePaymentPeriodVars) => {
      const key = queryKeys.payments(userId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Payment[]>(key)
      queryClient.setQueryData<Payment[]>(
        key,
        (previous ?? []).map((payment) => (payment.id === id ? { ...payment, periodId } : payment)),
      )
      return { previous }
    },

    onError: (_e, { userId }: UpdatePaymentPeriodVars, context) => {
      const previous = snapshotOf<Payment[]>(context)
      if (previous) queryClient.setQueryData(queryKeys.payments(userId), previous)
    },

    onSettled: (_d, _e, { userId }: UpdatePaymentPeriodVars) => invalidatePayments(userId),
  })

  queryClient.setMutationDefaults(mutationKeys.deletePayment, {
    mutationFn: ({ userId, id }: DeletePaymentVars) => deletePayment(userId, id),

    onMutate: async ({ userId, id }: DeletePaymentVars) => {
      const key = queryKeys.payments(userId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Payment[]>(key)
      queryClient.setQueryData<Payment[]>(
        key,
        (previous ?? []).filter((payment) => payment.id !== id),
      )
      return { previous }
    },

    onError: (_e, { userId }: DeletePaymentVars, context) => {
      const previous = snapshotOf<Payment[]>(context)
      if (previous) queryClient.setQueryData(queryKeys.payments(userId), previous)
    },

    onSettled: (_d, _e, { userId }: DeletePaymentVars) => invalidatePayments(userId),
  })
}
