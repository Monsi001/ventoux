'use client'
import { useState, useEffect } from 'react'
import { format, startOfWeek, addWeeks } from 'date-fns'
import { fr } from 'date-fns/locale'
import { User, Zap, Link2, Calendar, Check, Loader2, RefreshCw, Mountain, AlertTriangle } from 'lucide-react'
import { estimateVentouxTime, formatMinutes, POWER_ZONES, getPowerZoneBounds } from '@/lib/training'
import type { UserProfile, WeeklyConstraint } from '@/types'
import { invalidateCache } from '@/lib/fetch-cache'

const DAYS = [
  { key: 'mon', label: 'Lun' }, { key: 'tue', label: 'Mar' },
  { key: 'wed', label: 'Mer' }, { key: 'thu', label: 'Jeu' },
  { key: 'fri', label: 'Ven' }, { key: 'sat', label: 'Sam' },
  { key: 'sun', label: 'Dim' },
]

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ name: '', height: '', weight: '', ftp: '' })

  const [showDisconnectModal, setShowDisconnectModal] = useState(false)

  // Contraintes
  const [constraints, setConstraints] = useState<WeeklyConstraint[]>([])
  const [currentWeekConstraint, setCurrentWeekConstraint] = useState<any>({
    availableDays: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true },
    maxHours: '',
    notes: '',
  })

  useEffect(() => {
    loadProfile()
    loadConstraints()

    // Check Strava callback
    const params = new URLSearchParams(window.location.search)
    if (params.get('strava') === 'connected') {
      loadProfile()
    }
  }, [])

  async function loadProfile() {
    const res = await fetch('/api/profile')
    if (!res.ok) return
    const data = await res.json()
    setProfile(data)
    setForm({
      name: data.name || '',
      height: data.height ? String(data.height) : '',
      weight: data.weight ? String(data.weight) : '',
      ftp: data.ftp ? String(data.ftp) : '',
    })
  }

  async function loadConstraints() {
    const res = await fetch('/api/constraints')
    const data = await res.json()
    setConstraints(Array.isArray(data) ? data : [])
  }

  async function saveProfile() {
    setSaving(true)
    const oldFtp = profile?.ftp
    const newFtp = form.ftp ? parseInt(form.ftp) : null

    await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    invalidateCache('/api/init')
    invalidateCache('/api/profile')

    // Si FTP a changé, réajuster le plan actif
    if (newFtp && oldFtp !== newFtp) {
      fetch('/api/plan/on-ftp-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newFtp }),
      }).catch(() => {})
      invalidateCache('/api/plan')
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    loadProfile()
  }

  async function saveConstraint() {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
    await fetch('/api/constraints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weekStart: weekStart.toISOString(),
        availableDays: currentWeekConstraint.availableDays,
        maxHours: currentWeekConstraint.maxHours ? parseFloat(currentWeekConstraint.maxHours) : null,
        notes: currentWeekConstraint.notes,
      }),
    })
    loadConstraints()
  }

  const ftpNum = parseInt(form.ftp) || 0
  const weightNum = parseFloat(form.weight) || 0

  const ventouxEstimate = weightNum > 0 && ftpNum > 0
    ? estimateVentouxTime(weightNum, ftpNum)
    : null

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-in">
      <h1 className="font-display text-2xl md:text-3xl font-bold text-summit-light uppercase tracking-wide">Profil</h1>

      {/* Infos personnelles */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <User size={18} className="text-ventoux-400" />
          <h2 className="font-display text-base font-semibold text-summit-light uppercase tracking-wide">Informations</h2>
          {profile?.role === 'ADMIN' && (
            <span className="text-[10px] font-bold uppercase tracking-wider bg-ventoux-500/20 text-ventoux-400 border border-ventoux-500/30 px-2 py-0.5 rounded-full">
              Admin
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Nom complet</label>
            <input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input opacity-50 cursor-not-allowed" value={profile?.email || ''} readOnly />
          </div>
          <div />
          <div>
            <label className="label">Taille (cm)</label>
            <input type="number" className="input" placeholder="178" value={form.height}
              onChange={e => setForm(p => ({ ...p, height: e.target.value }))} />
          </div>
          <div>
            <label className="label">Poids (kg)</label>
            <input type="number" className="input" placeholder="70" step={0.1} value={form.weight}
              onChange={e => setForm(p => ({ ...p, weight: e.target.value }))} />
          </div>
        </div>

        <button
          onClick={saveProfile}
          disabled={saving}
          className="btn-primary flex items-center gap-2 mt-5"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : null}
          {saved ? 'Sauvegardé !' : 'Enregistrer'}
        </button>
      </div>

      {/* FTP & Zones */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <Zap size={18} className="text-ventoux-400" />
          <h2 className="font-display text-base font-semibold text-summit-light uppercase tracking-wide">FTP & Zones de puissance</h2>
        </div>

        <div className="flex items-end gap-4 mb-5">
          <div className="flex-1">
            <label className="label">FTP (watts)</label>
            <input type="number" className="input" placeholder="250" value={form.ftp}
              onChange={e => setForm(p => ({ ...p, ftp: e.target.value }))} min={100} max={600} />
            {ftpNum > 0 && weightNum > 0 && (
              <p className="text-stone-500 text-xs mt-1">{(ftpNum / weightNum).toFixed(2)} W/kg</p>
            )}
          </div>
          {ventouxEstimate && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-ventoux-500/10 border border-ventoux-500/20 mb-0.5">
              <Mountain size={16} className="text-ventoux-400" />
              <div>
                <p className="text-ventoux-300 font-display font-bold text-lg leading-tight">
                  {formatMinutes(ventouxEstimate.timeMinutes)}
                </p>
                <p className="text-stone-500 text-xs">Ventoux estimé ({ventouxEstimate.category})</p>
              </div>
            </div>
          )}
        </div>

        {/* Zones grid */}
        {ftpNum > 0 && (
          <div className="space-y-2">
            {Object.entries(POWER_ZONES).map(([zone, info]) => {
              const bounds = getPowerZoneBounds(Number(zone), ftpNum)
              const ZONE_COLORS: Record<string, string> = {
                '1': '#6B9EFF', '2': '#4ECCA3', '3': '#F7C948',
                '4': '#FF9F45', '5': '#FF5252', '6': '#C45EFF', '7': '#FF2D9A',
              }
              const color = ZONE_COLORS[zone]
              return (
                <div key={zone} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02]">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span className="text-xs font-mono text-stone-500 w-6">Z{zone}</span>
                  <span className="text-sm text-stone-400 flex-1">{info.name}</span>
                  <span className="text-xs font-mono text-stone-400 flex-shrink-0">
                    {bounds.min}–{bounds.max || '∞'} W
                    <span className="text-stone-600 ml-1">({info.min}–{info.max === 999 ? '150+' : info.max}% FTP)</span>
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <button onClick={saveProfile} disabled={saving} className="btn-secondary flex items-center gap-2 mt-4 text-sm">
          {saving ? <Loader2 size={13} className="animate-spin" /> : null}
          Sauvegarder le FTP
        </button>
      </div>

      {/* Strava */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <Link2 size={18} className="text-ventoux-400" />
          <h2 className="font-display text-base font-semibold text-summit-light uppercase tracking-wide">Connexions</h2>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: '#FC4C02' }}>
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066z" />
                <path d="M9.768 0l2.218 4.28H5.916L9.768 0z" />
              </svg>
            </div>
            <div>
              <p className="text-summit-light text-sm font-medium">Strava</p>
              <p className="text-stone-500 text-xs">
                {profile?.stravaId ? `Connecté · ID ${profile.stravaId}` : 'Non connecté'}
              </p>
            </div>
          </div>
          {profile?.stravaId ? (
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  await fetch('/api/strava/sync', { method: 'POST' })
                  loadProfile()
                }}
                className="btn-secondary text-xs flex items-center gap-1.5 py-1.5"
              >
                <RefreshCw size={12} /> Sync
              </button>
              <button
                onClick={() => setShowDisconnectModal(true)}
                className="text-xs text-stone-500 hover:text-red-400 transition-colors py-1.5 px-2"
              >
                Déconnecter
              </button>
            </div>
          ) : (
            <a href="/api/strava/auth" className="btn-primary text-sm py-2 px-4">
              Connecter
            </a>
          )}
        </div>
      </div>

      {/* Contraintes semaine courante */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <Calendar size={18} className="text-ventoux-400" />
          <div>
            <h2 className="font-display text-base font-semibold text-summit-light uppercase tracking-wide">
              Disponibilités — semaine courante
            </h2>
            <p className="text-stone-500 text-xs">
              Semaine du {format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'dd MMM', { locale: fr })}
            </p>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          {DAYS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setCurrentWeekConstraint((p: any) => ({
                ...p,
                availableDays: { ...p.availableDays, [key]: !p.availableDays[key] }
              }))}
              className={`flex-1 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                currentWeekConstraint.availableDays[key]
                  ? 'bg-ventoux-500/15 border-ventoux-500/30 text-ventoux-300'
                  : 'bg-white/[0.02] border-white/[0.06] text-stone-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="label">Max heures/semaine</label>
            <input type="number" className="input" placeholder="Illimité" step={0.5}
              value={currentWeekConstraint.maxHours}
              onChange={e => setCurrentWeekConstraint((p: any) => ({ ...p, maxHours: e.target.value }))} />
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" placeholder="Voyage, réunion…"
              value={currentWeekConstraint.notes}
              onChange={e => setCurrentWeekConstraint((p: any) => ({ ...p, notes: e.target.value }))} />
          </div>
        </div>

        <button onClick={saveConstraint} className="btn-secondary flex items-center gap-2 text-sm">
          <Check size={14} /> Enregistrer les disponibilités
        </button>
      </div>

      {/* Modal déconnexion Strava */}
      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card p-6 max-w-sm w-full mx-4 shadow-2xl animate-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <h3 className="font-display text-base font-semibold text-summit-light uppercase tracking-wide">
                Déconnecter Strava
              </h3>
            </div>
            <p className="text-stone-400 text-sm mb-6">
              Voulez-vous vraiment déconnecter votre compte Strava ? Vos activités importées seront conservées.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowDisconnectModal(false)}
                className="btn-secondary text-sm px-4 py-2"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  const res = await fetch('/api/strava/disconnect', { method: 'POST' })
                  if (res.ok) loadProfile()
                  setShowDisconnectModal(false)
                }}
                className="bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
