'use client'
import { useState, useCallback } from 'react'
import { Mountain, Zap, Trophy, Activity, ChevronRight, X } from 'lucide-react'

interface OnboardingWizardProps {
  user: { name: string; weight?: number | null; height?: number | null; ftp?: number | null }
  onComplete: () => void
}

const TOTAL_STEPS = 4

export default function OnboardingWizard({ user, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // Step 1 — Bienvenue
  const [weight, setWeight] = useState(user.weight?.toString() || '')
  const [height, setHeight] = useState(user.height?.toString() || '')

  // Step 2 — FTP
  const [ftp, setFtp] = useState(user.ftp?.toString() || '')

  // Step 3 — Course objectif
  const [raceName, setRaceName] = useState('GF du Mont Ventoux')
  const [raceDate, setRaceDate] = useState('2026-06-06')
  const [raceDistance, setRaceDistance] = useState('173')
  const [raceElevation, setRaceElevation] = useState('3660')

  const goNext = useCallback(() => {
    setStep(s => Math.min(s + 1, TOTAL_STEPS - 1))
  }, [])

  const saveProfile = useCallback(async (fields: Record<string, unknown>) => {
    setSaving(true)
    try {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
    } catch (e) {
      console.error('Onboarding save error:', e)
    } finally {
      setSaving(false)
    }
  }, [])

  const handleStep1Next = async () => {
    const fields: Record<string, unknown> = {}
    if (weight) fields.weight = parseFloat(weight)
    if (height) fields.height = parseFloat(height)
    if (Object.keys(fields).length > 0) await saveProfile(fields)
    goNext()
  }

  const handleStep2Next = async () => {
    if (ftp) await saveProfile({ ftp: parseInt(ftp, 10) })
    goNext()
  }

  const handleStep3Next = async () => {
    setSaving(true)
    try {
      await fetch('/api/races', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: raceName,
          date: raceDate,
          distance: parseFloat(raceDistance) || null,
          elevation: parseFloat(raceElevation) || null,
          isActive: true,
        }),
      })
    } catch (e) {
      console.error('Onboarding race error:', e)
    } finally {
      setSaving(false)
    }
    goNext()
  }

  const handleFinish = () => {
    onComplete()
  }

  const handleStravaConnect = () => {
    window.location.href = '/api/strava/auth'
  }

  const inputClass =
    'w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-summit-light placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-ventoux-500/50 focus:border-ventoux-500/50 transition-colors'
  const labelClass = 'block text-sm text-stone-400 mb-1.5'

  const steps = [
    // Step 1 — Bienvenue
    <div key="step-0" className={`step-content animate-slide-in-right`}>
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-ventoux-500/10">
          <Mountain size={24} className="text-ventoux-400" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold text-summit-light">Bienvenue sur Ventoux</h2>
        </div>
      </div>
      <p className="text-stone-500 mb-8">{"Pr\u00e9pare ta saison v\u00e9lo avec l\u2019IA"}</p>

      <div className="space-y-4">
        <div>
          <label className={labelClass}>Poids (kg)</label>
          <input
            type="number"
            className={inputClass}
            placeholder="72"
            value={weight}
            onChange={e => setWeight(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Taille (cm)</label>
          <input
            type="number"
            className={inputClass}
            placeholder="178"
            value={height}
            onChange={e => setHeight(e.target.value)}
          />
        </div>
      </div>

      <button
        onClick={handleStep1Next}
        disabled={saving}
        className="btn-primary w-full mt-8 py-3 flex items-center justify-center gap-2"
      >
        {saving ? 'Enregistrement...' : 'Suivant'}
        {!saving && <ChevronRight size={16} />}
      </button>
    </div>,

    // Step 2 — FTP
    <div key="step-1" className={`step-content animate-slide-in-right`}>
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-amber-500/10">
          <Zap size={24} className="text-amber-400" />
        </div>
        <h2 className="font-display text-2xl font-bold text-summit-light">Ta puissance</h2>
      </div>
      <p className="text-stone-500 mb-8">
        {"Le FTP (Functional Threshold Power) est ta puissance maximale tenable sur 1h. Si tu ne le connais pas, on l\u2019estimera."}
      </p>

      <div>
        <label className={labelClass}>FTP (W) - optionnel</label>
        <input
          type="number"
          className={inputClass}
          placeholder="250"
          value={ftp}
          onChange={e => setFtp(e.target.value)}
        />
      </div>

      <button
        onClick={handleStep2Next}
        disabled={saving}
        className="btn-primary w-full mt-8 py-3 flex items-center justify-center gap-2"
      >
        {saving ? 'Enregistrement...' : 'Suivant'}
        {!saving && <ChevronRight size={16} />}
      </button>
      <button
        onClick={goNext}
        className="w-full mt-3 py-2 text-stone-500 hover:text-stone-300 text-sm transition-colors"
      >
        Je ne sais pas
      </button>
    </div>,

    // Step 3 — Course objectif
    <div key="step-2" className={`step-content animate-slide-in-right`}>
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-emerald-500/10">
          <Trophy size={24} className="text-emerald-400" />
        </div>
        <h2 className="font-display text-2xl font-bold text-summit-light">Ton objectif</h2>
      </div>
      <p className="text-stone-500 mb-6">{"D\u00e9finis ta course objectif de saison"}</p>

      <div className="space-y-4">
        <div>
          <label className={labelClass}>Nom de la course</label>
          <input
            type="text"
            className={inputClass}
            value={raceName}
            onChange={e => setRaceName(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Date</label>
          <input
            type="date"
            className={inputClass}
            value={raceDate}
            onChange={e => setRaceDate(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Distance (km)</label>
            <input
              type="number"
              className={inputClass}
              value={raceDistance}
              onChange={e => setRaceDistance(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>{"D\u00e9nivel\u00e9 (m)"}</label>
            <input
              type="number"
              className={inputClass}
              value={raceElevation}
              onChange={e => setRaceElevation(e.target.value)}
            />
          </div>
        </div>
      </div>

      <button
        onClick={handleStep3Next}
        disabled={saving}
        className="btn-primary w-full mt-8 py-3 flex items-center justify-center gap-2"
      >
        {saving ? 'Enregistrement...' : 'Suivant'}
        {!saving && <ChevronRight size={16} />}
      </button>
    </div>,

    // Step 4 — Strava
    <div key="step-3" className={`step-content animate-slide-in-right`}>
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-orange-500/10">
          <Activity size={24} className="text-orange-400" />
        </div>
        <h2 className="font-display text-2xl font-bold text-summit-light">Connecte Strava</h2>
      </div>
      <p className="text-stone-500 mb-8">
        {"Synchronise automatiquement tes sorties pour suivre ta progression."}
      </p>

      <button
        onClick={handleStravaConnect}
        className="btn-primary w-full py-3 flex items-center justify-center gap-2"
        style={{ background: '#FC4C02' }}
      >
        <svg viewBox="0 0 24 24" width={18} height={18} fill="white">
          <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
        </svg>
        Connecter Strava
      </button>

      <button
        onClick={handleFinish}
        className="btn-secondary w-full mt-3 py-3"
      >
        Terminer sans Strava
      </button>
    </div>,
  ]

  return (
    <div className="fixed inset-0 z-[60] bg-stone-950/95 backdrop-blur-xl flex flex-col items-center overflow-y-auto">
      {/* Close button */}
      <button
        onClick={onComplete}
        className="absolute top-6 right-6 p-2 rounded-xl text-stone-500 hover:text-stone-300 hover:bg-white/[0.05] transition-colors"
        aria-label="Fermer"
      >
        <X size={20} />
      </button>

      {/* Card */}
      <div className="max-w-md w-full mx-auto mt-20 px-4">
        <div className="card p-8 overflow-hidden">
          {steps[step]}
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mt-6">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === step ? 'bg-ventoux-500 w-6' : i < step ? 'bg-ventoux-500/50' : 'bg-stone-700'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
