import { useMutation, useQuery } from '@tanstack/react-query'
import { fetchPeople } from './api'
import { mutationKeys, queryKeys } from '@/lib/queryKeys'
import type { CreatePersonVars, DeletePersonVars, UpdatePersonVars } from '@/lib/mutationDefaults'
import type { NewPerson, Person } from '@/types/domain'

export function usePeople(userId: string) {
  return useQuery<Person[]>({
    queryKey: queryKeys.people(userId),
    queryFn: () => fetchPeople(userId),
    enabled: Boolean(userId),
  })
}

export function useCreatePerson(userId: string) {
  const mutation = useMutation<Person, Error, CreatePersonVars>({
    mutationKey: mutationKeys.createPerson,
  })

  return {
    ...mutation,
    createPerson: (person: NewPerson) => mutation.mutateAsync({ userId, person }),
  }
}

export function useUpdatePerson(userId: string) {
  const mutation = useMutation<Person, Error, UpdatePersonVars>({
    mutationKey: mutationKeys.updatePerson,
  })

  return {
    ...mutation,
    updatePerson: (personId: string, changes: UpdatePersonVars['changes']) =>
      mutation.mutateAsync({ userId, personId, changes }),
  }
}

export function useDeletePerson(userId: string) {
  const mutation = useMutation<void, Error, DeletePersonVars>({
    mutationKey: mutationKeys.deletePerson,
  })

  return {
    ...mutation,
    deletePerson: (personId: string) => mutation.mutateAsync({ userId, personId }),
  }
}
