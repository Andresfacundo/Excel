import { lanzarErrorBd, supabase } from '@/lib/supabase'
import type { Receipt } from '@/types/domain'
import type { ReceiptRow } from '@/types/database'

/** Bucket privado donde viven los archivos. Nunca se sirve publicamente. */
export const RECEIPTS_BUCKET = 'comprobantes'

/** Cuanto vive una URL firmada, en segundos. */
const SIGNED_URL_TTL = 60 * 10

const COLUMNS =
  'id, user_id, payment_id, storage_path, file_name, mime_type, size_bytes, created_at, updated_at'

function toReceipt(row: ReceiptRow): Receipt {
  return {
    id: row.id,
    paymentId: row.payment_id,
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    createdAt: row.created_at,
  }
}

/** Extension a partir del nombre original, o del tipo MIME si no trae. */
function extensionFor(file: File): string {
  const fromName = file.name.includes('.') ? file.name.split('.').pop() : null
  if (fromName && /^[a-zA-Z0-9]{1,8}$/.test(fromName)) return fromName.toLowerCase()

  const fromMime: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'application/pdf': 'pdf',
  }
  return fromMime[file.type] ?? 'bin'
}

/** Recorta el nombre original para que quepa en la columna. */
function safeFileName(name: string): string {
  const trimmed = name.trim() || 'comprobante'
  return trimmed.length > 200 ? trimmed.slice(-200) : trimmed
}

export async function fetchReceipts(userId: string): Promise<Receipt[]> {
  const { data, error } = await supabase
    .from('receipts')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) lanzarErrorBd(error)
  return (data ?? []).map(toReceipt)
}

/**
 * Sube el archivo al bucket privado y registra su metadato.
 *
 * La ruta empieza por el id del usuario porque las politicas de storage
 * comprueban justo ese primer segmento: nadie puede escribir ni leer fuera de
 * su propia carpeta.
 */
export async function uploadReceipt(
  userId: string,
  personId: string,
  paymentId: string,
  file: File,
): Promise<Receipt> {
  const path = `${userId}/${personId}/${paymentId}/${crypto.randomUUID()}.${extensionFor(file)}`

  const { error: uploadError } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    throw new Error(
      uploadError.message === 'The resource already exists'
        ? 'Ya existe un archivo con ese nombre. Intenta de nuevo.'
        : `No se pudo subir el archivo: ${uploadError.message}`,
    )
  }

  const { data, error } = await supabase
    .from('receipts')
    .insert({
      user_id: userId,
      payment_id: paymentId,
      storage_path: path,
      file_name: safeFileName(file.name),
      mime_type: file.type,
      size_bytes: file.size,
    })
    .select(COLUMNS)
    .single()

  if (error) {
    // Si el metadato no entra, el archivo suelto no debe quedarse en el bucket.
    await supabase.storage.from(RECEIPTS_BUCKET).remove([path])
    lanzarErrorBd(error)
  }

  return toReceipt(data)
}

/** URL temporal para ver o descargar el comprobante. */
export async function signedUrlFor(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL)

  if (error) throw new Error(`No se pudo abrir el comprobante: ${error.message}`)
  return data.signedUrl
}

/** Descarga el contenido del comprobante (se usa para anexarlo al PDF). */
export async function downloadReceipt(storagePath: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(RECEIPTS_BUCKET).download(storagePath)
  if (error) throw new Error(`No se pudo descargar el comprobante: ${error.message}`)
  return data
}

/** Borra el metadato y el archivo. Si el archivo ya no esta, no es un error. */
export async function deleteReceipt(userId: string, receipt: Receipt): Promise<void> {
  const { error } = await supabase
    .from('receipts')
    .delete()
    .eq('id', receipt.id)
    .eq('user_id', userId)

  if (error) lanzarErrorBd(error)

  await supabase.storage.from(RECEIPTS_BUCKET).remove([receipt.storagePath])
}
