import { jsPDF } from 'jspdf'

// A4 portrait, 2 columns x 4 rows = 8 waybill cards per page. Card size works
// out to roughly 90mm x 65mm each, which comfortably fits the waybill fields
// at readable text size. If you want fewer/bigger cards per page, lower COLS
// / ROWS below.
const PAGE_MARGIN = 10 // mm
const COLS = 2
const ROWS = 4
const GUTTER_X = 10 // mm gap between columns
const GUTTER_Y = 6 // mm gap between rows
const LINE_H = 3.6 // mm per text line at the font sizes used below

/**
 * Generates a single downloadable PDF containing one waybill per order,
 * packed as many-per-page as will fit (see COLS/ROWS above), with dashed
 * cut lines between them.
 */
export function generateAllWaybillsPDF(orders, filename = 'bbq-night-waybills') {
  if (!orders || orders.length === 0) return

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  const usableWidth = pageWidth - PAGE_MARGIN * 2
  const usableHeight = pageHeight - PAGE_MARGIN * 2
  const cardWidth = (usableWidth - GUTTER_X * (COLS - 1)) / COLS
  const cardHeight = (usableHeight - GUTTER_Y * (ROWS - 1)) / ROWS
  const perPage = COLS * ROWS

  orders.forEach((order, index) => {
    const posOnPage = index % perPage
    if (index > 0 && posOnPage === 0) doc.addPage()

    const col = posOnPage % COLS
    const row = Math.floor(posOnPage / COLS)
    const x = PAGE_MARGIN + col * (cardWidth + GUTTER_X)
    const y = PAGE_MARGIN + row * (cardHeight + GUTTER_Y)

    drawWaybillCard(doc, order, x, y, cardWidth, cardHeight)
  })

  const stamp = new Date().toISOString().slice(0, 10)
  doc.save(`${filename}-${stamp}.pdf`)
}

function drawWaybillCard(doc, order, x, y, w, h) {
  // Dashed cut-line border around each card.
  doc.setDrawColor(160)
  doc.setLineDashPattern([1.2, 1], 0)
  doc.rect(x, y, w, h)
  doc.setLineDashPattern([], 0)

  const pad = 4
  let cursorY = y + pad + 5

  // Order/ticket number — bold, all caps, at the very top of the card,
  // replacing what used to be a plain "WAYBILL" heading.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(20)
  doc.text(String(order.ticket_number).toUpperCase(), x + w / 2, cursorY, { align: 'center' })
  cursorY += 4.5

  doc.setDrawColor(210)
  doc.line(x + pad, cursorY, x + w - pad, cursorY)
  cursorY += 4

  doc.setFontSize(8)
  const fieldWidth = w - pad * 2

  cursorY = drawField(doc, 'Name', order.name, x + pad, cursorY, fieldWidth)
  cursorY = drawField(doc, 'Contact No.', order.mobile || '-', x + pad, cursorY, fieldWidth)
  cursorY = drawField(doc, 'Department', order.department || '-', x + pad, cursorY, fieldWidth)
  cursorY = drawField(doc, 'Section/Position', order.section || '-', x + pad, cursorY, fieldWidth)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20)
  doc.text('Order:', x + pad, cursorY)
  cursorY += LINE_H

  doc.setFont('helvetica', 'normal')
  const orderText =
    (order.items || []).map((it) => `${it.name} x${it.qty}`).join(', ') || '-'
  const wrapped = doc.splitTextToSize(orderText, fieldWidth)
  const bottomLimit = y + h - pad
  const maxLines = Math.max(1, Math.floor((bottomLimit - cursorY) / LINE_H))
  const shown = wrapped.slice(0, maxLines)
  if (wrapped.length > shown.length && shown.length > 0) {
    const last = shown[shown.length - 1]
    shown[shown.length - 1] = last.slice(0, Math.max(0, last.length - 3)) + '...'
  }
  doc.text(shown, x + pad, cursorY)
}

function drawField(doc, label, value, x, y, width) {
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20)
  const labelText = `${label}: `
  doc.text(labelText, x, y)
  const labelWidth = doc.getTextWidth(labelText)

  doc.setFont('helvetica', 'normal')
  const valueLines = doc.splitTextToSize(String(value), width - labelWidth)
  doc.text(valueLines[0] || '', x + labelWidth, y)

  let nextY = y + LINE_H
  if (valueLines.length > 1) {
    doc.text(valueLines.slice(1), x, nextY)
    nextY += (valueLines.length - 1) * LINE_H
  }
  return nextY + 0.8
}
