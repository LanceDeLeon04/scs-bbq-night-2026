import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import OrderForm from './pages/OrderForm.jsx'
import AdminLogin from './pages/AdminLogin.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'

function TopBar() {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')
  return (
    <header className="relative z-10 border-b border-white/5">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <Link to="/" className="flex items-center gap-2.5 group">
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
            <img
              src="/Resources/scs.png"
              alt="SCS logo"
              className="h-full w-full object-contain object-center"
            />
          </span>
          <div className="leading-tight">
            <p className="font-display text-sm font-semibold tracking-wide text-smoke-300">
              School of Computer Studies
            </p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-ember-500">
              BBQ Night &middot; O'Week 2026
            </p>
          </div>
        </Link>
        {!isAdmin && (
          <Link
            to="/admin"
            className="flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-1.5 text-xs text-smoke-400 transition hover:border-ember-600/50 hover:text-ember-400"
          >
            <ShieldCheck size={14} />
            Admin
          </Link>
        )}
      </div>
    </header>
  )
}

export default function App() {
  return (
    <div className="relative min-h-screen">
      <div className="bg-layer" />
      <div className="grain-overlay" />
      <TopBar />
      <Routes>
        <Route path="/" element={<OrderForm />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
      </Routes>
    </div>
  )
}
