import { useEffect, useRef, useState } from 'react'
import {
  X, Search, Loader2, AlertTriangle, XCircle,
  CheckCircle2, PackageCheck, ArrowLeft, ChevronRight,
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'

const AUTO_NEXT_MS = 3000

/**
 * Full dispatch workflow, run inside a modal:
 *   Type the guest's name or order (ticket) ID
 *     -> look up the order
 *     -> block if payment isn't validated yet
 *     -> block (with notice) if it was already claimed
 *     -> otherwise show order details + a Dispatch button
 *     -> Dispatch marks it claimed, shows a confirmation banner with a
 *        "Next" button. If the admin doesn't press it, the modal
 *        automatically resets to search for the next guest after 3 seconds.
 */
export default function DispatchModal({ orders, onClose, onDispatched }) {
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState(null) // null = no search yet
  const [selected, setSelected] = useState(null) // chosen order
  const [dispatching, setDispatching] = useState(false)
  const [dispatchedInfo, setDispatchedInfo] = useState(null)
  const [dispatchError, setDispatchError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [])

  const runLookup = (raw) => {
    const q = raw
    setQuery(q)
    setDispatchedInfo(null)
    setSelected(null)
    const trimmed = q.trim()
    if (!trimmed) {
      setMatches(null)
      return
    }
    const needle = trimmed.toLowerCase()
    // Exact order ID (ticket number) match wins outright.
    const exactTicket = orders.find((o) => o.ticket_number.toLowerCase() === needle)
    if (exactTicket) {
      setMatches([exactTicket])
      setSelected(exactTicket)
      return
    }
    const found = orders.filter(
      (o) =>
        o.ticket_number.toLowerCase().includes(needle) ||
        o.name.toLowerCase().includes(needle) ||
        o.id_no.toLowerCase().includes(needle) ||
        (o.mobile || '').toLowerCase().includes(needle) ||
        (o.email || '').toLowerCase().includes(needle)
    )
    setMatches(found)
    if (found.length === 1) setSelected(found[0])
  }

  const reset = () => {
    setQuery('')
    setMatches(null)
    setSelected(null)
    setDispatchedInfo(null)
    setDispatchError('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const dispatchOrder = async (order) => {
    setDispatching(true)
    setDispatchError('')
    const claimedAt = new Date().toISOString()
    let { error } = await supabase
      .from('orders')
      .update({ claimed: true, claimed_at: claimedAt })
      .eq('id', order.id)

    // Older projects that haven't re-run schema.sql won't have claimed_at yet —
    // fall back so dispatching still works instead of failing outright.
    if (error) {
      const retry = await supabase.from('orders').update({ claimed: true }).eq('id', order.id)
      error = retry.error
    }

    setDispatching(false)
    if (error) {
      setDispatchError(`Couldn't mark this order as claimed: ${error.message}`)
      return
    }

    const updated = { ...order, claimed: true, claimed_at: claimedAt }
    onDispatched(updated)
    setDispatchedInfo(updated)
    setSelected(null)
    setMatches(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="glass-strong animate-rise flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-2">
            <Search size={18} className="text-ember-500" />
            <h2 className="font-display text-base font-semibold text-smoke-200">
              Dispatch Order
            </h2>
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
          {!dispatchedInfo && (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-smoke-500" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => runLookup(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') runLookup(query)
                }}
                placeholder="Type name or order ID"
                className="input pl-9"
                autoComplete="off"
              />
            </div>
          )}

          {dispatchError && (
            <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {dispatchError}
            </div>
          )}

          {/* Results */}
          <div className="mt-4">
            {dispatchedInfo && (
              <DispatchedBanner order={dispatchedInfo} onNext={reset} />
            )}

            {!dispatchedInfo && matches && matches.length === 0 && (
              <EmptyState message={`No order found matching "${query}".`} />
            )}

            {!dispatchedInfo && matches && matches.length > 1 && !selected && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-smoke-500">
                  {matches.length} matches — pick one
                </p>
                {matches.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSelected(o)}
                    className="ember-ring flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left transition hover:border-ember-500/40"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-smoke-300">{o.name}</span>
                    <span className="font-mono text-xs text-ember-400">{o.ticket_number}</span>
                  </button>
                ))}
              </div>
            )}

            {!dispatchedInfo && selected && (
              <OrderPreview
                order={selected}
                dispatching={dispatching}
                onBack={() => {
                  if (matches && matches.length > 1) {
                    setSelected(null)
                  } else {
                    setSelected(null)
                    setMatches(null)
                  }
                }}
                onDispatch={() => dispatchOrder(selected)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      <XCircle size={16} className="mt-0.5 shrink-0" />
      {message}
    </div>
  )
}

function OrderPreview({ order, dispatching, onBack, onDispatch }) {
  if (!order.validated) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Payment not validated yet</p>
            <p className="mt-0.5 text-amber-300/80">
              {order.name} ({order.ticket_number}) can't be dispatched until an admin
              validates their payment.
            </p>
          </div>
        </div>
        <BackButton onClick={onBack} />
      </div>
    )
  }

  if (order.claimed) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-smoke-300">
          <PackageCheck size={16} className="mt-0.5 shrink-0 text-ember-500" />
          <div>
            <p className="font-medium text-smoke-200">Already claimed</p>
            <p className="mt-0.5 text-smoke-500">
              {order.name} ({order.ticket_number}) was already marked as dispatched
              {order.claimed_at
                ? ` on ${new Date(order.claimed_at).toLocaleString()}`
                : ''}
              .
            </p>
          </div>
        </div>
        <BackButton onClick={onBack} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="font-mono text-sm font-semibold text-ember-400">
            {order.ticket_number}
          </span>
          <span className="rounded-full bg-ember-600/15 px-2 py-0.5 text-[11px] font-medium text-ember-400">
            Validated
          </span>
        </div>
        <p className="text-sm font-medium text-smoke-200">{order.name}</p>
        <p className="text-xs text-smoke-500">
          {order.department}
          {order.department ? ' · ' : ''}
          {order.section}
        </p>
        <p className="mt-1 text-xs text-smoke-500">ID No.: {order.id_no}</p>

        <div className="my-3 h-px bg-white/[0.06]" />
        <div className="space-y-1">
          {(order.items || []).map((it) => (
            <div key={it.id} className="flex items-center justify-between text-sm">
              <span className="text-smoke-400">
                {it.name} × {it.qty}
              </span>
              <span className="font-mono text-smoke-300">₱{it.subtotal.toFixed(0)}</span>
            </div>
          ))}
        </div>
        <div className="my-3 h-px bg-white/[0.06]" />
        <div className="flex items-center justify-between text-sm font-semibold">
          <span className="text-smoke-400">Total</span>
          <span className="text-ember-gradient font-display">₱{Number(order.total).toFixed(0)}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <BackButton onClick={onBack} />
        <button
          type="button"
          onClick={onDispatch}
          disabled={dispatching}
          className="btn-primary flex flex-1 items-center justify-center gap-2"
        >
          {dispatching ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <PackageCheck size={16} />
          )}
          Dispatch Order
        </button>
      </div>
    </div>
  )
}

function DispatchedBanner({ order, onNext }) {
  const [countdown, setCountdown] = useState(AUTO_NEXT_MS / 1000)

  useEffect(() => {
    // Auto-advance to the next order after AUTO_NEXT_MS unless the admin
    // presses "Next" first.
    const start = Date.now()
    const tick = setInterval(() => {
      const remaining = Math.max(0, AUTO_NEXT_MS - (Date.now() - start))
      setCountdown(Math.ceil(remaining / 1000))
    }, 200)
    const timeout = setTimeout(() => {
      onNext()
    }, AUTO_NEXT_MS)
    return () => {
      clearInterval(tick)
      clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5 rounded-xl border border-ember-600/30 bg-ember-600/10 px-4 py-3.5 text-sm text-ember-300">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-ember-200">Marked as Claimed</p>
          <p className="mt-0.5 text-ember-300/80">
            {order.name} ({order.ticket_number}) has been dispatched.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onNext}
        className="btn-primary flex w-full items-center justify-center gap-2"
      >
        <ChevronRight size={16} />
        Next{countdown > 0 ? ` (auto in ${countdown}s)` : ''}
      </button>
    </div>
  )
}

function BackButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ember-ring flex items-center justify-center gap-1.5 rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-smoke-400 transition hover:border-white/20"
    >
      <ArrowLeft size={15} />
      Back
    </button>
  )
}
