import { useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { fetchPayments } from './api'
import { mutationKeys, queryKeys } from '@/lib/queryKeys'
import type {
  AddPaymentVars,
  DeletePaymentVars,
  UpdatePaymentPeriodVars,
} from '@/lib/mutationDefaults'
import type { NewPayment, Payment } from '@/types/domain'

/** Todos los pagos del usuario, de todas las personas. */
export function usePayments(userId: string) {
  return useQuery<Payment[]>({
    queryKey: queryKeys.payments(userId),
    queryFn: () => fetchPayments(userId),
    enabled: Boolean(userId),
  })
}

/** Agrupa los pagos por persona una sola vez por cambio de datos. */
export function usePaymentsByPerson(payments: Payment[] | undefined): Map<string, Payment[]> {
  return useMemo(() => {
    const grouped = new Map<string, Payment[]>()
    for (const payment of payments ?? []) {
      const list = grouped.get(payment.personId)
      if (list) list.push(payment)
      else grouped.set(payment.personId, [payment])
    }
    return grouped
  }, [payments])
}

export function useAddPayment(userId: string) {
  const mutation = useMutation<Payment, Error, AddPaymentVars>({
    mutationKey: mutationKeys.addPayment,
  })

  return {
    ...mutation,
    addPayment: (payment: NewPayment) =>
      mutation.mutateAsync({
        userId,
        payment,
        optimisticId: `temp-${crypto.randomUUID()}`,
      }),
  }
}

export function useUpdatePaymentPeriod(userId: string) {
  const mutation = useMutation<Payment, Error, UpdatePaymentPeriodVars>({
    mutationKey: mutationKeys.updatePaymentPeriod,
  })

  return {
    ...mutation,
    updatePaymentPeriod: (id: string, periodId: string | null) =>
      mutation.mutateAsync({ userId, id, periodId }),
  }
}

export function useDeletePayment(userId: string) {
  const mutation = useMutation<void, Error, DeletePaymentVars>({
    mutationKey: mutationKeys.deletePayment,
  })

  return {
    ...mutation,
    deletePayment: (id: string) => mutation.mutateAsync({ userId, id }),
  }
}
