import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { cx } from '@/lib/cx'
import { formatBytes, validateReceiptFiles } from '@/lib/validation'
import { LIMITS, RECEIPT_MIME_TYPES } from '@/types/domain'
import type { Receipt } from '@/types/domain'
import { signedUrlFor } from '../api'
import { useDeleteReceipt, useUploadReceipts } from '../hooks'
import styles from '../receipts.module.css'

interface ReceiptsPanelProps {
  userId: string
  personId: string
  paymentId: string
  receipts: Receipt[]
  /** Un pago recien creado sin conexion aun no existe en el servidor. */
  disabled?: boolean
}

function isPdf(receipt: Receipt): boolean {
  return receipt.mimeType === 'application/pdf'
}

/**
 * Comprobantes de un pago: lista, subida y borrado.
 *
 * Los archivos estan en un bucket privado, asi que "Ver" pide una URL firmada
 * en el momento; no hay ningun enlace permanente.
 */
export function ReceiptsPanel({
  userId,
  personId,
  paymentId,
  receipts,
  disabled = false,
}: ReceiptsPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)

  const { uploadReceipts, isPending: uploading } = useUploadReceipts(userId)
  const { removeReceipt } = useDeleteReceipt(userId)

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (inputRef.current) inputRef.current.value = ''
    if (files.length === 0) return

    const problem = validateReceiptFiles(files)
    if (problem) {
      setError(problem)
      return
    }

    setError(null)
    try {
      await uploadReceipts(personId, paymentId, files)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo subir el comprobante.')
    }
  }

  async function handleOpen(receipt: Receipt) {
    setOpeningId(receipt.id)
    setError(null)
    try {
      const url = await signedUrlFor(receipt.storagePath)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo abrir el comprobante.')
    } finally {
      setOpeningId(null)
    }
  }

  async function handleRemove(receipt: Receipt) {
    setError(null)
    try {
      await removeReceipt(receipt)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo eliminar el comprobante.')
    }
  }

  return (
    <details className={styles.panel}>
      <summary className={styles.summary}>
        Comprobantes
        <span className={cx(styles.badge, receipts.length === 0 && styles.badgeEmpty)}>
          {receipts.length === 0 ? 'sin soporte' : receipts.length}
        </span>
      </summary>

      {receipts.length > 0 && (
        <ul className={styles.list}>
          {receipts.map((receipt) => (
            <li key={receipt.id} className={styles.item}>
              <span className={cx(styles.icon, isPdf(receipt) && styles.iconPdf)} aria-hidden="true">
                {isPdf(receipt) ? 'PDF' : 'IMG'}
              </span>

              <span className={styles.meta}>
                <span className={styles.name}>{receipt.fileName}</span>
                <span className={styles.size}>{formatBytes(receipt.sizeBytes)}</span>
              </span>

              <button
                type="button"
                className={styles.link}
                disabled={openingId === receipt.id}
                onClick={() => void handleOpen(receipt)}
              >
                {openingId === receipt.id ? 'Abriendo...' : 'Ver'}
              </button>

              <button
                type="button"
                className={styles.remove}
                aria-label={`Eliminar el comprobante ${receipt.fileName}`}
                onClick={() => void handleRemove(receipt)}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.dropzone}>
        <input
          ref={inputRef}
          type="file"
          multiple
          className={styles.fileInput}
          accept={RECEIPT_MIME_TYPES.join(',')}
          disabled={disabled || uploading}
          aria-label="Adjuntar comprobantes"
          onChange={(event) => void handleFiles(event)}
        />
        <p className={styles.hint}>
          {uploading
            ? 'Subiendo...'
            : disabled
              ? 'Espera a que el pago termine de sincronizarse.'
              : `Imagen o PDF, hasta ${formatBytes(LIMITS.maxReceiptBytes)} por archivo.`}
        </p>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>
    </details>
  )
}
