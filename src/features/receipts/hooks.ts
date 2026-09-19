import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteReceipt, fetchReceipts, uploadReceipt } from './api'
import { queryKeys } from '@/lib/queryKeys'
import type { Receipt } from '@/types/domain'

/** Todos los comprobantes del usuario. Son pocos y siempre se leen juntos. */
export function useReceipts(userId: string) {
  return useQuery<Receipt[]>({
    queryKey: queryKeys.receipts(userId),
    queryFn: () => fetchReceipts(userId),
    enabled: Boolean(userId),
  })
}

/** Agrupa los comprobantes por pago una sola vez por cambio de datos. */
export function useReceiptsByPayment(receipts: Receipt[] | undefined): Map<string, Receipt[]> {
  return useMemo(() => {
    const grouped = new Map<string, Receipt[]>()
    for (const receipt of receipts ?? []) {
      const list = grouped.get(receipt.paymentId)
      if (list) list.push(receipt)
      else grouped.set(receipt.paymentId, [receipt])
    }
    return grouped
  }, [receipts])
}

interface UploadVars {
  personId: string
  paymentId: string
  files: File[]
}

/**
 * Sube comprobantes.
 *
 * A diferencia del resto de mutaciones, esta NO se registra en
 * `mutationDefaults`: un `File` no se puede serializar en la cache persistida,
 * asi que no tiene sentido dejarla en pausa para reenviarla al reconectar.
 * `networkMode: 'always'` evita que quede colgada esperando conexion.
 */
export function useUploadReceipts(userId: string) {
  const queryClient = useQueryClient()

  const mutation = useMutation<Receipt[], Error, UploadVars>({
    networkMode: 'always',
    mutationFn: async ({ personId, paymentId, files }) => {
      const uploaded: Receipt[] = []
      for (const file of files) {
        uploaded.push(await uploadReceipt(userId, personId, paymentId, file))
      }
      return uploaded
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.receipts(userId) })
    },
  })

  return {
    ...mutation,
    uploadReceipts: (personId: string, paymentId: string, files: File[]) =>
      mutation.mutateAsync({ personId, paymentId, files }),
  }
}

export function useDeleteReceipt(userId: string) {
  const queryClient = useQueryClient()

  const mutation = useMutation<void, Error, Receipt>({
    networkMode: 'always',
    mutationFn: (receipt) => deleteReceipt(userId, receipt),

    onMutate: async (receipt) => {
      const key = queryKeys.receipts(userId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Receipt[]>(key)
      queryClient.setQueryData<Receipt[]>(
        key,
        (previous ?? []).filter((item) => item.id !== receipt.id),
      )
      return { previous }
    },

    onError: (_error, _receipt, context) => {
      const previous = (context as { previous?: Receipt[] } | undefined)?.previous
      if (previous) queryClient.setQueryData(queryKeys.receipts(userId), previous)
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.receipts(userId) })
    },
  })

  return { ...mutation, removeReceipt: (receipt: Receipt) => mutation.mutateAsync(receipt) }
}
