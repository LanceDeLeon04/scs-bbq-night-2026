import { Minus, Plus, Check } from 'lucide-react'

export default function ItemRow({ item, qty, onChange }) {
  const active = qty > 0

  const setQty = (next) => {
    const clamped = Math.max(0, Math.min(999, next))
    onChange(clamped)
  }

  return (
    <div
      className={`group flex flex-col overflow-hidden rounded-2xl border transition-all ${
        active
          ? 'border-ember-500/50 bg-ember-600/[0.08] shadow-ember'
          : 'border-white/[0.07] bg-white/[0.02] hover:border-white/15'
      }`}
    >
      <button
        type="button"
        onClick={() => setQty(active ? 0 : 1)}
        aria-pressed={active}
        aria-label={`Include ${item.name}`}
        className="ember-ring relative block aspect-[4/3] w-full overflow-hidden bg-char-800"
      >
        <img
          src={item.img}
          alt={item.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-char-950/85 via-char-950/10 to-transparent" />

        <span className="absolute right-2 top-2 rounded-md border border-white/10 bg-char-950/70 px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wide text-smoke-300 backdrop-blur-sm">
          ₱{item.price.toFixed(0)}
        </span>

        <span
          className={`absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-md border backdrop-blur-sm transition ${
            active
              ? 'border-ember-400 bg-ember-gradient'
              : 'border-white/25 bg-char-950/50'
          }`}
        >
          {active && <Check size={12} strokeWidth={3} className="text-char-950" />}
        </span>
      </button>

      <div className="flex flex-1 flex-col gap-2.5 p-3">
        <div className="min-w-0">
          <p className="truncate font-display text-[13px] font-semibold leading-tight text-smoke-200">
            {item.name}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-smoke-500">
            ₱{item.price.toFixed(0)} / {item.unit}
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setQty(qty - 1)}
              disabled={qty === 0}
              className="ember-ring flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 text-smoke-400 transition hover:border-ember-500/50 hover:text-ember-400 disabled:opacity-30"
              aria-label={`Decrease ${item.name} quantity`}
            >
              <Minus size={11} />
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={qty}
              onChange={(e) => setQty(parseInt(e.target.value || '0', 10))}
              className="ember-ring w-8 shrink-0 rounded-md border border-white/10 bg-char-900 py-0.5 text-center font-mono text-xs text-smoke-300 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => setQty(qty + 1)}
              className="ember-ring flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 text-smoke-400 transition hover:border-ember-500/50 hover:text-ember-400"
              aria-label={`Increase ${item.name} quantity`}
            >
              <Plus size={11} />
            </button>
          </div>

          <p className="shrink-0 truncate font-mono text-[11px] font-semibold text-ember-400">
            {active ? `₱${(qty * item.price).toFixed(0)}` : '—'}
          </p>
        </div>
      </div>
    </div>
  )
}
