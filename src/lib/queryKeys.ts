/** Claves de cache centralizadas para evitar strings sueltos por el codigo. */
export const queryKeys = {
  people: (userId: string) => ['people', userId] as const,
  periods: (userId: string) => ['periods', userId] as const,
  payments: (userId: string) => ['payments', userId] as const,
  receipts: (userId: string) => ['receipts', userId] as const,
  issuer: (userId: string) => ['issuer', userId] as const,
} as const

export const mutationKeys = {
  createPerson: ['people', 'create'] as const,
  updatePerson: ['people', 'update'] as const,
  deletePerson: ['people', 'delete'] as const,
  createPeriods: ['periods', 'create'] as const,
  updatePeriod: ['periods', 'update'] as const,
  deletePeriod: ['periods', 'delete'] as const,
  addPayment: ['payments', 'add'] as const,
  updatePaymentPeriod: ['payments', 'period'] as const,
  deletePayment: ['payments', 'delete'] as const,
  saveIssuer: ['issuer', 'save'] as const,
} as const
