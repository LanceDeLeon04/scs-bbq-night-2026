import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LogOut, RefreshCw, CheckCircle2, XCircle, PackageCheck, Package,
  ArrowUpDown, Search, Image as ImageIcon, Loader2, Flame, Users, Wallet,
  Trash2, AlertCircle, Building2, ScanLine, Undo2, FileText, FileSpreadsheet, Files,
} from 'lucide-react'
import GlassCard from '../components/GlassCard.jsx'
import DispatchModal from '../components/DispatchModal.jsx'
import RefundModal from '../components/RefundModal.jsx'
import WaybillModal from '../components/WaybillModal.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { emailPaymentValidated, emailClaimed } from '../lib/email.js'
import { exportOrdersToExcel } from '../lib/exportExcel.js'
import { generateAllWaybillsPDF } from '../lib/waybillPdf.js'

const SORTS = {
  ticket: { label: 'Ticket Number', key: 'ticket_number' },
  item: { label: 'Item', key: '__item' },
  date: { label: 'Newest', key: 'created_at' },
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sortBy, setSortBy] = useState('date')
  const [validationFilter, setValidationFilter] = useState('all') // all | validated | pending
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [sectionFilter, setSectionFilter] = useState('all')
  const [itemFilter, setItemFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [dispatchOpen, setDispatchOpen] = useState(false)
  const [refundOrder, setRefundOrder] = useState(null)
  const [waybillOrder, setWaybillOrder] = useState(null)

  useEffect(() => {
    if (sessionStorage.getItem('scs_bbq_admin') !== 'true') {
      navigate('/admin')
    }
  }, [navigate])

  const fetchOrders = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) setOrders(data)
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const logout = () => {
    sessionStorage.removeItem('scs_bbq_admin')
    navigate('/admin')
  }

  const departments = useMemo(
    () => Array.from(new Set(orders.map((o) => o.department).filter(Boolean))).sort(),
    [orders]
  )
  const sections = useMemo(
    () => Array.from(new Set(orders.map((o) => o.section))).sort(),
    [orders]
  )
  const allItems = useMemo(() => {
    const set = new Set()
    orders.forEach((o) => (o.items || []).forEach((it) => set.add(it.name)))
    return Array.from(set).sort()
  }, [orders])

  const filtered = useMemo(() => {
    let rows = orders

    if (validationFilter === 'validated') rows = rows.filter((o) => o.validated)
    if (validationFilter === 'pending') rows = rows.filter((o) => !o.validated)
    if (departmentFilter !== 'all') rows = rows.filter((o) => o.department === departmentFilter)
    if (sectionFilter !== 'all') rows = rows.filter((o) => o.section === sectionFilter)
    if (itemFilter !== 'all') {
      rows = rows.filter((o) => (o.items || []).some((it) => it.name === itemFilter))
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter(
        (o) =>
          o.ticket_number.toLowerCase().includes(q) ||
          o.name.toLowerCase().includes(q) ||
          o.id_no.toLowerCase().includes(q) ||
          (o.mobile || '').toLowerCase().includes(q) ||
          (o.email || '').toLowerCase().includes(q) ||
          (o.department || '').toLowerCase().includes(q)
      )
    }

    const sorted = [...rows]
    if (sortBy === 'ticket') {
      sorted.sort((a, b) => a.ticket_number.localeCompare(b.ticket_number))
    } else if (sortBy === 'item') {
      sorted.sort((a, b) => {
        const an = a.items?.[0]?.name || ''
        const bn = b.items?.[0]?.name || ''
        return an.localeCompare(bn)
      })
    } else {
      sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }
    return sorted
  }, [orders, validationFilter, departmentFilter, sectionFilter, itemFilter, search, sortBy])

  const stats = useMemo(() => {
    const total = orders.length
    const validated = orders.filter((o) => o.validated).length
    const claimed = orders.filter((o) => o.claimed).length
    const revenue = orders
      .filter((o) => o.validated)
      .reduce((sum, o) => sum + Number(o.total || 0), 0)
    return { total, validated, claimed, revenue }
  }, [orders])

  const toggleField = async (order, field) => {
    setUpdatingId(order.id + field)
    const newValue = !order[field]
    const { error } = await supabase
      .from('orders')
      .update({ [field]: newValue })
      .eq('id', order.id)
    if (!error) {
      const updated = { ...order, [field]: newValue }
      setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)))
      // Only notify when the flag is being turned ON (not when un-toggling).
      if (newValue && field === 'validated') emailPaymentValidated(updated)
      if (newValue && field === 'claimed') emailClaimed(updated)
    }
    setUpdatingId(null)
  }

  const deleteOrder = async (order) => {
    setDeletingId(order.id)
    setDeleteError('')
    // .select() makes Supabase return the rows it actually deleted, so we can
    // tell a real success apart from a silent no-op (e.g. an RLS policy
    // quietly matching zero rows, which returns no error but also deletes
    // nothing — the previous version trusted "no error" alone and removed
    // the row from the UI even when the database still had it).
    const { data, error } = await supabase
      .from('orders')
      .delete()
      .eq('id', order.id)
      .select('id')

    if (error) {
      setDeletingId(null)
      setDeleteError(`Couldn't delete ${order.ticket_number}: ${error.message}`)
      return
    }

    if (!data || data.length === 0) {
      setDeletingId(null)
      setDeleteError(
        `${order.ticket_number} wasn't deleted. Your Supabase project may be missing the delete policy — re-run schema.sql's "Public can delete orders" policy.`
      )
      return
    }

    // Best-effort cleanup of the stored screenshot; a failure here shouldn't
    // block the order from being removed from the dashboard.
    if (order.screenshot_url) {
      try {
        const path = order.screenshot_url.split('/payment-screenshots/').pop()
        if (path) await supabase.storage.from('payment-screenshots').remove([path])
      } catch (err) {
        console.error('Could not remove screenshot for deleted order:', err)
      }
    }
    setOrders((prev) => prev.filter((o) => o.id !== order.id))
    setDeletingId(null)
  }

  const handleDispatched = (updatedOrder) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o))
    )
  }

  const handleRefunded = (updatedOrder) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o))
    )
    setRefundOrder(null)
  }

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 pb-24 pt-8 sm:pt-10">
      <div className="animate-rise mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-smoke-300 sm:text-3xl">
            Orders <span className="text-ember-gradient">Dashboard</span>
          </h1>
          <p className="mt-1 text-sm text-smoke-500">
            Validate payments and mark orders as claimed.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => generateAllWaybillsPDF(orders)}
            disabled={orders.length === 0}
            className="ember-ring flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-2 text-xs text-smoke-400 transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Files size={13} />
            Generate All Waybills
          </button>
          <button
            type="button"
            onClick={() => exportOrdersToExcel(orders)}
            disabled={orders.length === 0}
            className="ember-ring flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-2 text-xs text-smoke-400 transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FileSpreadsheet size={13} />
            Export Excel
          </button>
          <button
            type="button"
            onClick={() => setDispatchOpen(true)}
            className="ember-ring flex items-center gap-1.5 rounded-full bg-ember-gradient px-3.5 py-2 text-xs font-semibold text-char-950 shadow-ember transition hover:brightness-110"
          >
            <ScanLine size={13} />
            Dispatch
          </button>
          <button
            type="button"
            onClick={() => fetchOrders(true)}
            className="ember-ring flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-2 text-xs text-smoke-400 transition hover:border-white/20"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            onClick={logout}
            className="ember-ring flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-2 text-xs text-smoke-400 transition hover:border-red-500/40 hover:text-red-300"
          >
            <LogOut size={13} />
            Sign Out
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Package} label="Total Orders" value={stats.total} />
        <StatCard icon={CheckCircle2} label="Validated" value={stats.validated} accent />
        <StatCard icon={PackageCheck} label="Claimed" value={stats.claimed} />
        <StatCard icon={Wallet} label="Validated Revenue" value={`₱${stats.revenue.toFixed(0)}`} accent />
      </div>

      <GlassCard className="mb-5 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-smoke-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ticket, name, ID no., mobile, email, or department"
              className="input pl-9"
            />
          </div>

          <Select
            icon={ArrowUpDown}
            value={sortBy}
            onChange={setSortBy}
            options={Object.entries(SORTS).map(([value, s]) => ({ value, label: `Sort: ${s.label}` }))}
          />
          <Select
            icon={CheckCircle2}
            value={validationFilter}
            onChange={setValidationFilter}
            options={[
              { value: 'all', label: 'All Payments' },
              { value: 'validated', label: 'Validated Only' },
              { value: 'pending', label: 'Pending Only' },
            ]}
          />
          <Select
            icon={Building2}
            value={departmentFilter}
            onChange={setDepartmentFilter}
            options={[{ value: 'all', label: 'All Departments' }, ...departments.map((d) => ({ value: d, label: d }))]}
          />
          <Select
            icon={Users}
            value={sectionFilter}
            onChange={setSectionFilter}
            options={[{ value: 'all', label: 'All Sections' }, ...sections.map((s) => ({ value: s, label: s }))]}
          />
        </div>
        {allItems.length > 0 && (
          <div className="mt-3">
            <Select
              icon={Flame}
              value={itemFilter}
              onChange={setItemFilter}
              options={[{ value: 'all', label: 'All Items' }, ...allItems.map((i) => ({ value: i, label: i }))]}
            />
          </div>
        )}
      </GlassCard>

      {deleteError && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span className="flex-1">{deleteError}</span>
          <button
            type="button"
            onClick={() => setDeleteError('')}
            className="shrink-0 text-red-300/70 transition hover:text-red-200"
            aria-label="Dismiss"
          >
            <XCircle size={16} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-smoke-500">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <GlassCard className="p-10 text-center text-sm text-smoke-500">
          No orders match your filters.
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              onToggle={toggleField}
              updating={updatingId}
              onDelete={deleteOrder}
              deleting={deletingId === order.id}
              onRefundClick={setRefundOrder}
              onWaybillClick={setWaybillOrder}
            />
          ))}
        </div>
      )}

      {dispatchOpen && (
        <DispatchModal
          orders={orders}
          onClose={() => setDispatchOpen(false)}
          onDispatched={handleDispatched}
        />
      )}

      {refundOrder && (
        <RefundModal
          order={refundOrder}
          onClose={() => setRefundOrder(null)}
          onRefunded={handleRefunded}
        />
      )}

      {waybillOrder && (
        <WaybillModal order={waybillOrder} onClose={() => setWaybillOrder(null)} />
      )}
    </main>
  )
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <GlassCard className="flex items-center gap-3 p-4">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          accent ? 'bg-ember-gradient text-char-950' : 'border border-white/10 text-ember-500'
        }`}
      >
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold text-smoke-300 font-display">{value}</p>
        <p className="truncate text-[11px] uppercase tracking-wide text-smoke-500">{label}</p>
      </div>
    </GlassCard>
  )
}

function Select({ icon: Icon, value, onChange, options }) {
  return (
    <div className="relative">
      <Icon size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-smoke-500" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input appearance-none pl-9 pr-8"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-char-900">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function OrderRow({ order, onToggle, updating, onDelete, deleting, onRefundClick, onWaybillClick }) {
  const [open, setOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  return (
    <GlassCard className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ember-ring flex w-full flex-wrap items-center gap-3 px-4 py-3.5 text-left sm:gap-4 sm:px-5"
      >
        <span className="font-mono text-sm font-semibold text-ember-400">{order.ticket_number}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-smoke-300">{order.name}</span>
        {order.department && (
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-smoke-500">
            {order.department}
          </span>
        )}
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-smoke-500">
          {order.section}
        </span>
        <span className="font-mono text-sm text-smoke-300">₱{Number(order.total).toFixed(0)}</span>
        <Badge active={order.validated} onLabel="Validated" offLabel="Pending" />
        <Badge active={order.claimed} onLabel="Claimed" offLabel="Unclaimed" />
        {order.refunded && (
          <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-medium text-red-300">
            Refunded
          </span>
        )}
      </button>

      {open && (
        <div className="border-t border-white/[0.06] px-4 py-4 sm:px-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-smoke-500">Order Items</p>
              <div className="space-y-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                {(order.items || []).map((it) => (
                  <div key={it.id} className="flex items-center justify-between text-sm">
                    <span className="text-smoke-400">{it.name} × {it.qty}</span>
                    <span className="font-mono text-smoke-300">₱{it.subtotal.toFixed(0)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-smoke-500">ID No.: {order.id_no}</p>
              {order.mobile && (
                <p className="mt-1 text-xs text-smoke-500">Mobile: {order.mobile}</p>
              )}
              {order.email && (
                <p className="mt-1 text-xs text-smoke-500">Email: {order.email}</p>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-smoke-500">Payment Screenshot</p>
              {order.screenshot_url ? (
                <a
                  href={order.screenshot_url}
                  target="_blank"
                  rel="noreferrer"
                  className="ember-ring flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-smoke-400 transition hover:border-ember-500/50 hover:text-ember-400"
                >
                  <ImageIcon size={14} />
                  View Screenshot
                </a>
              ) : (
                <p className="text-xs text-smoke-500">No screenshot on file.</p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <ActionButton
                  active={order.validated}
                  loading={updating === order.id + 'validated'}
                  onClick={() => onToggle(order, 'validated')}
                  onIcon={CheckCircle2}
                  offIcon={XCircle}
                  onLabel="Validated"
                  offLabel="Mark Validated"
                />
                <ActionButton
                  active={order.claimed}
                  loading={updating === order.id + 'claimed'}
                  onClick={() => onToggle(order, 'claimed')}
                  onIcon={PackageCheck}
                  offIcon={Package}
                  onLabel="Claimed"
                  offLabel="Mark Claimed"
                />
                {order.refunded ? (
                  <span className="flex items-center gap-1.5 rounded-lg bg-red-500/15 px-3 py-2 text-xs font-medium text-red-300">
                    <Undo2 size={13} />
                    Refunded
                    {order.refunded_at
                      ? ` · ${new Date(order.refunded_at).toLocaleDateString()}`
                      : ''}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onRefundClick(order)}
                    className="ember-ring flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-smoke-400 transition hover:border-red-500/50 hover:text-red-300"
                  >
                    <Undo2 size={13} />
                    Refund
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onWaybillClick(order)}
                  className="ember-ring flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-smoke-400 transition hover:border-ember-500/50 hover:text-ember-400"
                >
                  <FileText size={13} />
                  Waybill
                </button>
              </div>

              {order.refunded && order.refund_proof_url && (
                <a
                  href={order.refund_proof_url}
                  target="_blank"
                  rel="noreferrer"
                  className="ember-ring mt-2 flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-smoke-400 transition hover:border-red-500/40 hover:text-red-300"
                >
                  <ImageIcon size={14} />
                  View Refund Proof
                </a>
              )}

              <div className="mt-4 border-t border-white/[0.06] pt-4">
                {!confirmingDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="ember-ring flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-smoke-400 transition hover:border-red-500/50 hover:text-red-300"
                  >
                    <Trash2 size={13} />
                    Delete Order
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2.5">
                    <span className="text-xs text-red-300">
                      Delete this order permanently?
                    </span>
                    <button
                      type="button"
                      onClick={() => onDelete(order)}
                      disabled={deleting}
                      className="ember-ring flex items-center gap-1.5 rounded-lg bg-red-500/90 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
                    >
                      {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      Yes, Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      disabled={deleting}
                      className="ember-ring rounded-lg border border-white/10 px-3 py-1.5 text-xs text-smoke-400 transition hover:border-white/20"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  )
}

function Badge({ active, onLabel, offLabel }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
        active ? 'bg-ember-600/15 text-ember-400' : 'border border-white/10 text-smoke-500'
      }`}
    >
      {active ? onLabel : offLabel}
    </span>
  )
}

function ActionButton({ active, loading, onClick, onIcon: OnIcon, offIcon: OffIcon, onLabel, offLabel }) {
  const Icon = active ? OnIcon : OffIcon
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`ember-ring flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition disabled:opacity-50 ${
        active
          ? 'bg-ember-gradient text-char-950'
          : 'border border-white/10 text-smoke-400 hover:border-ember-500/50 hover:text-ember-400'
      }`}
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
      {active ? onLabel : offLabel}
    </button>
  )
}
