import { X, Printer, FileText } from 'lucide-react'

/**
 * Shows a printable waybill for a single order (Name, Contact No.,
 * Department, Section/Position, Order). "Print" opens the browser's print
 * dialog scoped to just the waybill sheet via the .waybill-print-area /
 * print:only-print rules in index.css, so admins can print it directly or
 * save it as a PDF from the print dialog — no extra dependency needed.
 */
export default function WaybillModal({ order, onClose }) {
  const orderLines = (order.items || []).map((it) => `${it.name} x${it.qty}`)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm print:static print:bg-transparent print:backdrop-blur-none sm:items-center sm:p-4">
      <div className="glass-strong animate-rise flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl print:max-h-none print:rounded-none print:border-none print:bg-transparent print:shadow-none sm:max-w-md sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 print:hidden">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-ember-500" />
            <h2 className="font-display text-base font-semibold text-smoke-200">Waybill</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ember-ring rounded-full p-1.5 text-smoke-500 transition hover:bg-white/5 hover:text-smoke-300"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* This is the only part visible when printing. */}
          <div className="waybill-print-area rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 print:border-black print:bg-white print:p-8 print:text-black">
            <h3 className="mb-4 text-center font-display text-lg font-bold uppercase tracking-wide text-smoke-200 print:text-black">
              Waybill
            </h3>
            <dl className="space-y-3 text-sm">
              <WaybillField label="Name" value={order.name} />
              <WaybillField label="Contact No." value={order.mobile || '—'} />
              <WaybillField label="Department" value={order.department || '—'} />
              <WaybillField label="Section/Position" value={order.section || '—'} />
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-smoke-500 print:text-black">
                  Order
                </dt>
                <dd className="mt-1 border-b border-dotted border-white/20 pb-2 text-smoke-200 print:border-black print:text-black">
                  {orderLines.length > 0 ? (
                    <ul className="space-y-0.5">
                      {orderLines.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
            </dl>
            <p className="mt-5 text-center font-mono text-xs text-smoke-500 print:text-black">
              Ticket: {order.ticket_number}
            </p>
          </div>
        </div>

        <div className="flex gap-2 border-t border-white/[0.06] px-5 py-4 print:hidden">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Close
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-primary flex flex-1 items-center justify-center gap-2"
          >
            <Printer size={16} />
            Print Waybill
          </button>
        </div>
      </div>
    </div>
  )
}

function WaybillField({ label, value }) {
  return (
    <div className="flex items-baseline gap-2 border-b border-dotted border-white/20 pb-1.5 print:border-black">
      <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-smoke-500 print:text-black">
        {label}:
      </dt>
      <dd className="min-w-0 flex-1 text-smoke-200 print:text-black">{value}</dd>
    </div>
  )
}
