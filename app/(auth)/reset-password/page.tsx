'use client'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mountain, Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react'

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  )
}

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Erreur lors de la réinitialisation')
      setLoading(false)
      return
    }

    setSuccess(true)
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-summit-glow" />
        <div className="absolute inset-0 bg-dark-gradient" />
        <div className="relative z-10 card p-8 text-center max-w-md">
          <p className="text-red-400 mb-4">Lien invalide ou expiré.</p>
          <Link href="/forgot-password" className="btn-primary inline-block px-6 py-2">
            Redemander un lien
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-summit-glow" />
      <div className="absolute inset-0 bg-dark-gradient" />

      <div className="relative z-10 w-full max-w-md animate-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-ventoux-gradient mb-4 shadow-ventoux">
            <Mountain className="w-7 h-7 text-white" strokeWidth={1.5} />
          </div>
        </div>

        <div className="card p-8">
          {success ? (
            <div className="text-center">
              <CheckCircle size={40} className="mx-auto text-emerald-400 mb-4" />
              <h2 className="font-display text-xl font-semibold text-summit-light mb-3 uppercase tracking-wide">
                Mot de passe modifié
              </h2>
              <p className="text-stone-400 text-sm mb-4">
                Votre mot de passe a été réinitialisé avec succès.
              </p>
              <Link href="/login" className="btn-primary inline-block px-6 py-2">
                Se connecter
              </Link>
            </div>
          ) : (
            <>
              <h2 className="font-display text-xl font-semibold text-summit-light mb-6 uppercase tracking-wide">
                Nouveau mot de passe
              </h2>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="label">Nouveau mot de passe</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="input pr-11"
                      placeholder="8 caractères min."
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                  {loading ? 'Réinitialisation…' : 'Réinitialiser le mot de passe'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
