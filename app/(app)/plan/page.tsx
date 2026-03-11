'use client'
import { useState, useEffect } from 'react'
import { format, addDays, startOfWeek, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Sparkles, ChevronLeft, ChevronRight, Loader2, RefreshCw, Info, Mountain } from 'lucide-react'
import type { TrainingPlan, TrainingWeek, TrainingSession, Race, UserProfile } from '@/types'
import { formatMinutes } from '@/lib/training'

const ZONE_COLORS: Record<number, string> = {
  1: '#6B9EFF', 2: '#4ECCA3', 3: '#F7C948', 4: '#FF9F45',
  5: '#FF5252', 6: '#C45EFF', 7: '#FF2D9A',
}

const TYPE_BG: Record<string, string> = {
  ENDURANCE: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
  TEMPO: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
  THRESHOLD: 'bg-orange-500/10 border-orange-500/20 text-orange-300',
  VO2MAX: 'bg-red-500/10 border-red-500/20 text-red-300',
  SWEET_SPOT: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300',
  RECOVERY: 'bg-green-500/10 border-green-500/20 text-green-300',
  LONG_RIDE: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300',
  RACE_SIM: 'bg-ventoux-500/10 border-ventoux-500/20 text-ventoux-300',
  STRENGTH: 'bg-purple-500/10 border-purple-500/20 text-purple-300',
  REST: 'bg-stone-800/50 border-stone-700/30 text-stone-500',
  VIRTUAL_RIDE: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300',
}

const TYPE_LABELS: Record<string, string> = {
  ENDURANCE: 'Endurance', TEMPO: 'Tempo', THRESHOLD: 'Seuil',
  VO2MAX: 'VO2Max', SWEET_SPOT: 'Sweet Spot', RECOVERY: 'Récupération',
  LONG_RIDE: 'Longue sortie', RACE_SIM: 'Simul. course',
  STRENGTH: '💪 Renforcement', REST: 'Repos', VIRTUAL_RIDE: 'Home trainer',
}

const DAYS_FR = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM']
const DAY_KEYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

const PHASE_COLORS: Record<string, string> = {
  BASE: 'text-blue-400 bg-blue-500/10',
  BUILD: 'text-amber-400 bg-amber-500/10',
  PEAK: 'text-red-400 bg-red-500/10',
  TAPER: 'text-green-400 bg-green-500/10',
  RECOVERY: 'text-stone-400 bg-stone-700/30',
}

export default function PlanPage() {
  const [plan, setPlan] = useState<TrainingPlan | null>(null)
  const [races, setRaces] = useState<Race[]>([])
  const [selectedRaceId, setSelectedRaceId] = useState<string>('')
  const [currentWeekIdx, setCurrentWeekIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [plansRes, racesRes] = await Promise.all([
      fetch('/api/plan/generate'),
      fetch('/api/races'),
    ])
    const [plans, racesData] = await Promise.all([plansRes.json(), racesRes.json()])

    setRaces(Array.isArray(racesData) ? racesData : [])

    if (Array.isArray(plans) && plans.length > 0) {
      const activePlan = plans[0] as TrainingPlan
      setPlan(activePlan)
      setSelectedRaceId(activePlan.raceId)

      // Trouver la semaine courante
      const today = new Date()
      const idx = activePlan.weeks?.findIndex((w: TrainingWeek) => {
        const ws = new Date(w.weekStart)
        const we = addDays(ws, 7)
        return today >= ws && today < we
      }) ?? 0
      setCurrentWeekIdx(Math.max(0, idx))
    } else if (Array.isArray(racesData) && racesData.length > 0) {
      setSelectedRaceId(racesData[0].id)
    }

    setLoading(false)
  }

  async function generatePlan() {
    if (!selectedRaceId) return
    setGenerating(true)
    setError('')

    try {
      const res = await fetch('/api/plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raceId: selectedRaceId }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erreur de génération')
      } else {
        const newPlan = await res.json()
        setPlan({ ...newPlan, race: races.find(r => r.id === selectedRaceId) } as any)
        setCurrentWeekIdx(0)
      }
    } catch (e) {
      setError('Erreur réseau')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="skeleton h-8 w-48 rounded-xl" />
      <div className="skeleton h-32 rounded-2xl" />
      <div className="skeleton h-96 rounded-2xl" />
    </div>
  )

  const currentWeek = plan?.weeks?.[currentWeekIdx]
  const selectedRace = races.find(r => r.id === selectedRaceId)

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-summit-light uppercase tracking-wide">
            Plan d'entraînement
          </h1>
          {plan && (
            <p className="text-stone-500 mt-0.5 text-sm">
              Généré le {format(new Date(plan.generatedAt), 'dd MMM yyyy', { locale: fr })}
              {' · '}{plan.weeks?.length || 0} semaines
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {races.length > 0 && (
            <select
              value={selectedRaceId}
              onChange={e => setSelectedRaceId(e.target.value)}
              className="input w-auto py-2 text-sm"
            >
              {races.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={generatePlan}
            disabled={generating || !selectedRaceId}
            className="btn-primary flex items-center gap-2"
          >
            {generating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {plan ? 'Régénérer' : 'Générer le plan'}
          </button>
        </div>
      </div>

      {error && (
        <div className="card border-red-500/20 p-4 text-red-400 text-sm flex items-center gap-2">
          <Info size={16} /> {error}
        </div>
      )}

      {!plan && !generating && (
        <div className="card p-12 text-center">
          <Mountain size={48} className="mx-auto text-stone-700 mb-4" />
          <h2 className="font-display text-xl font-semibold text-summit-light mb-2 uppercase">
            Aucun plan généré
          </h2>
          <p className="text-stone-500 mb-6 max-w-md mx-auto">
            Claude analysera vos activités récentes, votre FTP et vos disponibilités pour créer
            un plan personnalisé semaine par semaine.
          </p>
          {races.length === 0 && (
            <p className="text-stone-600 text-sm">
              Commencez par <a href="/races" className="text-ventoux-400">ajouter une course</a>.
            </p>
          )}
        </div>
      )}

      {generating && (
        <div className="card p-12 text-center">
          <Loader2 size={32} className="mx-auto text-ventoux-500 animate-spin mb-4" />
          <h2 className="font-display text-xl font-semibold text-summit-light uppercase">
            Claude analyse votre profil…
          </h2>
          <p className="text-stone-500 mt-2">Génération du plan en cours, 20-30 secondes</p>
        </div>
      )}

      {plan && !generating && (
        <>
          {/* AI Notes */}
          {plan.aiNotes && (
            <div className="card p-5 border-ventoux-500/20 bg-ventoux-500/5">
              <div className="flex items-start gap-3">
                <Sparkles size={16} className="text-ventoux-400 mt-0.5 flex-shrink-0" />
                <p className="text-stone-300 text-sm leading-relaxed">{plan.aiNotes}</p>
              </div>
            </div>
          )}

          {/* Phases overview */}
          <div className="card p-5">
            <h2 className="section-title text-sm mb-4">Phases d'entraînement</h2>
            <div className="flex gap-2 flex-wrap">
              {plan.phases?.map((phase: any) => (
                <div key={phase.name} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${PHASE_COLORS[phase.type] || 'text-stone-400 bg-stone-700/30'}`}>
                  {phase.name}
                  <span className="text-current/60 ml-1.5">S{phase.startWeek}→S{phase.endWeek}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Week navigator */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCurrentWeekIdx(i => Math.max(0, i - 1))}
                    disabled={currentWeekIdx === 0}
                    className="btn-ghost p-1.5 disabled:opacity-30"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div>
                    <h2 className="font-display text-lg font-semibold text-summit-light uppercase tracking-wide">
                      Semaine {(currentWeek?.weekNumber || currentWeekIdx + 1)}
                    </h2>
                    {currentWeek && (
                      <p className="text-stone-500 text-xs">
                        {format(new Date(currentWeek.weekStart), 'dd MMM', { locale: fr })}
                        {' → '}
                        {format(addDays(new Date(currentWeek.weekStart), 6), 'dd MMM yyyy', { locale: fr })}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setCurrentWeekIdx(i => Math.min((plan.weeks?.length || 1) - 1, i + 1))}
                    disabled={currentWeekIdx >= (plan.weeks?.length || 1) - 1}
                    className="btn-ghost p-1.5 disabled:opacity-30"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              {currentWeek && (
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <p className="font-display text-xl font-bold text-summit-light">{currentWeek.totalHours}h</p>
                    <p className="text-stone-600 text-xs uppercase tracking-widest">Volume</p>
                  </div>
                  <div>
                    <p className="font-display text-xl font-bold text-summit-light">{currentWeek.totalTss}</p>
                    <p className="text-stone-600 text-xs uppercase tracking-widest">TSS total</p>
                  </div>
                  {currentWeek.phase && (
                    <div className={`px-2.5 py-1 rounded-lg text-xs font-medium ${PHASE_COLORS[currentWeek.phase] || ''}`}>
                      {currentWeek.phase}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Week notes */}
            {currentWeek?.notes && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-white/[0.03] mb-4">
                <Info size={14} className="text-stone-500 mt-0.5 flex-shrink-0" />
                <p className="text-stone-400 text-sm">{currentWeek.notes}</p>
              </div>
            )}

            {/* Sessions grid */}
            {currentWeek && (
              <div className="grid grid-cols-7 gap-2">
                {DAY_KEYS.map((dayKey, i) => {
                  const sessions = currentWeek.sessions?.filter((s: TrainingSession) => s.day === dayKey) || []
                  const weekDate = addDays(new Date(currentWeek.weekStart), i)
                  const isToday = format(weekDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

                  return (
                    <div key={dayKey} className={`rounded-xl p-2 min-h-[100px] ${
                      isToday ? 'border border-ventoux-500/30 bg-ventoux-500/5' : 'bg-white/[0.02]'
                    }`}>
                      <p className={`text-xs font-medium mb-1 text-center ${isToday ? 'text-ventoux-400' : 'text-stone-600'}`}>
                        {DAYS_FR[i]}
                        <span className="block text-[10px] font-normal">{format(weekDate, 'd')}</span>
                      </p>
                      {sessions.length > 0 ? (
                        <div className="space-y-1.5">
                          {sessions.map((session: TrainingSession) => (
                            <SessionPill key={session.id} session={session} />
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-12 text-stone-700 text-xs">
                          —
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Week list overview */}
          <div className="card p-5">
            <h2 className="section-title text-sm mb-4">Vue d'ensemble ({plan.weeks?.length} semaines)</h2>
            <div className="space-y-1.5">
              {plan.weeks?.map((week: TrainingWeek, i: number) => {
                const isCurrentWeek = i === currentWeekIdx
                const weekStart = new Date(week.weekStart)
                const today = new Date()
                const isPast = addDays(weekStart, 7) < today

                return (
                  <button
                    key={i}
                    onClick={() => setCurrentWeekIdx(i)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all ${
                      isCurrentWeek ? 'bg-ventoux-500/10 border border-ventoux-500/20' :
                      isPast ? 'opacity-50 hover:opacity-70 hover:bg-white/[0.03]' :
                      'hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-mono w-6 ${isCurrentWeek ? 'text-ventoux-400' : 'text-stone-600'}`}>
                        S{week.weekNumber}
                      </span>
                      <span className="text-stone-400 text-sm">
                        {format(weekStart, 'dd MMM', { locale: fr })}
                      </span>
                      {week.phase && (
                        <span className={`text-xs px-2 py-0.5 rounded-md ${PHASE_COLORS[week.phase] || ''}`}>
                          {week.phase}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-stone-500">
                      <span>{week.totalHours}h</span>
                      <span>TSS {week.totalTss}</span>
                      <span>{week.sessions?.length || 0} séances</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function SessionPill({ session }: { session: TrainingSession }) {
  const styles = TYPE_BG[session.type] || 'bg-stone-800/50 border-stone-700/30 text-stone-400'
  const color = ZONE_COLORS[session.intensityZone] || '#6E6C69'

  return (
    <div className={`px-2 py-1.5 rounded-lg border text-[10px] leading-tight ${styles}`}
      title={`${session.name}\n${session.description}\n${session.duration}min · TSS~${session.tssTarget}`}>
      <div className="font-medium truncate">{TYPE_LABELS[session.type] || session.type}</div>
      <div className="opacity-70">{session.duration}min</div>
    </div>
  )
}
