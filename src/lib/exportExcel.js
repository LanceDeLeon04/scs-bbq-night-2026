import * as XLSX from 'xlsx'

/**
 * Exports the given orders to a downloadable .xlsx file.
 * One row per order, with items flattened into a readable summary column
 * plus a per-item breakdown so totals can still be pivoted in Excel.
 */
export function exportOrdersToExcel(orders, filename = 'bbq-night-orders') {
  const rows = orders.map((o) => ({
    'Ticket Number': o.ticket_number,
    'Name': o.name,
    'ID No.': o.id_no,
    'Mobile': o.mobile || '',
    'Email': o.email || '',
    'Department': o.department || '',
    'Section': o.section,
    'Order Summary': (o.items || [])
      .map((it) => `${it.name} x${it.qty}`)
      .join(', '),
    'Total (₱)': Number(o.total || 0),
    'Validated': o.validated ? 'Yes' : 'No',
    'Claimed': o.claimed ? 'Yes' : 'No',
    'Refunded': o.refunded ? 'Yes' : 'No',
    'Order Date': o.created_at ? new Date(o.created_at).toLocaleString() : '',
  }))

  const sheet = XLSX.utils.json_to_sheet(rows)

  // Reasonable column widths so the export is readable without manual resizing.
  sheet['!cols'] = [
    { wch: 16 }, // Ticket Number
    { wch: 22 }, // Name
    { wch: 14 }, // ID No.
    { wch: 14 }, // Mobile
    { wch: 24 }, // Email
    { wch: 18 }, // Department
    { wch: 14 }, // Section
    { wch: 40 }, // Order Summary
    { wch: 12 }, // Total
    { wch: 10 }, // Validated
    { wch: 10 }, // Claimed
    { wch: 10 }, // Refunded
    { wch: 20 }, // Order Date
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Orders')

  const stamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `${filename}-${stamp}.xlsx`)
}
