import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchIssuerSettings, saveIssuerSettings } from './api'
import { queryKeys } from '@/lib/queryKeys'
import { EMPTY_ISSUER } from '@/types/domain'
import type { IssuerSettings } from '@/types/domain'

export function useIssuerSettings(userId: string) {
  const query = useQuery<IssuerSettings>({
    queryKey: queryKeys.issuer(userId),
    queryFn: () => fetchIssuerSettings(userId),
    enabled: Boolean(userId),
  })

  return { ...query, issuer: query.data ?? EMPTY_ISSUER }
}

export function useSaveIssuerSettings(userId: string) {
  const queryClient = useQueryClient()

  const mutation = useMutation<IssuerSettings, Error, IssuerSettings>({
    mutationFn: (settings) => saveIssuerSettings(userId, settings),

    onMutate: async (settings) => {
      const key = queryKeys.issuer(userId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<IssuerSettings>(key)
      queryClient.setQueryData<IssuerSettings>(key, settings)
      return { previous }
    },

    onError: (_error, _settings, context) => {
      const previous = (context as { previous?: IssuerSettings } | undefined)?.previous
      if (previous) queryClient.setQueryData(queryKeys.issuer(userId), previous)
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.issuer(userId) })
    },
  })

  return { ...mutation, saveIssuer: (settings: IssuerSettings) => mutation.mutateAsync(settings) }
}
