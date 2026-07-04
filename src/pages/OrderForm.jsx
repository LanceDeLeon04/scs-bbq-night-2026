import { useMemo, useState } from 'react'
import {
  Flame, Upload, CheckCircle2, Loader2, AlertCircle,
  Copy, Check, Image as ImageIcon, ChevronDown,
} from 'lucide-react'
import GlassCard from '../components/GlassCard.jsx'
import ItemRow from '../components/ItemRow.jsx'
import { MENU, PAYMENT_QR_IMG } from '../lib/menu.js'
import { DEPARTMENTS, isPositionDepartment } from '../lib/departments.js'
import { generateTicketNumber } from '../lib/ticket.js'
import { supabase } from '../lib/supabaseClient.js'

const STEPS = ['Details', 'Payment', 'Ticket']

export default function OrderForm() {
  const [step, setStep] = useState(0)
  const [idNo, setIdNo] = useState('')
  const [name, setName] = useState('')
  const [department, setDepartment] = useState('')
  const [section, setSection] = useState('')
  const [qtys, setQtys] = useState({})
  const [screenshot, setScreenshot] = useState(null)
  const [screenshotPreview, setScreenshotPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [ticket, setTicket] = useState(null)
  const [copied, setCopied] = useState(false)

  const total = useMemo(
    () => MENU.reduce((sum, item) => sum + (qtys[item.id] || 0) * item.price, 0),
    [qtys]
  )
  const orderedItems = useMemo(
    () => MENU.filter((item) => (qtys[item.id] || 0) > 0),
    [qtys]
  )

  const positionMode = isPositionDepartment(department)
  const sectionLabel = positionMode ? 'Position' : 'Section'
  const sectionPlaceholder = positionMode ? 'Vice President' : 'BSCS261A'

  const detailsValid =
    idNo.trim() && name.trim() && department.trim() && section.trim() && orderedItems.length > 0

  const handleFile = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (screenshot) of your payment.')
      return
    }
    setError('')
    setScreenshot(file)
    setScreenshotPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async () => {
    if (!screenshot) {
      setError('Upload your GCash payment screenshot before submitting.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const ticketNumber = generateTicketNumber()
      const ext = screenshot.name.split('.').pop() || 'jpg'
      const path = `${ticketNumber}-${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('payment-screenshots')
        .upload(path, screenshot, { upsert: false })
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('payment-screenshots')
        .getPublicUrl(path)

      const items = orderedItems.map((item) => ({
        id: item.id,
        name: item.name,
        qty: qtys[item.id],
        price: item.price,
        subtotal: qtys[item.id] * item.price,
      }))

      const { error: insertError } = await supabase.from('orders').insert({
        ticket_number: ticketNumber,
        id_no: idNo.trim(),
        name: name.trim(),
        department: department.trim(),
        section: section.trim().toUpperCase(),
        items,
        total,
        screenshot_url: urlData.publicUrl,
        validated: false,
        claimed: false,
      })
      if (insertError) throw insertError

      setTicket(ticketNumber)
      setStep(2)
    } catch (err) {
      console.error(err)
      setError(
        err?.message?.includes('Bucket not found')
          ? 'Storage is not set up yet. Ask the admin to run the Supabase setup (see README).'
          : 'Something went wrong submitting your order. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const copyTicket = async () => {
    if (!ticket) return
    await navigator.clipboard.writeText(ticket)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <main className="relative z-10 mx-auto max-w-2xl px-5 pb-24 pt-10 sm:pt-14 lg:max-w-5xl">
      <div className="animate-rise mb-8 text-center">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-ember-600/30 bg-ember-600/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-ember-400">
          <span className="ember-dot h-1.5 w-1.5 rounded-full bg-ember-500" />
          Orientation Week 2026
        </div>
        <h1 className="font-display text-3xl font-semibold text-smoke-300 sm:text-4xl">
          BBQ Night <span className="text-ember-gradient">Order Form</span>
        </h1>
        <p className="mt-2 text-sm text-smoke-500">
          Fill out your order, pay via GCash, and get your claim ticket.
        </p>
      </div>

      <StepIndicator step={step} />

      {step === 0 && (
        <div className="animate-rise lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-6">
          <div className="space-y-5">
            <GlassCard className="p-5 sm:p-6">
              <h2 className="mb-4 font-display text-base font-semibold text-smoke-300">
                Your Information
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Department" className="sm:col-span-2">
                  <div className="relative">
                    <select
                      value={department}
                      onChange={(e) => {
                        setDepartment(e.target.value)
                        setSection('')
                      }}
                      className="input appearance-none pr-9"
                    >
                      <option value="" disabled className="bg-char-900">
                        Select department
                      </option>
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept} className="bg-char-900">
                          {dept}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-smoke-500"
                    />
                  </div>
                </Field>
                <Field label="ID No.">
                  <input
                    value={idNo}
                    onChange={(e) => setIdNo(e.target.value)}
                    placeholder="2023-******"
                    className="input"
                  />
                </Field>
                <Field label={sectionLabel}>
                  <input
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    placeholder={sectionPlaceholder}
                    className="input"
                  />
                </Field>
                <Field label="Name" className="sm:col-span-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Juan Dela Cruz"
                    className="input"
                  />
                </Field>
              </div>
            </GlassCard>

            <GlassCard className="p-5 sm:p-6">
              <h2 className="mb-1 font-display text-base font-semibold text-smoke-300">
                Choose Your Order
              </h2>
              <p className="mb-4 text-xs text-smoke-500">
                Tap an item to include it, then set the quantity.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {MENU.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    qty={qtys[item.id] || 0}
                    onChange={(q) => setQtys((prev) => ({ ...prev, [item.id]: q }))}
                  />
                ))}
              </div>
            </GlassCard>

            {/* Mobile / tablet: total + continue live inline under the menu */}
            <div className="space-y-3 lg:hidden">
              <TotalBar total={total} count={orderedItems.length} />
              <button
                type="button"
                disabled={!detailsValid}
                onClick={() => setStep(1)}
                className="btn-primary w-full"
              >
                Continue to Payment
              </button>
            </div>
          </div>

          {/* Desktop: sticky order summary sidebar so there's no need to scroll back up */}
          <div className="hidden lg:sticky lg:top-6 lg:block">
            <GlassCard className="p-5">
              <h3 className="mb-3 font-display text-sm font-semibold text-smoke-300">
                Order Summary
              </h3>
              {orderedItems.length === 0 ? (
                <p className="text-xs text-smoke-500">No items selected yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {orderedItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs">
                      <span className="truncate text-smoke-400">
                        {item.name} × {qtys[item.id]}
                      </span>
                      <span className="shrink-0 font-mono text-smoke-300">
                        ₱{(qtys[item.id] * item.price).toFixed(0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="my-3 h-px bg-white/[0.06]" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-smoke-400">Total</span>
                <span className="font-display text-lg font-semibold text-ember-gradient">
                  ₱{total.toFixed(0)}
                </span>
              </div>
              <button
                type="button"
                disabled={!detailsValid}
                onClick={() => setStep(1)}
                className="btn-primary mt-4 w-full"
              >
                Continue to Payment
              </button>
            </GlassCard>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="animate-rise mx-auto max-w-2xl space-y-5">
          <GlassCard className="p-5 sm:p-6">
            <h2 className="mb-1 font-display text-base font-semibold text-smoke-300">
              Scan to Pay via GCash
            </h2>
            <p className="mb-4 text-xs text-smoke-500">
              Pay the exact total below, then upload a screenshot of your payment confirmation.
            </p>

            <div className="flex flex-col items-center gap-4">
              <div className="rounded-2xl border border-white/10 bg-white p-3 shadow-ember">
                <img
                  src={PAYMENT_QR_IMG}
                  alt="GCash payment QR code"
                  className="h-52 w-52 object-contain sm:h-60 sm:w-60"
                  onError={(e) => {
                    e.currentTarget.replaceWith(
                      Object.assign(document.createElement('div'), {
                        className: 'flex h-52 w-52 items-center justify-center text-xs text-char-700 sm:h-60 sm:w-60',
                        innerText: 'QR image missing — add Resources/gcash-qr.png',
                      })
                    )
                  }}
                />
              </div>
              <p className="text-2xl font-semibold text-ember-gradient font-display">
                ₱{total.toFixed(0)}
              </p>
            </div>

            <div className="mt-6">
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-smoke-500">
                Upload Payment Screenshot
              </label>
              <label
                htmlFor="screenshot"
                className="ember-ring flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-8 text-center transition hover:border-ember-500/50"
              >
                {screenshotPreview ? (
                  <img
                    src={screenshotPreview}
                    alt="Payment screenshot preview"
                    className="max-h-56 rounded-lg border border-white/10 object-contain"
                  />
                ) : (
                  <>
                    <Upload size={22} className="text-ember-500" />
                    <span className="text-sm text-smoke-400">
                      Tap to upload screenshot
                    </span>
                    <span className="text-xs text-smoke-500">PNG or JPG</span>
                  </>
                )}
                <input
                  id="screenshot"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </label>
              <p className="mt-2 flex items-start gap-1.5 text-xs text-smoke-500">
                <AlertCircle size={13} className="mt-0.5 shrink-0 text-ember-500" />
                An invalid or unclear screenshot means your order cannot be processed.
                Choose a different image anytime by tapping the box again.
              </p>
            </div>
          </GlassCard>

          {error && <ErrorBanner message={error} />}

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(0)} className="btn-secondary flex-1">
              Back
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-primary flex-1"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Submitting
                </span>
              ) : (
                'Submit Order'
              )}
            </button>
          </div>
        </div>
      )}

      {step === 2 && ticket && (
        <div className="animate-rise mx-auto max-w-2xl">
          <GlassCard className="overflow-hidden p-0">
            <div className="relative flex flex-col items-center gap-3 overflow-hidden border-b border-white/[0.06] px-6 py-10 text-center">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgba(47,125,232,0.22),transparent)]" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-ember-gradient shadow-ember">
                <CheckCircle2 size={28} strokeWidth={2.3} className="text-white" />
              </div>
              <p className="relative font-display text-lg font-semibold text-smoke-200">
                Order Submitted
              </p>
              <p className="relative text-sm text-smoke-500">
                Screenshot this ticket and present it upon order pickup.
              </p>
            </div>

            <div className="p-6">
              <p className="mb-2 text-center text-xs uppercase tracking-[0.2em] text-smoke-500">
                Your Ticket Number
              </p>
              <button
                type="button"
                onClick={copyTicket}
                className="ember-ring mx-auto mb-6 flex w-full items-center justify-center gap-3 rounded-xl border border-ember-600/30 bg-ember-600/10 py-4 font-mono text-2xl font-bold tracking-[0.15em] text-ember-400 transition hover:bg-ember-600/[0.15]"
              >
                <Flame size={20} />
                {ticket}
                {copied ? <Check size={18} /> : <Copy size={18} className="opacity-60" />}
              </button>

              <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <Row label="Name" value={name} />
                <Row label="Department" value={department} />
                <Row label={sectionLabel} value={section.toUpperCase()} />
                <Row label="ID No." value={idNo} />
                <div className="my-2 h-px bg-white/[0.06]" />
                {orderedItems.map((item) => (
                  <Row
                    key={item.id}
                    label={`${item.name} × ${qtys[item.id]}`}
                    value={`₱${(qtys[item.id] * item.price).toFixed(0)}`}
                  />
                ))}
                <div className="my-2 h-px bg-white/[0.06]" />
                <Row label="Total Paid" value={`₱${total.toFixed(0)}`} strong />
                <Row label="Status" value="Pending Validation" pending />
              </div>

              <p className="mt-5 flex items-start gap-2 text-xs text-smoke-500">
                <ImageIcon size={14} className="mt-0.5 shrink-0 text-ember-500" />
                Take a screenshot of this ticket now. An admin will validate your payment
                before your order can be claimed.
              </p>
            </div>
          </GlassCard>
        </div>
      )}
    </main>
  )
}

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-smoke-500">
        {label}
      </label>
      {children}
    </div>
  )
}

function Row({ label, value, strong, pending }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-smoke-500">{label}</span>
      <span
        className={
          strong
            ? 'font-display font-semibold text-ember-gradient'
            : pending
            ? 'rounded-full bg-ember-600/15 px-2 py-0.5 text-xs font-medium text-ember-400'
            : 'text-smoke-300'
        }
      >
        {value}
      </span>
    </div>
  )
}

function TotalBar({ total, count }) {
  return (
    <div className="glass sticky bottom-4 flex items-center justify-between rounded-xl px-5 py-3.5 shadow-glass">
      <div>
        <p className="text-xs text-smoke-500">{count} item{count !== 1 ? 's' : ''} selected</p>
        <p className="font-display text-lg font-semibold text-smoke-300">
          Total: <span className="text-ember-gradient">₱{total.toFixed(0)}</span>
        </p>
      </div>
      <Flame size={22} className="text-ember-500" />
    </div>
  )
}

function StepIndicator({ step }) {
  return (
    <div className="mb-7 flex items-center justify-center gap-2">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition ${
              i === step
                ? 'bg-ember-gradient text-char-950'
                : i < step
                ? 'bg-ember-600/20 text-ember-400'
                : 'border border-white/10 text-smoke-500'
            }`}
          >
            {i < step ? <Check size={13} /> : i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-px w-6 sm:w-10 ${i < step ? 'bg-ember-600/40' : 'bg-white/10'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function ErrorBanner({ message }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      {message}
    </div>
  )
}
