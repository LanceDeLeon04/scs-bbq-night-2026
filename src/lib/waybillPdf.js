import { jsPDF } from 'jspdf'
import { MENU } from './menu.js'

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

  // Page 1: per-item totals across every order in this batch, so whoever is
  // prepping/cutting/packing has one place to check "how many sticks of
  // what" without tallying every individual waybill by hand.
  drawSummaryPage(doc, orders, pageWidth)
  doc.addPage()

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

// Tallies quantity per menu item across all orders in the batch. Looks up
// the unit (pc vs bottle) from MENU by item id so "1.5L Coke" reads in
// bottles while everything else reads in pcs, even though the order record
// itself doesn't store a unit.
function computeItemTotals(orders) {
  const totals = new Map()

  orders.forEach((order) => {
    ;(order.items || []).forEach((it) => {
      const key = it.id || it.name
      const menuEntry = MENU.find((m) => m.id === it.id)
      const unitLabel = menuEntry?.unit === 'bottle' ? 'bottles' : 'pcs'

      const existing = totals.get(key)
      if (existing) {
        existing.qty += Number(it.qty) || 0
      } else {
        totals.set(key, { name: it.name, qty: Number(it.qty) || 0, unit: unitLabel })
      }
    })
  })

  // Preserve MENU order where possible so the summary lists items in the
  // same order they appear on the order form, with any unrecognized items
  // (e.g. old/renamed items) appended after.
  const menuOrderIndex = new Map(MENU.map((m, i) => [m.name, i]))
  return Array.from(totals.values()).sort((a, b) => {
    const ai = menuOrderIndex.has(a.name) ? menuOrderIndex.get(a.name) : MENU.length
    const bi = menuOrderIndex.has(b.name) ? menuOrderIndex.get(b.name) : MENU.length
    return ai - bi
  })
}

function drawSummaryPage(doc, orders, pageWidth) {
  const totals = computeItemTotals(orders)
  const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0)
  const leftX = PAGE_MARGIN + 10
  const rightX = pageWidth - PAGE_MARGIN - 10

  let cursorY = 28

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(20)
  doc.text('Order Summary', pageWidth / 2, cursorY, { align: 'center' })
  cursorY += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(110)
  const stamp = new Date().toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  doc.text(
    `Generated ${stamp} · ${orders.length} order${orders.length === 1 ? '' : 's'}`,
    pageWidth / 2,
    cursorY,
    { align: 'center' }
  )
  cursorY += 14

  doc.setDrawColor(180)
  doc.line(leftX, cursorY, rightX, cursorY)
  cursorY += 7

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(20)
  doc.text('Item', leftX, cursorY)
  doc.text('Total Quantity', rightX, cursorY, { align: 'right' })
  cursorY += 3
  doc.setDrawColor(210)
  doc.line(leftX, cursorY, rightX, cursorY)
  cursorY += 9

  doc.setFontSize(12)
  totals.forEach((t) => {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(20)
    doc.text(t.name, leftX, cursorY)

    doc.setFont('helvetica', 'bold')
    doc.text(`${t.qty} ${t.unit}`, rightX, cursorY, { align: 'right' })

    cursorY += 8
  })

  cursorY += 3
  doc.setDrawColor(180)
  doc.line(leftX, cursorY, rightX, cursorY)
  cursorY += 9

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(20)
  doc.text('Total Revenue', leftX, cursorY)
  doc.text(
    `PHP ${totalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
    rightX,
    cursorY,
    { align: 'right' }
  )
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
