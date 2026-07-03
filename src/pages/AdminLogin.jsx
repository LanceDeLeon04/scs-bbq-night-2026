import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Lock, User, AlertCircle, Loader2 } from 'lucide-react'
import GlassCard from '../components/GlassCard.jsx'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const validUser = import.meta.env.VITE_ADMIN_USERNAME
    const validPass = import.meta.env.VITE_ADMIN_PASSWORD

    // Small delay so the loading state reads as intentional, not a glitch.
    setTimeout(() => {
      if (username.trim() === validUser && password === validPass) {
        sessionStorage.setItem('scs_bbq_admin', 'true')
        navigate('/admin/dashboard')
      } else {
        setError('Incorrect username or password.')
        setLoading(false)
      }
    }, 350)
  }

  return (
    <main className="relative z-10 mx-auto flex min-h-[calc(100vh-73px)] max-w-md items-center px-5">
      <div className="animate-rise w-full">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-ember-gradient shadow-ember">
            <ShieldCheck size={22} className="text-char-950" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-smoke-300">
            Admin Access
          </h1>
          <p className="mt-1.5 text-sm text-smoke-500">
            Sign in to manage BBQ Night orders.
          </p>
        </div>

        <GlassCard className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-smoke-500">
                Username
              </label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-smoke-500" />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="input pl-9"
                  placeholder="User"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-smoke-500">
                Password
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-smoke-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="input pl-9"
                  placeholder="••••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Signing in
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </GlassCard>
      </div>
    </main>
  )
}
