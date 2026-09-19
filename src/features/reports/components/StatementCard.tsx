import { useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { TrackingResult } from '@/features/tracking/domain'
import { useIssuerSettings } from '@/features/issuer/hooks'
import { describeStatementError } from '../errors'
import type { IssuerSettings, Payment, Person, Receipt } from '@/types/domain'
import styles from '../reports.module.css'

/** Un reintento cubre el caso de una descarga cortada por la red. */
async function loadGenerator() {
  try {
    return await import('../statementPdf')
  } catch {
    return await import('../statementPdf')
  }
}

interface StatementCardProps {
  person: Person
  tracking: TrackingResult
  payments: Payment[]
  receiptsByPayment: Map<string, Receipt[]>
  userId: string
}

/**
 * Genera el estado de cuenta en PDF para mostrarselo al cliente.
 * El generador se carga solo al pulsar el boton: jsPDF pesa mas que la app.
 */
export function StatementCard({
  person,
  tracking,
  payments,
  receiptsByPayment,
  userId,
}: StatementCardProps) {
  const { issuer } = useIssuerSettings(userId)

  const [includeReceipts, setIncludeReceipts] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ fileName: string; notEmbedded: string[] } | null>(null)

  const totalReceipts = payments.reduce(
    (total, payment) => total + (receiptsByPayment.get(payment.id)?.length ?? 0),
    0,
  )
  const withoutReceipt = payments.filter(
    (payment) => (receiptsByPayment.get(payment.id)?.length ?? 0) === 0,
  ).length

  // Sin comprobantes no hay nada que anexar, aunque la casilla siga marcada.
  const willIncludeReceipts = includeReceipts && totalReceipts > 0

  async function handleDownload() {
    if (busy) return
    setBusy(true)
    setError(null)
    setDone(null)
    setProgress('Preparando...')

    try {
      const { generateStatementPdf } = await loadGenerator()
      const result = await generateStatementPdf({
        person,
        issuer: issuer as IssuerSettings,
        tracking,
        payments,
        receiptsByPayment,
        generatedAt: new Date(),
        includeReceipts: willIncludeReceipts,
        onProgress: setProgress,
      })
      setDone(result)
    } catch (caught) {
      setError(describeStatementError(caught))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <Card title="Estado de cuenta en PDF">
      <p className={styles.intro}>
        Un documento con el resumen, el detalle periodo por periodo, el historial de pagos y los
        comprobantes anexos. Es el soporte para mostrarle al cliente como va.
      </p>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={willIncludeReceipts}
          disabled={busy || totalReceipts === 0}
          onChange={(event) => setIncludeReceipts(event.target.checked)}
        />
        <span>
          Anexar los comprobantes
          {totalReceipts > 0 ? ` (${totalReceipts} archivo${totalReceipts === 1 ? '' : 's'})` : ' (aun no hay ninguno)'}
        </span>
      </label>

      <Button loading={busy} onClick={() => void handleDownload()}>
        Descargar PDF
      </Button>

      {progress && <p className={styles.progress}>{progress}</p>}

      {withoutReceipt > 0 && (
        <Alert tone="warning">
          {withoutReceipt} pago{withoutReceipt === 1 ? '' : 's'} sin comprobante. Son justo los que
          no podrias sustentar si el cliente los discute.
        </Alert>
      )}

      {done && (
        <Alert tone="success">
          Listo: {done.fileName}
          {done.notEmbedded.length > 0 &&
            `. No se pudieron incrustar ${done.notEmbedded.length} archivo(s): ${done.notEmbedded.join('; ')}`}
        </Alert>
      )}

      {error && <Alert tone="error">{error}</Alert>}
    </Card>
  )
}
