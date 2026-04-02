'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Mountain, Loader2, Mail, ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    setSent(true)
    setLoading(false)
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
          {sent ? (
            <div className="text-center">
              <Mail size={40} className="mx-auto text-ventoux-400 mb-4" />
              <h2 className="font-display text-xl font-semibold text-summit-light mb-3 uppercase tracking-wide">
                Email envoyé
              </h2>
              <p className="text-stone-400 text-sm mb-2">
                Si un compte existe avec cette adresse, vous recevrez un lien de réinitialisation.
              </p>
              <p className="text-stone-500 text-xs">Pensez à vérifier vos spams.</p>
              <Link href="/login" className="btn-primary inline-block mt-6 px-6 py-2">
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <h2 className="font-display text-xl font-semibold text-summit-light mb-2 uppercase tracking-wide">
                Mot de passe oublié
              </h2>
              <p className="text-stone-500 text-sm mb-6">
                Entrez votre email, nous vous enverrons un lien de réinitialisation.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="vous@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                  {loading ? 'Envoi…' : 'Envoyer le lien'}
                </button>
              </form>

              <Link href="/login" className="flex items-center gap-1.5 text-stone-500 hover:text-stone-300 text-sm mt-4 transition-colors">
                <ArrowLeft size={14} />
                Retour à la connexion
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
