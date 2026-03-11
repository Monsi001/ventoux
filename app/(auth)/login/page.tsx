'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mountain, Loader2, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError('Email ou mot de passe incorrect')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-summit-glow" />
      <div className="absolute inset-0 bg-dark-gradient" />
      
      {/* Ventoux silhouette subtile */}
      <div className="absolute bottom-0 left-0 right-0 h-64 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 300'%3E%3Cpath d='M0,300 L0,200 Q100,180 200,160 Q300,100 400,80 Q500,30 600,10 Q700,30 800,80 Q900,100 1000,160 Q1100,180 1200,200 L1200,300Z' fill='white'/%3E%3C/svg%3E")`,
          backgroundSize: 'cover',
          backgroundPosition: 'bottom',
        }}
      />

      <div className="relative z-10 w-full max-w-md animate-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-ventoux-gradient mb-5 shadow-ventoux">
            <Mountain className="w-8 h-8 text-white" strokeWidth={1.5} />
          </div>
          <h1 className="font-display text-4xl font-bold text-summit-light tracking-wider uppercase">
            Ventoux
          </h1>
          <p className="text-stone-500 mt-1 text-sm">Training Intelligence</p>
        </div>

        {/* Card */}
        <div className="card p-8">
          <h2 className="font-display text-xl font-semibold text-summit-light mb-6 uppercase tracking-wide">
            Connexion
          </h2>

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

            <div>
              <label className="label">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-11"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
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

            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </div>

        <p className="text-center mt-5 text-stone-500 text-sm">
          Pas encore de compte ?{' '}
          <Link href="/register" className="text-ventoux-400 hover:text-ventoux-300 transition-colors font-medium">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  )
}
