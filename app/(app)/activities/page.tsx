'use client'
import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Upload, RefreshCw, Activity, Bike, Dumbbell, Loader2, CheckCircle2, X, AlertCircle } from 'lucide-react'
import type { Activity as ActivityType } from '@/types'
import { formatDuration } from '@/lib/training'

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  STRAVA:    { label: 'Strava',    color: '#FC4C02' },
  MYWHOOSH:  { label: 'MyWhoosh', color: '#1565C0' },
  MANUAL:    { label: 'Manuel',   color: '#6E6C69' },
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  RIDE: Bike, VIRTUAL_RIDE: Bike, RUN: Activity,
  STRENGTH: Dumbbell, HIKE: Activity, OTHER: Activity,
}

const TYPE_LABELS: Record<string, string> = {
  RIDE: 'Vélo', VIRTUAL_RIDE: 'Home trainer',
  RUN: 'Course à pied', STRENGTH: 'Renforcement',
  HIKE: 'Randonnée', OTHER: 'Autre',
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<ActivityType[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [stravaConnected, setStravaConnected] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadActivities()
    checkStrava()
  }, [])

  async function loadActivities() {
    setLoading(true)
    const res = await fetch('/api/activities?limit=100')
    const data = await res.json()
    setActivities(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  async function checkStrava() {
    const res = await fetch('/api/profile')
    const profile = await res.json()
    setStravaConnected(!!profile?.stravaId)
  }

  async function syncStrava() {
    setSyncing(true)
    setSyncResult(null)
    const res = await fetch('/api/strava/sync', { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setSyncResult(`✓ ${data.synced} activité(s) importée(s)`)
      loadActivities()
    } else {
      setSyncResult(`Erreur : ${data.error}`)
    }
    setSyncing(false)
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadError(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('source', file.name.toLowerCase().includes('whoosh') ? 'MYWHOOSH' : 'MANUAL')
    formData.append('type', 'RIDE')

    const res = await fetch('/api/activities/upload', { method: 'POST', body: formData })
    const data = await res.json()

    if (res.ok) {
      setActivities(prev => [data, ...prev])
    } else {
      setUploadError(data.error || 'Erreur lors de l\'import')
    }

    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  // Stats semaine
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
  const weekActivities = activities.filter(a => new Date(a.date) >= weekStart)
  const weekTSS = weekActivities.reduce((s, a) => s + (a.tss || 0), 0)
  const weekHours = weekActivities.reduce((s, a) => s + a.duration, 0) / 3600

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-summit-light uppercase tracking-wide">
            Activités
          </h1>
          <p className="text-stone-500 mt-0.5 text-sm">{activities.length} activités importées</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Upload GPX/FIT */}
          <label className="btn-secondary flex items-center gap-2 cursor-pointer">
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            Importer GPX/FIT
            <input
              ref={fileRef}
              type="file"
              accept=".gpx,.fit"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>

          {/* Strava */}
          {stravaConnected ? (
            <button onClick={syncStrava} disabled={syncing} className="btn-primary flex items-center gap-2">
              {syncing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              Sync Strava
            </button>
          ) : (
            <a href="/api/strava/auth" className="btn-primary flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066z" />
                <path d="M9.768 0l2.218 4.28H5.916L9.768 0z" />
                <path d="M9.768 0L5.916 4.28 0 4.28 9.768 0z" opacity=".8" />
              </svg>
              Connecter Strava
            </a>
          )}
        </div>
      </div>

      {/* Feedback */}
      {syncResult && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          <CheckCircle2 size={16} /> {syncResult}
          <button onClick={() => setSyncResult(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}
      {uploadError && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={16} /> {uploadError}
          <button onClick={() => setUploadError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Semaine en cours */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="stat-value">{Math.round(weekHours * 10) / 10}h</div>
          <div className="stat-label">Volume semaine</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{Math.round(weekTSS)}</div>
          <div className="stat-label">TSS semaine</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{weekActivities.length}</div>
          <div className="stat-label">Séances</div>
        </div>
      </div>

      {/* Liste activités */}
      <div className="card">
        {loading ? (
          <div className="p-8 space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
          </div>
        ) : activities.length === 0 ? (
          <div className="p-16 text-center">
            <Activity size={48} className="mx-auto text-stone-700 mb-4" />
            <p className="text-stone-500">Aucune activité — connectez Strava ou importez un fichier GPX/FIT</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {activities.map(activity => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ActivityRow({ activity }: { activity: ActivityType }) {
  const src = SOURCE_LABELS[activity.source]
  const Icon = TYPE_ICONS[activity.type] || Activity

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors">
      <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center flex-shrink-0">
        <Icon size={18} className="text-stone-400" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-summit-light text-sm font-medium truncate">{activity.name}</span>
          <span className="text-xs px-1.5 py-0.5 rounded-md font-medium"
            style={{ background: src.color + '20', color: src.color }}>
            {src.label}
          </span>
        </div>
        <p className="text-stone-600 text-xs mt-0.5">
          {format(new Date(activity.date), "EEEE d MMMM yyyy 'à' HH'h'mm", { locale: fr })}
          {' · '}{TYPE_LABELS[activity.type]}
        </p>
      </div>

      <div className="hidden sm:flex items-center gap-6 text-sm text-stone-400 flex-shrink-0">
        <Metric label="Durée" value={formatDuration(activity.duration)} />
        {activity.distance && <Metric label="Distance" value={`${activity.distance.toFixed(1)} km`} />}
        {activity.elevation && <Metric label="D+" value={`${activity.elevation} m`} />}
        {activity.avgPower && <Metric label="Puissance" value={`${activity.avgPower} W`} />}
        {activity.tss && <Metric label="TSS" value={Math.round(activity.tss).toString()} highlight />}
      </div>
    </div>
  )
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <p className={`font-mono text-sm ${highlight ? 'text-ventoux-400 font-semibold' : 'text-stone-300'}`}>{value}</p>
      <p className="text-stone-600 text-[10px] uppercase tracking-widest">{label}</p>
    </div>
  )
}
