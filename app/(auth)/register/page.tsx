'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Mountain, Loader2, Info, Mail } from 'lucide-react'

export default function RegisterPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [registered, setRegistered] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    height: '',
    weight: '',
    ftp: '',
  })

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erreur lors de la création du compte')
        setLoading(false)
        return
      }

      setRegistered(true)
    } catch {
      setError('Erreur réseau')
      setLoading(false)
    }
  }

  if (registered) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-summit-glow" />
        <div className="absolute inset-0 bg-dark-gradient" />
        <div className="relative z-10 w-full max-w-md animate-in">
          <div className="card p-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-ventoux-gradient mb-4 shadow-ventoux">
              <Mail className="w-7 h-7 text-white" />
            </div>
            <h2 className="font-display text-xl font-semibold text-summit-light mb-3 uppercase tracking-wide">
              Vérifiez votre email
            </h2>
            <p className="text-stone-400 mb-2">
              Un email de vérification a été envoyé à
            </p>
            <p className="text-ventoux-400 font-medium mb-4">{form.email}</p>
            <p className="text-stone-500 text-sm">
              Cliquez sur le lien dans l'email pour activer votre compte, puis connectez-vous.
            </p>
            <Link href="/login" className="btn-primary inline-block mt-6 px-6 py-2">
              Aller à la connexion
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-summit-glow" />
      <div className="absolute inset-0 bg-dark-gradient" />

      <div className="relative z-10 w-full max-w-lg animate-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-ventoux-gradient mb-4 shadow-ventoux">
            <Mountain className="w-7 h-7 text-white" strokeWidth={1.5} />
          </div>
          <h1 className="font-display text-3xl font-bold text-summit-light tracking-wider uppercase">
            Ventoux Training
          </h1>
        </div>

        <div className="card p-8">
          <h2 className="font-display text-xl font-semibold text-summit-light mb-6 uppercase tracking-wide">
            Créer un compte
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Infos de base */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Prénom / Nom</label>
                <input className="input" placeholder="Simon Dupont" value={form.name}
                  onChange={e => update('name', e.target.value)} required />
              </div>
              <div className="col-span-2">
                <label className="label">Email</label>
                <input type="email" className="input" placeholder="vous@example.com" value={form.email}
                  onChange={e => update('email', e.target.value)} required />
              </div>
              <div className="col-span-2">
                <label className="label">Mot de passe</label>
                <input type="password" className="input" placeholder="8 caractères min." value={form.password}
                  onChange={e => update('password', e.target.value)} required minLength={8} />
              </div>
            </div>

            {/* Séparateur */}
            <div className="border-t border-white/[0.06] pt-4">
              <p className="text-stone-500 text-xs mb-4 flex items-center gap-1.5">
                <Info size={12} />
                Profil physique — utilisé pour les calculs TSS et la génération du plan
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Taille (cm)</label>
                  <input type="number" className="input" placeholder="178" value={form.height}
                    onChange={e => update('height', e.target.value)} min={140} max={220} />
                </div>
                <div>
                  <label className="label">Poids (kg)</label>
                  <input type="number" className="input" placeholder="70" value={form.weight}
                    onChange={e => update('weight', e.target.value)} min={40} max={150} step={0.1} />
                </div>
                <div>
                  <label className="label">FTP (watts)</label>
                  <input type="number" className="input" placeholder="250" value={form.ftp}
                    onChange={e => update('ftp', e.target.value)} min={100} max={600} />
                </div>
              </div>
              <p className="text-stone-600 text-xs mt-2">
                FTP = puissance maximale maintenue 1h. Ces données sont modifiables dans votre profil.
              </p>
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Création du compte…' : 'Commencer l\'entraînement'}
            </button>
          </form>
        </div>

        <p className="text-center mt-4 text-stone-500 text-sm">
          Déjà un compte ?{' '}
          <Link href="/login" className="text-ventoux-400 hover:text-ventoux-300 transition-colors font-medium">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
