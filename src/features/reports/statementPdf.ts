/**
 * Generacion del PDF de estado de cuenta.
 *
 * jsPDF y su plugin de tablas se cargan con `import()` dinamico: pesan mas que
 * toda la app junta y solo hacen falta cuando alguien pulsa "Descargar PDF".
 *
 * Las imagenes de los comprobantes se pasan por un canvas antes de incrustarse,
 * porque jsPDF solo entiende JPEG y PNG; asi tambien entran los WEBP. Un HEIC
 * que el navegador no sepa decodificar se lista pero no se incrusta, y el PDF
 * lo dice en vez de fallar.
 */

import { downloadReceipt } from '@/features/receipts/api'
import { buildStatement, paymentTableHeaders, periodTableHeaders, statementFileName } from './statementData'
import type { StatementInput } from './statementData'

const MARGIN = 14
const COLORS = {
  primary: [26, 115, 232] as [number, number, number],
  text: [28, 28, 30] as [number, number, number],
  muted: [122, 128, 138] as [number, number, number],
  danger: [220, 38, 38] as [number, number, number],
  panel: [239, 244, 254] as [number, number, number],
}

/** Convierte una imagen a JPEG para que jsPDF pueda incrustarla. */
async function toJpegDataUrl(
  blob: Blob,
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(blob)
    // Se acota el lado mayor: un PDF con fotos de 12 MP no lo abre nadie.
    const maxSide = 1400
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return null

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    return { dataUrl: canvas.toDataURL('image/jpeg', 0.82), width, height }
  } catch {
    return null
  }
}

export interface StatementOptions extends StatementInput {
  /** Anexar las imagenes de los comprobantes al final. */
  includeReceipts: boolean
  /** Se llama con un mensaje de progreso mientras se arma el PDF. */
  onProgress?: (message: string) => void
}

export interface StatementResult {
  fileName: string
  /** Comprobantes que no se pudieron incrustar (HEIC, PDF, error de red). */
  notEmbedded: string[]
}

export async function generateStatementPdf(options: StatementOptions): Promise<StatementResult> {
  const { includeReceipts, onProgress, ...input } = options
  const model = buildStatement(input)

  onProgress?.('Preparando el documento...')
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const pageWidth = doc.internal.pageSize.getWidth()
  const contentWidth = pageWidth - MARGIN * 2

  let y = MARGIN

  // --- Encabezado -----------------------------------------------------------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...COLORS.primary)
  doc.text(model.title, MARGIN, y + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.muted)
  doc.text(model.generatedLabel, pageWidth - MARGIN, y + 6, { align: 'right' })

  y += 12

  if (model.issuerLines.length > 0) {
    doc.setFontSize(10)
    doc.setTextColor(...COLORS.text)
    doc.setFont('helvetica', 'bold')
    doc.text(model.issuerLines[0] ?? '', MARGIN, y)
    y += 4.5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.muted)
    for (const line of model.issuerLines.slice(1)) {
      doc.text(line, MARGIN, y)
      y += 4
    }
  }

  y += 4

  // --- Cliente --------------------------------------------------------------
  doc.setDrawColor(220, 224, 232)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, y, pageWidth - MARGIN, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.muted)
  doc.text('Cliente', MARGIN, y)
  y += 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...COLORS.text)
  doc.text(model.clientLines[0] ?? '', MARGIN, y)
  y += 5

  if (model.clientLines[1]) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...COLORS.muted)
    doc.text(model.clientLines[1], MARGIN, y)
    y += 5
  }

  y += 3

  // --- Resumen --------------------------------------------------------------
  const boxHeight = 26
  doc.setFillColor(...COLORS.panel)
  doc.roundedRect(MARGIN, y, contentWidth, boxHeight, 2, 2, 'F')

  const cells: Array<{ label: string; value: string; danger?: boolean }> = [
    { label: 'Objetivo total', value: model.totals.objetivo },
    { label: 'Pagado', value: model.totals.pagado },
    { label: 'Pendiente', value: model.totals.pendiente },
    { label: 'Vencido', value: model.totals.vencido, danger: true },
    { label: 'Avance', value: model.totals.avance },
  ]

  const cellWidth = contentWidth / cells.length
  cells.forEach((cell, index) => {
    const x = MARGIN + cellWidth * index + 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.muted)
    doc.text(cell.label, x, y + 9)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...(cell.danger && cell.value !== '$ 0' ? COLORS.danger : COLORS.text))
    doc.text(cell.value, x, y + 17)
  })

  y += boxHeight + 4

  if (model.totals.saldoAFavor) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.muted)
    doc.text(`Saldo a favor sin asignar: ${model.totals.saldoAFavor}`, MARGIN, y + 2)
    y += 6
  }

  // --- Tabla de periodos ----------------------------------------------------
  onProgress?.('Armando la tabla de periodos...')
  autoTable(doc, {
    startY: y + 2,
    head: [periodTableHeaders()],
    body: model.periodRows,
    margin: { left: MARGIN, right: MARGIN },
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.2, textColor: COLORS.text },
    headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 253] },
    // Anchos fijos en los montos: si autoTable los aprieta, parte el "$" del
    // numero y la tabla se vuelve ilegible.
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 26 },
      2: { cellWidth: 26 },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 25, halign: 'right' },
      6: { cellWidth: 23 },
    },
  })

  // --- Tabla de pagos -------------------------------------------------------
  const afterPeriods = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
  autoTable(doc, {
    startY: (afterPeriods?.finalY ?? y) + 8,
    head: [paymentTableHeaders()],
    body:
      model.paymentRows.length > 0
        ? model.paymentRows
        : [['-', '-', '-', 'Sin pagos registrados', '-']],
    margin: { left: MARGIN, right: MARGIN },
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.2, textColor: COLORS.text },
    headStyles: { fillColor: [55, 65, 81], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 253] },
    columnStyles: {
      0: { cellWidth: 36 },
      1: { cellWidth: 28, halign: 'right' },
      2: { cellWidth: 34 },
      4: { cellWidth: 24 },
    },
  })

  // --- Anexo de comprobantes ------------------------------------------------
  const notEmbedded: string[] = []

  if (includeReceipts && model.receipts.length > 0) {
    doc.addPage()
    let annexY = MARGIN

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...COLORS.primary)
    doc.text('Anexo: comprobantes de pago', MARGIN, annexY + 5)
    annexY += 12

    let index = 0
    for (const { receipt, caption } of model.receipts) {
      index += 1
      onProgress?.(`Anexando comprobante ${index} de ${model.receipts.length}...`)

      if (!receipt.mimeType.startsWith('image/')) {
        notEmbedded.push(`${receipt.fileName} (PDF, se conserva en la app)`)
        continue
      }

      let image: Awaited<ReturnType<typeof toJpegDataUrl>> = null
      try {
        image = await toJpegDataUrl(await downloadReceipt(receipt.storagePath))
      } catch {
        image = null
      }

      if (!image) {
        notEmbedded.push(`${receipt.fileName} (el navegador no pudo leer la imagen)`)
        continue
      }

      const maxImageHeight = 200
      const ratio = image.height / image.width
      const drawWidth = contentWidth
      const drawHeight = Math.min(maxImageHeight, drawWidth * ratio)
      const finalWidth = drawHeight === maxImageHeight ? maxImageHeight / ratio : drawWidth

      if (annexY + drawHeight + 12 > doc.internal.pageSize.getHeight() - MARGIN) {
        doc.addPage()
        annexY = MARGIN
      }

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...COLORS.muted)
      doc.text(caption, MARGIN, annexY + 3)
      annexY += 6

      doc.addImage(image.dataUrl, 'JPEG', MARGIN, annexY, finalWidth, drawHeight, undefined, 'FAST')
      annexY += drawHeight + 10
    }

    if (notEmbedded.length > 0) {
      if (annexY + 20 > doc.internal.pageSize.getHeight() - MARGIN) {
        doc.addPage()
        annexY = MARGIN
      }
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...COLORS.text)
      doc.text('Comprobantes no incrustados', MARGIN, annexY + 4)
      annexY += 9

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...COLORS.muted)
      for (const line of notEmbedded) {
        doc.text(`- ${line}`, MARGIN, annexY)
        annexY += 5
      }
    }
  }

  // --- Pie de pagina --------------------------------------------------------
  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    const pageHeight = doc.internal.pageSize.getHeight()

    doc.setDrawColor(228, 231, 238)
    doc.setLineWidth(0.3)
    doc.line(MARGIN, pageHeight - 14, pageWidth - MARGIN, pageHeight - 14)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...COLORS.muted)
    doc.text(model.footerNote, MARGIN, pageHeight - 9, { maxWidth: contentWidth - 30 })
    doc.text(`Pagina ${page} de ${pageCount}`, pageWidth - MARGIN, pageHeight - 9, {
      align: 'right',
    })
  }

  const fileName = statementFileName(input.person, input.generatedAt)
  doc.save(fileName)

  return { fileName, notEmbedded }
}
