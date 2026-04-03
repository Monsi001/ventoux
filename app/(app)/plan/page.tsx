'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { format, addDays, startOfWeek, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Sparkles, ChevronLeft, ChevronRight, Loader2, RefreshCw, Info, Mountain, X, Dumbbell, Bike, Check, Calendar, Play, Pause, SkipForward, RotateCcw, Trash2, Sun, Cloud, MapPin, Download, Train, Wind, Thermometer, MessageCircle, Send } from 'lucide-react'
import type { TrainingPlan, TrainingWeek, TrainingSession, Race, UserProfile, Activity } from '@/types'
import { formatMinutes, calculatePMC } from '@/lib/training'
import { GlossaryButton, Term } from '@/components/ui/Tooltip'
import { cachedFetch, invalidateCache } from '@/lib/fetch-cache'

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
  VO2MAX: 'VO2max', SWEET_SPOT: 'Sweet Spot', RECOVERY: 'Récup',
  LONG_RIDE: 'Sortie longue', RACE_SIM: 'Simul. Course', STRENGTH: 'Renfo',
  REST: 'Repos', VIRTUAL_RIDE: 'Virtuel',
}

const TYPE_ICONS: Record<string, string> = {
  ENDURANCE: '🚴', TEMPO: '⚡', THRESHOLD: '🔥', VO2MAX: '💥',
  SWEET_SPOT: '🎯', RECOVERY: '🌿', LONG_RIDE: '🏔️', RACE_SIM: '🏁',
  STRENGTH: '💪', REST: '😴', VIRTUAL_RIDE: '🖥️',
}

const PHASE_COLORS: Record<string, string> = {
  BASE: 'text-blue-400 bg-blue-500/10',
  BUILD: 'text-amber-400 bg-amber-500/10',
  PEAK: 'text-red-400 bg-red-500/10',
  SPECIALTY: 'text-red-400 bg-red-500/10',
  TAPER: 'text-green-400 bg-green-500/10',
  RECOVERY: 'text-stone-400 bg-stone-700/30',
}

const PHASE_BAR_COLORS: Record<string, string> = {
  BASE: 'bg-blue-500', BUILD: 'bg-amber-500', PEAK: 'bg-red-500',
  SPECIALTY: 'bg-red-500', TAPER: 'bg-green-500', RECOVERY: 'bg-stone-600',
}

const PHASE_DOT_COLORS: Record<string, string> = {
  BASE: 'bg-blue-400', BUILD: 'bg-amber-400', PEAK: 'bg-red-400',
  SPECIALTY: 'bg-red-400', TAPER: 'bg-green-400', RECOVERY: 'bg-stone-400',
}

const DAY_KEYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const DAYS_FR_LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export default function PlanPage() {
  const [plan, setPlan] = useState<TrainingPlan | null>(null)
  const [races, setRaces] = useState<Race[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [selectedRaceId, setSelectedRaceId] = useState<string>('')
  const [currentWeekIdx, setCurrentWeekIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null)
  const [mywhooshWorkout, setMywhooshWorkout] = useState<any>(null)
  const [loadingWorkout, setLoadingWorkout] = useState(false)
  const [readjusting, setReadjusting] = useState(false)
  const [readjustMsg, setReadjustMsg] = useState('')
  const [rideSuggestions, setRideSuggestions] = useState<any[] | null>(null)
  const [loadingRide, setLoadingRide] = useState(false)
  const [planStartDate, setPlanStartDate] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'))
  const [includeStrength, setIncludeStrength] = useState(true)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMsg, setChatMsg] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'coach'; text: string }[]>([])

  async function sendCoachMessage() {
    if (!chatMsg.trim() || !plan) return
    const msg = chatMsg.trim()
    setChatMsg('')
    setChatHistory(h => [...h, { role: 'user', text: msg }])
    setChatLoading(true)

    try {
      const res = await fetch('/api/plan/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, message: msg }),
      })
      const data = await res.json()
      if (res.ok && data.weeks) {
        setPlan({ ...plan, weeks: data.weeks })
        setChatHistory(h => [...h, { role: 'coach', text: data.reply }])
        invalidateCache('/api/init')
      } else {
        setChatHistory(h => [...h, { role: 'coach', text: data.error || 'Erreur, réessaie.' }])
      }
    } catch {
      setChatHistory(h => [...h, { role: 'coach', text: 'Erreur réseau.' }])
    } finally {
      setChatLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Fermer les panels avec Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (chatOpen) { setChatOpen(false); return }
        if (selectedSession) { setSelectedSession(null); return }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [chatOpen, selectedSession])

  async function loadData() {
    setLoading(true)
    const data = await cachedFetch('/api/init?include=plans,races,activities&activityLimit=60')
    const plans = Array.isArray(data.plans) ? data.plans : []
    const racesData = Array.isArray(data.races) ? data.races : []
    const activitiesData = Array.isArray(data.activities) ? data.activities : []

    setRaces(racesData)
    setActivities(activitiesData)

    if (Array.isArray(plans) && plans.length > 0) {
      const activePlan = plans[0] as TrainingPlan
      setPlan(activePlan)
      setSelectedRaceId(activePlan.raceId)

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
        body: JSON.stringify({ raceId: selectedRaceId, startDate: planStartDate, includeStrength }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erreur de génération')
      } else {
        const newPlan = await res.json()
        invalidateCache('/api/plan')
        invalidateCache('/api/init')
        setPlan({ ...newPlan, race: races.find(r => r.id === selectedRaceId) } as any)
        setCurrentWeekIdx(0)
      }
    } catch (e) {
      setError('Erreur réseau')
    } finally {
      setGenerating(false)
    }
  }

  async function deletePlan() {
    if (!plan) return
    try {
      await fetch(`/api/plan/${plan.id}`, { method: 'DELETE' })
      invalidateCache('/api/init')
      setPlan(null)
      setSelectedSession(null)
    } catch (e) {}
  }

  async function triggerReadjust(planId: string, sessionId: string, changeDescription: string) {
    setReadjusting(true)
    setReadjustMsg('')
    try {
      const res = await fetch('/api/plan/readjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, changedSessionId: sessionId, changeDescription }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.weeks && plan) {
          setPlan({ ...plan, weeks: data.weeks })
          setReadjustMsg(data.explanation || 'Plan réajusté')
          if (selectedSession) {
            for (const week of data.weeks) {
              const updated = week.sessions.find((s: any) => s.id === selectedSession.id)
              if (updated) { setSelectedSession(updated); break }
            }
          }
          setTimeout(() => setReadjustMsg(''), 5000)
        }
      }
    } catch (e) {
      console.error('Readjust failed:', e)
    }
    setReadjusting(false)
  }

  async function moveSession(sessionId: string, newDay: string) {
    if (!plan) return
    const week = plan.weeks[currentWeekIdx]
    if (!week) return

    const movedSession = week.sessions.find(s => s.id === sessionId)
    if (!movedSession || movedSession.day === newDay) return

    const oldDay = movedSession.day
    const isCycling = (type: string) => type !== 'STRENGTH' && type !== 'REST'

    // Validation : pas 2 séances vélo le même jour
    if (isCycling(movedSession.type)) {
      const existingCycling = week.sessions.find(s => s.id !== sessionId && s.day === newDay && isCycling(s.type))
      if (existingCycling) {
        setError('Impossible : il y a déjà une séance vélo ce jour-là')
        setTimeout(() => setError(''), 3000)
        return
      }
    }

    const updatedWeeks = plan.weeks.map((w, idx) => {
      if (idx !== currentWeekIdx) return w
      return {
        ...w,
        sessions: w.sessions.map(s =>
          s.id === sessionId ? { ...s, day: newDay as any } : s
        ),
      }
    })
    setPlan({ ...plan, weeks: updatedWeeks })
    if (selectedSession?.id === sessionId) {
      setSelectedSession({ ...selectedSession, day: newDay as any })
    }

    await fetch('/api/plan/update-session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: plan.id, weekIndex: currentWeekIdx, sessionId, updates: { day: newDay } }),
    }).catch(() => {})

    triggerReadjust(plan.id, sessionId, `déplacé de ${oldDay} à ${newDay}`)
  }

  async function toggleIndoor(sessionId: string, indoor: boolean) {
    if (!plan) return

    const updatedWeeks = plan.weeks.map((week, idx) => {
      if (idx !== currentWeekIdx) return week
      return {
        ...week,
        sessions: week.sessions.map(s =>
          s.id === sessionId ? { ...s, indoor } : s
        ),
      }
    })
    setPlan({ ...plan, weeks: updatedWeeks })

    if (indoor) {
      const session = plan.weeks[currentWeekIdx]?.sessions.find(s => s.id === sessionId)
      if (session) {
        try {
          const res = await fetch(`/api/workouts?sessionType=${session.type}&duration=${session.duration}&tss=${session.tssTarget || ''}&limit=1`)
          if (res.ok) {
            const data = await res.json()
            if (data.suggestions?.length > 0) {
              const match = data.suggestions[0]
              const newWeeks = updatedWeeks.map((week, idx) => {
                if (idx !== currentWeekIdx) return week
                return {
                  ...week,
                  sessions: week.sessions.map(s =>
                    s.id === sessionId ? { ...s, indoor: true, mywhooshWorkoutId: match.id, mywhooshWorkoutName: match.name } : s
                  ),
                }
              })
              setPlan({ ...plan, weeks: newWeeks })
              if (selectedSession?.id === sessionId) {
                setSelectedSession({ ...selectedSession, indoor: true, mywhooshWorkoutId: match.id, mywhooshWorkoutName: match.name })
                loadWorkoutDetail(match.id)
              }
              await fetch('/api/plan/update-session', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId: plan.id, weekIndex: currentWeekIdx, sessionId, updates: { indoor: true, mywhooshWorkoutId: match.id, mywhooshWorkoutName: match.name } }),
              }).catch(() => {})
            }
          }
        } catch (e) {}
      }
    } else {
      if (selectedSession?.id === sessionId) {
        setSelectedSession({ ...selectedSession, indoor })
        setMywhooshWorkout(null)
      }
      await fetch('/api/plan/update-session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, weekIndex: currentWeekIdx, sessionId, updates: { indoor, mywhooshWorkoutId: null, mywhooshWorkoutName: null } }),
      }).catch(() => {})
    }
  }

  async function loadWorkoutDetail(workoutId: string) {
    setLoadingWorkout(true)
    try {
      const res = await fetch(`/api/workouts/${workoutId}`)
      if (res.ok) {
        setMywhooshWorkout(await res.json())
      }
    } catch (e) {}
    setLoadingWorkout(false)
  }

  async function loadRideSuggestions(session: TrainingSession) {
    if (session.type === 'STRENGTH' || session.type === 'REST') return
    setLoadingRide(true)
    setRideSuggestions(null)
    try {
      const dayIdx = DAY_KEYS.indexOf(session.day)
      const sessionDate = currentWeek ? format(addDays(new Date(currentWeek.weekStart), dayIdx), 'yyyy-MM-dd') : ''
      const res = await fetch(`/api/plan/suggest-ride?type=${session.type}&duration=${session.duration}&date=${sessionDate}`)
      if (res.ok) {
        const data = await res.json()
        setRideSuggestions(data.suggestions || [])
      }
    } catch (e) {}
    setLoadingRide(false)
  }

  async function downloadGpx(sectorId: string, routeIndex: number, routeName: string) {
    const dayIdx = selectedSession ? DAY_KEYS.indexOf(selectedSession.day) : 0
    const sessionDate = currentWeek ? format(addDays(new Date(currentWeek.weekStart), dayIdx), 'yyyy-MM-dd') : ''
    try {
      const res = await fetch('/api/plan/suggest-ride', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectorId, routeIndex, date: sessionDate }),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${routeName}.gpx`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (e) {}
  }

  function openSessionDetail(session: TrainingSession) {
    setSelectedSession(session)
    setMywhooshWorkout(null)
    setRideSuggestions(null)
    if (session.mywhooshWorkoutId) {
      loadWorkoutDetail(session.mywhooshWorkoutId)
    }
    // Load ride suggestions for outdoor cycling sessions
    if (!session.indoor && session.type !== 'STRENGTH' && session.type !== 'REST') {
      loadRideSuggestions(session)
    }
  }

  function getActivityForDay(weekStart: string, dayIdx: number): Activity | undefined {
    const dayDate = format(addDays(new Date(weekStart), dayIdx), 'yyyy-MM-dd')
    return activities.find(a => format(new Date(a.date), 'yyyy-MM-dd') === dayDate)
  }

  async function markSessionDone(session: TrainingSession) {
    if (!plan || !currentWeek) return

    // Compute session date from weekStart + day
    const dayIdx = DAY_KEYS.indexOf(session.day)
    const sessionDate = addDays(new Date(currentWeek.weekStart), dayIdx)

    // Create a manual activity
    try {
      const actRes = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'MANUAL',
          type: session.type === 'STRENGTH' ? 'STRENGTH' : 'RIDE',
          name: session.name || TYPE_LABELS[session.type] || session.type,
          date: sessionDate.toISOString(),
          duration: session.duration * 60, // API expects seconds
          tss: session.tssTarget || null,
        }),
      })

      if (!actRes.ok) return

      const newActivity = await actRes.json()

      // Mark session as completed in plan
      const updatedWeeks = plan.weeks.map((week, idx) => {
        if (idx !== currentWeekIdx) return week
        return {
          ...week,
          sessions: week.sessions.map(s =>
            s.id === session.id ? { ...s, completed: true, activityId: newActivity.id } : s
          ),
        }
      })
      setPlan({ ...plan, weeks: updatedWeeks })
      setSelectedSession({ ...session, completed: true, activityId: newActivity.id })
      setActivities(prev => [newActivity, ...prev])
      invalidateCache('/api/init')

      // Persist to plan
      await fetch('/api/plan/update-session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, weekIndex: currentWeekIdx, sessionId: session.id, updates: { completed: true, activityId: newActivity.id } }),
      }).catch(() => {})
    } catch (e) {
      console.error('markSessionDone error:', e)
    }
  }

  async function undoSessionDone(session: TrainingSession) {
    if (!plan) return

    // Delete the linked activity if it was manual
    if (session.activityId) {
      await fetch(`/api/activities/${session.activityId}`, { method: 'DELETE' }).catch(() => {})
      setActivities(prev => prev.filter(a => a.id !== session.activityId))
    }

    const updatedWeeks = plan.weeks.map((week, idx) => {
      if (idx !== currentWeekIdx) return week
      return {
        ...week,
        sessions: week.sessions.map(s =>
          s.id === session.id ? { ...s, completed: false, activityId: undefined } : s
        ),
      }
    })
    setPlan({ ...plan, weeks: updatedWeeks })
    setSelectedSession({ ...session, completed: false, activityId: undefined })
    invalidateCache('/api/init')

    await fetch('/api/plan/update-session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: plan.id, weekIndex: currentWeekIdx, sessionId: session.id, updates: { completed: false, activityId: null } }),
    }).catch(() => {})
  }

  // Loading state
  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={28} className="text-ventoux-500 animate-spin" />
    </div>
  )

  const currentWeek = plan?.weeks?.[currentWeekIdx]
  const selectedRace = races.find(r => r.id === selectedRaceId)
  const weekTotalMinutes = currentWeek?.sessions?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0
  const weekTotalHours = Math.round(weekTotalMinutes / 60 * 10) / 10
  const weekTotalTss = currentWeek?.sessions?.reduce((sum, s) => sum + (s.tssTarget || 0), 0) || 0

  // Actual week stats from activities
  const currentWeekStart = currentWeek ? new Date(currentWeek.weekStart) : null
  const currentWeekEnd = currentWeekStart ? addDays(currentWeekStart, 6) : null
  const currentWeekActivities = currentWeekStart && currentWeekEnd
    ? activities.filter(a => { const d = new Date(a.date); return d >= currentWeekStart && d <= currentWeekEnd })
    : []
  const actualWeekHours = Math.round(currentWeekActivities.reduce((s, a) => s + a.duration, 0) / 3600 * 10) / 10
  const actualWeekTss = Math.round(currentWeekActivities.reduce((s, a) => s + (a.tss || 0), 0))

  // PMC (CTL / ATL / TSB)
  const pmcData = calculatePMC(
    activities.filter(a => a.tss != null).map(a => ({ date: a.date, tss: a.tss! })),
    90
  )
  const latestPmc = pmcData.length > 0 ? pmcData[pmcData.length - 1] : null

  // ─── No plan state ──────────────────────────────────────────────────────────
  if (!plan && !generating) return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4">
      <Mountain size={56} className="text-stone-700 mb-6" />
      <h1 className="font-display text-2xl md:text-3xl font-bold text-summit-light uppercase tracking-wide text-center mb-3">
        Plan d'entraînement
      </h1>
      <p className="text-stone-500 text-center max-w-md mb-8">
        Claude analysera vos activités, votre FTP et vos disponibilités pour créer un plan personnalisé.
      </p>

      <div className="w-full max-w-sm space-y-4">
        {races.length > 0 ? (
          <>
            <select
              value={selectedRaceId}
              onChange={e => setSelectedRaceId(e.target.value)}
              className="input text-center"
            >
              <option value="">Choisir une course</option>
              {races.map(r => (
                <option key={r.id} value={r.id}>{r.name} — {format(new Date(r.date), 'dd MMM yyyy', { locale: fr })}</option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-stone-500 flex-shrink-0" />
              <input
                type="date"
                value={planStartDate}
                onChange={e => setPlanStartDate(e.target.value)}
                className="input text-sm [color-scheme:dark]"
              />
            </div>
            <button
              onClick={() => setIncludeStrength(v => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-sm w-full justify-center ${
                includeStrength
                  ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                  : 'bg-white/[0.03] border-white/[0.06] text-stone-500'
              }`}
            >
              <Dumbbell size={15} />
              {includeStrength ? 'Renforcement inclus' : 'Sans renforcement'}
            </button>
            <button
              onClick={generatePlan}
              disabled={generating || !selectedRaceId}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Sparkles size={16} /> Générer le plan
            </button>
          </>
        ) : (
          <p className="text-stone-600 text-sm text-center">
            Commencez par <a href="/races" className="text-ventoux-400 hover:underline">ajouter une course</a>.
          </p>
        )}
      </div>

      {error && (
        <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm max-w-sm w-full">
          {error}
        </div>
      )}
    </div>
  )

  // ─── Generating state ───────────────────────────────────────────────────────
  if (generating) return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center">
      <Loader2 size={36} className="text-ventoux-500 animate-spin mb-4" />
      <h2 className="font-display text-xl font-semibold text-summit-light uppercase">
        Claude analyse votre profil…
      </h2>
      <p className="text-stone-500 mt-2">Génération du plan en cours</p>
    </div>
  )

  // ─── Plan view ──────────────────────────────────────────────────────────────
  return (
    <div className="animate-in pb-8">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 -mx-4 px-4 pt-2 pb-4 bg-gradient-to-b from-stone-950 via-stone-950/95 to-transparent">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            {/* Week nav */}
            <button
              onClick={() => setCurrentWeekIdx(i => Math.max(0, i - 1))}
              disabled={currentWeekIdx === 0}
              className="p-2 rounded-lg text-stone-500 hover:text-summit-light hover:bg-white/[0.05] disabled:opacity-20 transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-xl md:text-2xl font-bold text-summit-light uppercase tracking-wide truncate">
                Semaine {currentWeek?.weekNumber || currentWeekIdx + 1}
                {currentWeek?.phase && (
                  <span className={`ml-2 text-sm px-2 py-0.5 rounded-md align-middle ${PHASE_COLORS[currentWeek.phase] || ''}`}>
                    {currentWeek.phase}
                  </span>
                )}
              </h1>
              {currentWeek && (
                <p className="text-stone-500 text-xs">
                  {format(new Date(currentWeek.weekStart), 'dd MMM', { locale: fr })}
                  {' — '}
                  {format(addDays(new Date(currentWeek.weekStart), 6), 'dd MMM yyyy', { locale: fr })}
                </p>
              )}
            </div>
            <button
              onClick={() => setCurrentWeekIdx(i => Math.min((plan!.weeks?.length || 1) - 1, i + 1))}
              disabled={currentWeekIdx >= (plan!.weeks?.length || 1) - 1}
              className="p-2 rounded-lg text-stone-500 hover:text-summit-light hover:bg-white/[0.05] disabled:opacity-20 transition-all"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Right: stats + actions */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-5 text-right">
              <div>
                <p className="font-display text-lg font-bold text-summit-light">
                  {actualWeekHours > 0 ? `${actualWeekHours}` : '—'}
                  <span className="text-stone-600 text-xs font-normal"> / {weekTotalHours}h</span>
                </p>
                <p className="text-stone-600 text-[10px] uppercase tracking-widest">Volume</p>
              </div>
              <div>
                <p className="font-display text-lg font-bold text-summit-light">
                  {actualWeekTss > 0 ? actualWeekTss : '—'}
                  <span className="text-stone-600 text-xs font-normal"> / {weekTotalTss}</span>
                </p>
                <p className="text-stone-600 text-[10px] uppercase tracking-widest"><Term term="TSS">TSS</Term></p>
              </div>
            </div>
            <GlossaryButton />
            {races.length > 1 && (
              <select
                value={selectedRaceId}
                onChange={e => setSelectedRaceId(e.target.value)}
                className="input text-xs py-1 px-2 max-w-[160px] [color-scheme:dark]"
              >
                {races.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            )}
            <div className="flex items-center gap-1">
              <Calendar size={14} className="text-stone-600 flex-shrink-0" />
              <input
                type="date"
                value={planStartDate}
                onChange={e => setPlanStartDate(e.target.value)}
                className="input text-xs py-1 px-2 w-[130px] [color-scheme:dark]"
              />
            </div>
            <button
              onClick={() => setIncludeStrength(v => !v)}
              className={`p-2 rounded-lg transition-all ${
                includeStrength
                  ? 'text-purple-400 bg-purple-500/10'
                  : 'text-stone-600 hover:text-stone-400'
              }`}
              title={includeStrength ? 'Renfo inclus (cliquer pour exclure)' : 'Sans renfo (cliquer pour inclure)'}
            >
              <Dumbbell size={16} />
            </button>
            <button
              onClick={generatePlan}
              disabled={generating}
              className="p-2 rounded-lg text-stone-500 hover:text-ventoux-400 hover:bg-ventoux-500/10 transition-all"
              title="Régénérer"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={deletePlan}
              className="p-2 rounded-lg text-stone-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="Supprimer le plan"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Mobile stats row */}
        <div className="flex sm:hidden items-center gap-3 mt-2 text-xs text-stone-500">
          <span className="font-display font-bold text-summit-light">{actualWeekHours > 0 ? actualWeekHours : '—'}<span className="text-stone-600 font-normal">/{weekTotalHours}h</span></span>
          <span>·</span>
          <span><Term term="TSS">TSS {actualWeekTss > 0 ? actualWeekTss : '—'}/{weekTotalTss}</Term></span>
          <span>·</span>
          <span>{currentWeek?.sessions?.length || 0} séances</span>
        </div>
      </div>

      {/* Phase progress bar */}
      {plan!.phases?.length > 0 && (() => {
        const totalPlanWeeks = Math.max(...plan!.phases.map((p: any) => p.endWeek || 0), 1)
        const currentWeekNum = currentWeek?.weekNumber || 1
        const currentPhase = plan!.phases.find((p: any) => currentWeekNum >= p.startWeek && currentWeekNum <= p.endWeek)
        const progressPct = Math.min(100, Math.max(0, ((currentWeekNum - 0.5) / totalPlanWeeks) * 100))

        return (
          <div className="mb-6">
            <div className="relative">
              <div className="flex h-2 rounded-full overflow-hidden bg-white/[0.03]">
                {plan!.phases.map((phase: any) => {
                  const phaseWeeks = (phase.endWeek - phase.startWeek + 1)
                  const widthPct = (phaseWeeks / totalPlanWeeks) * 100
                  const isActive = currentPhase?.type === phase.type && currentPhase?.startWeek === phase.startWeek
                  const isPast = phase.endWeek < currentWeekNum

                  return (
                    <div
                      key={`${phase.type}-${phase.startWeek}`}
                      style={{ width: `${widthPct}%` }}
                      className={`transition-all ${PHASE_BAR_COLORS[phase.type] || 'bg-stone-600'} ${
                        isActive ? '/40' : isPast ? '/25' : '/10'
                      }`}
                    />
                  )
                })}
              </div>
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-summit-light border-2 border-stone-950 shadow-[0_0_8px_rgba(255,255,255,0.3)] transition-all duration-500"
                style={{ left: `${progressPct}%`, marginLeft: '-6px' }}
              />
            </div>
            {/* Phase labels under bar */}
            <div className="flex mt-1.5">
              {plan!.phases.map((phase: any) => {
                const phaseWeeks = (phase.endWeek - phase.startWeek + 1)
                const widthPct = (phaseWeeks / totalPlanWeeks) * 100
                const isActive = currentPhase?.type === phase.type && currentPhase?.startWeek === phase.startWeek
                return (
                  <div key={`label-${phase.type}-${phase.startWeek}`} style={{ width: `${widthPct}%` }} className="text-center">
                    <span className={`text-[10px] ${isActive ? 'text-stone-300 font-medium' : 'text-stone-600'}`}>
                      {phase.name}
                    </span>
                  </div>
                )
              })}
            </div>
            {currentPhase?.description && (
              <p className="text-stone-500 text-xs mt-2">{currentPhase.description}</p>
            )}
          </div>
        )
      })()}

      {/* Training Load (CTL / ATL / TSB) */}
      {latestPmc && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white/[0.02] rounded-xl p-3 text-center">
            <p className={`font-display text-2xl font-bold ${latestPmc.ctl > 60 ? 'text-green-400' : latestPmc.ctl > 30 ? 'text-amber-400' : 'text-stone-300'}`}>
              {Math.round(latestPmc.ctl)}
            </p>
            <p className="text-stone-600 text-[10px] uppercase tracking-widest mt-0.5">
              <Term term="CTL">CTL</Term> · Fitness
            </p>
          </div>
          <div className="bg-white/[0.02] rounded-xl p-3 text-center">
            <p className={`font-display text-2xl font-bold ${latestPmc.atl > latestPmc.ctl * 1.3 ? 'text-red-400' : 'text-stone-300'}`}>
              {Math.round(latestPmc.atl)}
            </p>
            <p className="text-stone-600 text-[10px] uppercase tracking-widest mt-0.5">
              <Term term="ATL">ATL</Term> · Fatigue
            </p>
          </div>
          <div className="bg-white/[0.02] rounded-xl p-3 text-center">
            <p className={`font-display text-2xl font-bold ${latestPmc.tsb > 5 ? 'text-green-400' : latestPmc.tsb < -20 ? 'text-red-400' : 'text-amber-400'}`}>
              {latestPmc.tsb > 0 ? '+' : ''}{Math.round(latestPmc.tsb)}
            </p>
            <p className="text-stone-600 text-[10px] uppercase tracking-widest mt-0.5">
              <Term term="TSB">TSB</Term> · {latestPmc.tsb > 5 ? 'Reposé' : latestPmc.tsb < -20 ? 'Fatigué' : 'Forme'}
            </p>
          </div>
        </div>
      )}

      {/* AI Notes */}
      {plan!.aiNotes && (
        <div className="flex items-start gap-2.5 mb-6 text-sm text-stone-400 leading-relaxed">
          <Sparkles size={14} className="text-ventoux-400 mt-1 flex-shrink-0" />
          <p>{plan!.aiNotes}</p>
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
          <Info size={14} className="text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Readjust indicator */}
      {readjusting && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-ventoux-500/5 border border-ventoux-500/20 mb-4 animate-pulse">
          <Loader2 size={14} className="text-ventoux-400 animate-spin" />
          <p className="text-ventoux-300 text-sm">Réajustement du plan...</p>
        </div>
      )}
      {readjustMsg && !readjusting && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-green-500/5 border border-green-500/20 mb-4">
          <Sparkles size={14} className="text-green-400 mt-0.5 flex-shrink-0" />
          <p className="text-green-300 text-sm">{readjustMsg}</p>
        </div>
      )}

      {/* Week notes */}
      {currentWeek?.notes && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-white/[0.03] mb-5">
          <Info size={14} className="text-stone-500 mt-0.5 flex-shrink-0" />
          <p className="text-stone-400 text-sm">{currentWeek.notes}</p>
        </div>
      )}

      {/* ─── Sessions calendar ─────────────────────────────────────────────────── */}
      {currentWeek && (
        <>
          {/* Desktop: 7 columns */}
          <div className="hidden md:grid grid-cols-7 gap-1.5">
            {DAY_KEYS.map((dayKey, i) => {
              const sessions = currentWeek.sessions?.filter((s: TrainingSession) => s.day === dayKey) || []
              const weekDate = addDays(new Date(currentWeek.weekStart), i)
              const isToday = format(weekDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
              const dayActivity = getActivityForDay(currentWeek.weekStart, i)

              return (
                <div key={dayKey} className={`rounded-xl min-h-[160px] flex flex-col ${
                  isToday ? 'ring-1 ring-ventoux-500/40 bg-ventoux-500/[0.03]' : 'bg-white/[0.015]'
                }`}>
                  {/* Day header */}
                  <div className={`px-2.5 py-2 text-center border-b border-white/[0.04] ${isToday ? 'text-ventoux-400' : 'text-stone-600'}`}>
                    <p className="text-xs font-medium">{DAYS_FR[i]}</p>
                    <p className={`text-lg font-display font-bold ${isToday ? 'text-ventoux-400' : 'text-stone-500'}`}>{format(weekDate, 'd')}</p>
                  </div>

                  {/* Day content */}
                  <div className="flex-1 p-1.5 space-y-1.5">
                    {dayActivity && (
                      <div className="px-2 py-1 rounded-lg bg-green-500/10 text-[10px] text-green-400 flex items-center gap-1">
                        <Check size={8} />
                        <span className="truncate">{dayActivity.name}</span>
                      </div>
                    )}
                    {sessions.map((session: TrainingSession) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        onClick={() => openSessionDetail(session)}
                        done={!!dayActivity || !!session.completed}
                        compact
                      />
                    ))}
                    {sessions.length === 0 && !dayActivity && (
                      <div className="flex items-center justify-center h-full text-stone-800 text-xs">
                        Repos
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Mobile: stacked list */}
          <div className="md:hidden space-y-2">
            {DAY_KEYS.map((dayKey, i) => {
              const sessions = currentWeek.sessions?.filter((s: TrainingSession) => s.day === dayKey) || []
              const weekDate = addDays(new Date(currentWeek.weekStart), i)
              const isToday = format(weekDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
              const dayActivity = getActivityForDay(currentWeek.weekStart, i)

              if (sessions.length === 0 && !dayActivity) return null

              return (
                <div key={dayKey} className={`rounded-xl overflow-hidden ${
                  isToday ? 'ring-1 ring-ventoux-500/40' : ''
                }`}>
                  {/* Day header row */}
                  <div className={`flex items-center gap-3 px-4 py-2.5 ${isToday ? 'bg-ventoux-500/[0.06]' : 'bg-white/[0.02]'}`}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-display font-bold text-sm ${
                      isToday ? 'bg-ventoux-500/20 text-ventoux-400' : 'bg-white/[0.04] text-stone-500'
                    }`}>
                      {format(weekDate, 'd')}
                    </div>
                    <span className={`text-sm font-medium ${isToday ? 'text-ventoux-400' : 'text-stone-500'}`}>
                      {DAYS_FR_LONG[i]}
                    </span>
                    {isToday && <span className="text-[10px] text-ventoux-500 bg-ventoux-500/10 px-2 py-0.5 rounded-full">Aujourd'hui</span>}
                  </div>

                  {/* Sessions */}
                  <div className="px-3 pb-3 pt-1.5 space-y-2">
                    {dayActivity && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/8 text-green-400 text-xs">
                        <Check size={12} />
                        <span className="font-medium">{dayActivity.name}</span>
                        {dayActivity.tss && <span className="ml-auto text-green-500/60">TSS {Math.round(dayActivity.tss)}</span>}
                      </div>
                    )}
                    {sessions.map((session: TrainingSession) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        onClick={() => openSessionDetail(session)}
                        done={!!dayActivity || !!session.completed}
                        compact={false}
                      />
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Show rest days count on mobile */}
            {(() => {
              const activeDays = DAY_KEYS.filter((dayKey, i) => {
                const sessions = currentWeek.sessions?.filter((s: TrainingSession) => s.day === dayKey) || []
                const dayActivity = getActivityForDay(currentWeek.weekStart, i)
                return sessions.length > 0 || dayActivity
              }).length
              const restDays = 7 - activeDays
              return restDays > 0 ? (
                <p className="text-center text-stone-700 text-xs py-2">{restDays} jour{restDays > 1 ? 's' : ''} de repos</p>
              ) : null
            })()}
          </div>
        </>
      )}

      {/* ─── Historique & volume ─────────────────────────────────────────────── */}
      {plan!.weeks && plan!.weeks.length > 1 && (() => {
        const today = new Date()
        const weeksData = plan!.weeks.map((week: TrainingWeek, i: number) => {
          const weekStart = new Date(week.weekStart)
          const weekEnd = addDays(weekStart, 6)
          const isPast = weekEnd < today
          const isCurrent = today >= weekStart && today <= weekEnd

          // Planned
          const plannedMin = week.sessions?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0
          const plannedHrs = Math.round(plannedMin / 60 * 10) / 10
          const plannedTss = week.sessions?.reduce((sum, s) => sum + (s.tssTarget || 0), 0) || 0

          // Actual: activités de cette semaine (duration en secondes)
          const weekActivities = activities.filter(a => {
            const d = new Date(a.date)
            return d >= weekStart && d <= weekEnd
          })
          const actualHrs = Math.round(weekActivities.reduce((sum, a) => sum + (a.duration || 0), 0) / 3600 * 10) / 10
          const actualTss = weekActivities.reduce((sum, a) => sum + (a.tss || 0), 0)

          // Completion
          const totalSessions = week.sessions?.length || 0
          const doneSessions = week.sessions?.filter(s => s.completed).length || 0
          const completionPct = totalSessions > 0 ? Math.round(doneSessions / totalSessions * 100) : 0

          return { week, i, isPast, isCurrent, plannedHrs, plannedTss, actualHrs, actualTss, doneSessions, totalSessions, completionPct, weekActivities }
        })

        const maxHrs = Math.max(...weeksData.map(w => Math.max(w.plannedHrs, w.actualHrs)), 1)

        // Monthly aggregation — basé sur toutes les activités, pas seulement les semaines du plan
        const months = new Map<string, { plannedHrs: number, actualHrs: number, plannedTss: number, actualTss: number, done: number, total: number }>()

        // Planned: depuis les semaines du plan
        weeksData.forEach(w => {
          const monthKey = format(new Date(w.week.weekStart), 'yyyy-MM')
          if (!months.has(monthKey)) months.set(monthKey, { plannedHrs: 0, actualHrs: 0, plannedTss: 0, actualTss: 0, done: 0, total: 0 })
          const m = months.get(monthKey)!
          m.plannedHrs += w.plannedHrs
          m.plannedTss += w.plannedTss
          m.done += w.doneSessions
          m.total += w.totalSessions
        })

        // Actual: depuis toutes les activités réelles du mois
        activities.forEach(a => {
          const monthKey = format(new Date(a.date), 'yyyy-MM')
          if (!months.has(monthKey)) months.set(monthKey, { plannedHrs: 0, actualHrs: 0, plannedTss: 0, actualTss: 0, done: 0, total: 0 })
          const m = months.get(monthKey)!
          m.actualHrs += a.duration / 3600
          m.actualTss += a.tss || 0
        })

        // Arrondir les heures réelles
        months.forEach(m => { m.actualHrs = Math.round(m.actualHrs * 10) / 10 })

        return (
          <div className="mt-8 space-y-6">
            {/* Weekly volume chart */}
            <div>
              <h2 className="text-xs uppercase text-stone-600 tracking-widest mb-3">Volume hebdomadaire</h2>
              <div className="flex gap-1 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 items-end" style={{ minHeight: 140 }}>
                {weeksData.map(({ week, i, isPast, isCurrent, plannedHrs, plannedTss, actualHrs, actualTss, completionPct, doneSessions, totalSessions }) => {
                  const isSelected = i === currentWeekIdx
                  const barH = Math.max(8, (plannedHrs / maxHrs) * 100)
                  const actualH = Math.max(0, (actualHrs / maxHrs) * 100)
                  const hasActual = isPast || isCurrent

                  return (
                    <button
                      key={i}
                      onClick={() => setCurrentWeekIdx(i)}
                      className={`flex-shrink-0 w-14 md:flex-1 md:w-auto flex flex-col items-center gap-1 transition-all rounded-lg py-1.5 px-0.5 ${
                        isSelected
                          ? 'bg-ventoux-500/15 ring-1 ring-ventoux-500/30'
                          : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      {/* Bars */}
                      <div className="relative w-full flex justify-center items-end gap-[2px]" style={{ height: 80 }}>
                        {/* Planned bar */}
                        <div
                          className={`w-3 rounded-t transition-all ${isPast ? 'bg-stone-800' : isCurrent ? 'bg-ventoux-500/30' : 'bg-stone-800/60'}`}
                          style={{ height: `${barH}%` }}
                          title={`Prévu: ${plannedHrs}h`}
                        />
                        {/* Actual bar */}
                        {hasActual && (
                          <div
                            className={`w-3 rounded-t transition-all ${
                              actualH >= barH * 0.8 ? 'bg-green-500' : actualH > 0 ? 'bg-amber-500' : 'bg-red-500/40'
                            }`}
                            style={{ height: `${Math.max(actualH > 0 ? 4 : 0, actualH)}%` }}
                            title={`Réalisé: ${actualHrs}h`}
                          />
                        )}
                      </div>

                      {/* Completion badge */}
                      {hasActual && totalSessions > 0 && (
                        <div className={`text-[9px] font-medium px-1 rounded ${
                          completionPct >= 80 ? 'text-green-400' : completionPct > 0 ? 'text-amber-400' : 'text-stone-600'
                        }`}>
                          {doneSessions}/{totalSessions}
                        </div>
                      )}

                      {/* Labels */}
                      <p className={`text-[10px] font-mono font-bold ${isSelected ? 'text-ventoux-400' : isCurrent ? 'text-summit-light' : 'text-stone-600'}`}>
                        S{week.weekNumber}
                      </p>
                      <p className={`text-[9px] ${isSelected ? 'text-stone-400' : 'text-stone-700'}`}>{plannedHrs}h</p>
                      <p className={`text-[8px] font-mono ${hasActual && actualTss > 0 ? (actualTss >= plannedTss * 0.8 ? 'text-green-500/70' : 'text-amber-500/70') : 'text-stone-700'}`}>
                        {hasActual && actualTss > 0 ? `${Math.round(actualTss)}` : plannedTss > 0 ? `${Math.round(plannedTss)}` : ''}{(hasActual && actualTss > 0) || plannedTss > 0 ? ' TSS' : ''}
                      </p>
                      {week.phase && (
                        <div className={`text-[7px] px-1 py-0.5 rounded leading-none ${PHASE_COLORS[week.phase] || ''}`}>
                          {week.phase}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
              {/* Legend */}
              <div className="flex items-center gap-4 mt-2 text-[10px] text-stone-600">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-stone-800 inline-block" /> Prévu</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500 inline-block" /> Réalisé</span>
              </div>
            </div>

            {/* Monthly summary */}
            {months.size > 1 && (
              <div>
                <h2 className="text-xs uppercase text-stone-600 tracking-widest mb-3">Bilan mensuel</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {Array.from(months.entries()).map(([key, m]) => {
                    const label = format(new Date(key + '-01'), 'MMM yyyy', { locale: fr })
                    const pct = m.total > 0 ? Math.round(m.done / m.total * 100) : 0
                    return (
                      <div key={key} className="bg-white/[0.02] rounded-xl p-3 space-y-2">
                        <p className="text-xs font-medium text-stone-400 capitalize">{label}</p>
                        <div className="flex items-baseline gap-2">
                          <span className="font-display text-lg font-bold text-summit-light">{Math.round(m.actualHrs * 10) / 10}h</span>
                          <span className="text-[10px] text-stone-600">/ {Math.round(m.plannedHrs * 10) / 10}h</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs text-summit-light font-medium">{Math.round(m.actualTss)} <span className="text-stone-600">TSS</span></span>
                          <span className="text-[10px] text-stone-600">/ {Math.round(m.plannedTss)}</span>
                        </div>
                        {m.total > 0 && (
                          <div>
                            <div className="flex justify-between text-[10px] mb-1">
                              <span className="text-stone-600">Complétion</span>
                              <span className={pct >= 80 ? 'text-green-400' : pct > 0 ? 'text-amber-400' : 'text-stone-600'}>{pct}%</span>
                            </div>
                            <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-green-500' : pct > 0 ? 'bg-amber-500' : 'bg-stone-700'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ─── Session detail slide-over ─────────────────────────────────────────── */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedSession(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-[calc(100%-2rem)] sm:max-w-md bg-stone-950 border-l border-white/[0.06] h-full overflow-y-auto shadow-2xl animate-in"
            style={{ animation: 'slideInRight 0.3s ease-out' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Session header */}
            <div className="sticky top-0 z-10 bg-stone-950/90 backdrop-blur-md border-b border-white/[0.06] px-5 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium mb-1.5 ${TYPE_BG[selectedSession.type] || ''}`}>
                    {TYPE_ICONS[selectedSession.type] || ''} {TYPE_LABELS[selectedSession.type] || selectedSession.type}
                  </div>
                  <h3 className="font-display text-xl font-bold text-summit-light">{selectedSession.name}</h3>
                  <p className="text-stone-500 text-xs mt-0.5">
                    {DAYS_FR_LONG[DAY_KEYS.indexOf(selectedSession.day)]} · {selectedSession.duration}min
                  </p>
                </div>
                <button onClick={() => setSelectedSession(null)} className="p-2 rounded-lg text-stone-500 hover:text-summit-light hover:bg-white/[0.05]">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="px-5 py-5 space-y-5">
              {/* Metrics row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                  <p className="text-xl font-display font-bold text-summit-light">{selectedSession.duration}<span className="text-xs text-stone-500">min</span></p>
                  <p className="text-[10px] text-stone-600 uppercase">Durée</p>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                  <p className="text-xl font-display font-bold text-summit-light">{selectedSession.tssTarget || '—'}</p>
                  <p className="text-[10px] text-stone-600 uppercase"><Term term="TSS">TSS</Term></p>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                  <p className="text-xl font-display font-bold" style={{ color: ZONE_COLORS[selectedSession.intensityZone] || '#888' }}>
                    Z{selectedSession.intensityZone}
                  </p>
                  <p className="text-[10px] text-stone-600 uppercase">Zone</p>
                </div>
              </div>

              {/* Mark as done / undo */}
              {selectedSession.completed ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10 ring-1 ring-green-500/20">
                  <Check size={18} className="text-green-400 flex-shrink-0" />
                  <span className="text-green-300 text-sm font-medium flex-1">Séance validée</span>
                  <button
                    onClick={() => undoSessionDone(selectedSession)}
                    className="text-xs text-stone-500 hover:text-stone-300 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => markSessionDone(selectedSession)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-green-500/15 text-green-400 font-medium text-sm ring-1 ring-green-500/20 hover:bg-green-500/25 transition-all active:scale-[0.98]"
                >
                  <Check size={16} /> Séance faite
                </button>
              )}

              {/* Description */}
              {selectedSession.description && selectedSession.type !== 'STRENGTH' && (
                <p className="text-stone-400 text-sm leading-relaxed">{selectedSession.description}</p>
              )}

              {/* Indoor / Outdoor toggle */}
              {selectedSession.type !== 'STRENGTH' && selectedSession.type !== 'REST' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleIndoor(selectedSession.id, false)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
                      !selectedSession.indoor
                        ? 'bg-green-500/10 text-green-400 ring-1 ring-green-500/30'
                        : 'bg-white/[0.03] text-stone-500 hover:bg-white/[0.06]'
                    }`}
                  >
                    <Sun size={15} /> Extérieur
                  </button>
                  <button
                    onClick={() => toggleIndoor(selectedSession.id, true)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
                      selectedSession.indoor
                        ? 'bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/30'
                        : 'bg-white/[0.03] text-stone-500 hover:bg-white/[0.06]'
                    }`}
                  >
                    <Bike size={15} /> MyWhoosh
                  </button>
                </div>
              )}

              {/* MyWhoosh workout */}
              {selectedSession.mywhooshWorkoutName && selectedSession.indoor && (
                <div className="rounded-xl bg-cyan-500/5 border border-cyan-500/15 overflow-hidden">
                  <div className="px-4 py-3 flex items-center gap-2 border-b border-cyan-500/10">
                    <Bike size={14} className="text-cyan-400" />
                    <h4 className="text-sm font-semibold text-cyan-300 flex-1">Workout MyWhoosh</h4>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-summit-light font-medium">{selectedSession.mywhooshWorkoutName}</p>

                    {loadingWorkout && (
                      <div className="flex items-center gap-2 mt-3 text-stone-500 text-xs">
                        <Loader2 size={12} className="animate-spin" /> Chargement...
                      </div>
                    )}

                    {mywhooshWorkout && (
                      <div className="mt-3 space-y-3">
                        {mywhooshWorkout.description && (
                          <p className="text-stone-400 text-xs leading-relaxed">{mywhooshWorkout.description}</p>
                        )}
                        <div className="flex gap-3 text-xs text-stone-500">
                          {mywhooshWorkout.tss && <span>TSS {mywhooshWorkout.tss}</span>}
                          {mywhooshWorkout.intensityFactor && <span>IF {mywhooshWorkout.intensityFactor.toFixed(2)}</span>}
                          <span>{Math.round(mywhooshWorkout.duration / 60)}min</span>
                          <span>{mywhooshWorkout.stepCount} blocs</span>
                        </div>

                        {mywhooshWorkout.steps?.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase text-stone-600 mb-1.5">Structure</p>
                            <div className="flex gap-[1px] h-8 rounded-lg overflow-hidden">
                              {mywhooshWorkout.steps.slice(0, 30).map((step: any, i: number) => {
                                const power = step.Power || 0
                                const hue = power <= 0.6 ? 200 : power <= 0.75 ? 160 : power <= 0.9 ? 50 : power <= 1.0 ? 30 : power <= 1.2 ? 0 : 280
                                const width = Math.max(3, (step.Time / mywhooshWorkout.duration) * 100)
                                return (
                                  <div
                                    key={i}
                                    style={{
                                      width: `${width}%`,
                                      backgroundColor: `hsl(${hue}, 70%, ${40 + power * 15}%)`,
                                      height: `${Math.min(100, power * 60 + 20)}%`,
                                      alignSelf: 'flex-end',
                                    }}
                                    title={`${Math.round(power * 100)}% FTP · ${Math.round(step.Time / 60)}min`}
                                  />
                                )
                              })}
                            </div>
                          </div>
                        )}

                        <p className="text-[10px] text-cyan-500/40">
                          Cherchez "{selectedSession.mywhooshWorkoutName}" dans MyWhoosh
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Ride suggestions for outdoor sessions */}
              {!selectedSession.indoor && selectedSession.type !== 'STRENGTH' && selectedSession.type !== 'REST' && (
                <div className="rounded-xl bg-green-500/5 border border-green-500/15 overflow-hidden">
                  <div className="px-4 py-3 flex items-center gap-2 border-b border-green-500/10">
                    <MapPin size={14} className="text-green-400" />
                    <h4 className="text-sm font-semibold text-green-300 flex-1">Où rouler ?</h4>
                    {loadingRide && <Loader2 size={12} className="text-green-400 animate-spin" />}
                    {!loadingRide && (
                      <button
                        onClick={() => loadRideSuggestions(selectedSession)}
                        className="text-stone-600 hover:text-stone-400 transition-colors"
                      >
                        <RefreshCw size={12} />
                      </button>
                    )}
                  </div>

                  <div className="p-3 space-y-2">
                    {loadingRide && (
                      <p className="text-stone-500 text-xs text-center py-3">Analyse météo des secteurs...</p>
                    )}

                    {rideSuggestions && rideSuggestions.length === 0 && (
                      <p className="text-stone-500 text-xs text-center py-3">Aucun secteur adapté trouvé</p>
                    )}

                    {rideSuggestions?.map((suggestion: any, idx: number) => {
                      const isBest = idx === 0
                      const scoreColor = suggestion.weather.score >= 80 ? 'text-green-400' :
                        suggestion.weather.score >= 60 ? 'text-yellow-400' :
                        suggestion.weather.score >= 40 ? 'text-orange-400' : 'text-red-400'
                      const scoreBg = suggestion.weather.score >= 80 ? 'bg-green-500/10' :
                        suggestion.weather.score >= 60 ? 'bg-yellow-500/10' :
                        suggestion.weather.score >= 40 ? 'bg-orange-500/10' : 'bg-red-500/10'

                      return (
                        <div
                          key={suggestion.sector.id}
                          className={`rounded-lg p-3 transition-all ${
                            isBest ? 'bg-green-500/8 ring-1 ring-green-500/20' : 'bg-white/[0.02]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                {isBest && <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-medium">Recommandé</span>}
                                <h5 className="text-sm font-medium text-summit-light truncate">{suggestion.sector.name}</h5>
                              </div>
                              <p className="text-[11px] text-stone-500 mt-0.5">{suggestion.route.name}</p>
                            </div>
                            <div className={`text-center px-2 py-1 rounded-lg ${scoreBg} flex-shrink-0`}>
                              <p className={`text-sm font-bold ${scoreColor}`}>{suggestion.weather.score}</p>
                              <p className="text-[8px] text-stone-500">/100</p>
                            </div>
                          </div>

                          {/* Route info */}
                          <div className="flex items-center gap-3 text-[11px] text-stone-500 mb-2">
                            <span>{suggestion.route.distance}km</span>
                            <span>{suggestion.route.elevation}m D+</span>
                            <span>~{Math.round(suggestion.route.duration / 60)}h{suggestion.route.duration % 60 > 0 ? `${String(suggestion.route.duration % 60).padStart(2, '0')}` : ''}</span>
                          </div>

                          {/* Weather */}
                          <div className="flex items-center gap-2 text-[11px] mb-2">
                            <Thermometer size={10} className="text-stone-500" />
                            <span className="text-stone-400">{suggestion.weather.temp}°C</span>
                            <Wind size={10} className="text-stone-500" />
                            <span className="text-stone-400">{suggestion.weather.windSpeed}km/h</span>
                            <span className="text-stone-500">{suggestion.weather.description}</span>
                          </div>

                          {/* Weather reasons */}
                          {suggestion.weather.reasons.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {suggestion.weather.reasons.map((r: string, ri: number) => (
                                <span key={ri} className="text-[9px] bg-white/[0.04] text-stone-500 px-1.5 py-0.5 rounded">{r}</span>
                              ))}
                            </div>
                          )}

                          {/* Train info */}
                          <div className="flex items-center gap-1.5 text-[10px] text-stone-600 mb-2.5">
                            <Train size={10} />
                            <span>{suggestion.sector.nearestStation}</span>
                            {suggestion.sector.trainFromParis && <span className="text-stone-700">· {suggestion.sector.trainFromParis}</span>}
                          </div>

                          {/* Download GPX */}
                          <button
                            onClick={() => downloadGpx(suggestion.sector.id, suggestion.sector.routes.indexOf(suggestion.route), suggestion.route.name)}
                            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium hover:bg-green-500/20 transition-all"
                          >
                            <Download size={12} /> Télécharger GPX pour Garmin
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Strength detail with timer */}
              {selectedSession.type === 'STRENGTH' && (
                <StrengthPanel description={selectedSession.description} />
              )}

              {/* Move to another day */}
              <div>
                <p className="text-[10px] uppercase text-stone-600 mb-2 tracking-wider">Déplacer</p>
                <div className="grid grid-cols-7 gap-1">
                  {DAY_KEYS.map((dayKey, i) => {
                    const isCurrent = selectedSession.day === dayKey
                    const isCycling = (t: string) => t !== 'STRENGTH' && t !== 'REST'
                    const hasConflict = !isCurrent && isCycling(selectedSession.type) &&
                      currentWeek?.sessions?.some(s => s.id !== selectedSession.id && s.day === dayKey && isCycling(s.type))

                    return (
                      <button
                        key={dayKey}
                        onClick={() => !hasConflict && moveSession(selectedSession.id, dayKey)}
                        disabled={!!hasConflict}
                        className={`py-2.5 rounded-lg text-xs font-medium transition-all ${
                          isCurrent
                            ? 'bg-ventoux-500/20 text-ventoux-400 ring-1 ring-ventoux-500/30'
                            : hasConflict
                              ? 'bg-white/[0.02] text-stone-800 cursor-not-allowed'
                              : 'bg-white/[0.03] text-stone-600 hover:bg-white/[0.06] hover:text-stone-300'
                        }`}
                        title={hasConflict ? 'Séance vélo déjà présente' : ''}
                      >
                        {DAYS_FR[i]}
                        {hasConflict && <span className="block text-[8px] text-stone-700">occupé</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Coach chat ──────────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        {chatOpen && (
          <div className="w-[340px] max-w-[calc(100vw-2rem)] bg-stone-950 border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden animate-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-ventoux-gradient flex items-center justify-center">
                  <Mountain className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-summit-light">Coach Ventoux</span>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-stone-500 hover:text-stone-300 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="h-[280px] overflow-y-auto p-4 space-y-3">
              {chatHistory.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-stone-500 text-sm mb-4">Comment tu te sens aujourd'hui ?</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {['Je suis malade', 'Pas le temps', 'En pleine forme', "J'ai des courbatures"].map(q => (
                      <button
                        key={q}
                        onClick={() => setChatMsg(q)}
                        className="text-xs px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-stone-400 hover:text-ventoux-400 hover:border-ventoux-500/30 transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chatHistory.map((m: { role: string; text: string }, i: number) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                    m.role === 'user'
                      ? 'bg-ventoux-500/20 text-ventoux-200 rounded-br-sm'
                      : 'bg-white/[0.05] text-stone-300 rounded-bl-sm'
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="px-3 py-2 rounded-xl bg-white/[0.05] text-stone-500 text-sm">
                    <Loader2 size={14} className="animate-spin inline mr-1.5" />
                    Le coach réfléchit…
                  </div>
                </div>
              )}
            </div>

            <form
              onSubmit={e => { e.preventDefault(); sendCoachMessage(); }}
              className="flex items-center gap-2 px-3 py-3 border-t border-white/[0.06]"
            >
              <input
                type="text"
                value={chatMsg}
                onChange={e => setChatMsg(e.target.value)}
                placeholder="Dis quelque chose au coach…"
                className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-summit-light placeholder:text-stone-600 focus:outline-none focus:border-ventoux-500/40"
                disabled={chatLoading}
              />
              <button
                type="submit"
                disabled={chatLoading || !chatMsg.trim()}
                className="p-2 rounded-xl bg-ventoux-gradient text-white disabled:opacity-30 transition-opacity"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        )}

        <button
          onClick={() => setChatOpen((o: boolean) => !o)}
          className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all ${
            chatOpen
              ? 'bg-stone-800 text-stone-400'
              : 'bg-ventoux-gradient text-white shadow-ventoux hover:scale-105'
          }`}
        >
          {chatOpen ? <X size={20} /> : <MessageCircle size={20} />}
        </button>
      </div>

      {/* Slide-in animation */}
      <style jsx>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({ session, onClick, done, compact }: {
  session: TrainingSession
  onClick: () => void
  done: boolean
  compact: boolean
}) {
  const styles = TYPE_BG[session.type] || 'bg-stone-800/50 border-stone-700/30 text-stone-400'

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`w-full text-left px-2 py-2 rounded-lg border text-[11px] leading-snug transition-all hover:brightness-125 cursor-pointer ${styles} ${done ? 'opacity-40' : ''}`}
      >
        <div className="flex items-center gap-1">
          {done && <Check size={9} className="text-green-400" />}
          <span className="font-semibold truncate">{TYPE_LABELS[session.type] || session.type}</span>
        </div>
        <div className="opacity-60 mt-0.5">{session.duration}min</div>
        {session.indoor && session.mywhooshWorkoutName && (
          <div className="mt-1 text-cyan-400/60 truncate flex items-center gap-0.5 text-[9px]">
            <Bike size={7} />
            <span className="truncate">{session.mywhooshWorkoutName}</span>
          </div>
        )}
      </button>
    )
  }

  // Full mobile card
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl border transition-all hover:brightness-110 cursor-pointer ${styles} ${done ? 'opacity-40' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-base">{TYPE_ICONS[session.type] || '🚴'}</span>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{session.name || TYPE_LABELS[session.type]}</p>
            <div className="flex items-center gap-2 text-xs opacity-60 mt-0.5">
              <span>{session.duration}min</span>
              {session.tssTarget ? <span>TSS {session.tssTarget}</span> : null}
              <span className="font-mono" style={{ color: ZONE_COLORS[session.intensityZone] || '#666' }}>Z{session.intensityZone}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {session.indoor && <Bike size={12} className="text-cyan-400/50" />}
          {done && <Check size={14} className="text-green-400" />}
          <ChevronRight size={14} className="text-stone-600" />
        </div>
      </div>
      {session.indoor && session.mywhooshWorkoutName && (
        <p className="text-cyan-400/50 text-xs mt-1.5 truncate pl-7">{session.mywhooshWorkoutName}</p>
      )}
    </button>
  )
}

// ─── Strength Panel with integrated timer ────────────────────────────────────

interface ParsedExercise {
  name: string
  sets: number
  reps: string
  rest: number
  isTime: boolean
}

function parseExercises(description: string): ParsedExercise[] {
  if (!description) return []
  const parts = description.split(/[,;]\s*/).map(s => s.trim()).filter(Boolean)
  const exercises: ParsedExercise[] = []
  let globalRest = 60

  const restMatch = description.match(/\((\d+)s?\s*repos\)/i)
  if (restMatch) globalRest = parseInt(restMatch[1])

  for (const part of parts) {
    if (/^\(\d+s?\s*repos\)$/i.test(part)) continue

    const match = part.match(/^(.+?)\s+(\d+)\s*[xX×]\s*(\d+\s*[sS]?(?:\/[jJ])?)\s*(?:\(.*\))?$/)
    if (match) {
      const reps = match[3].trim()
      const isTime = /s$/i.test(reps)
      exercises.push({
        name: match[1].trim(),
        sets: parseInt(match[2]),
        reps,
        rest: globalRest,
        isTime,
      })
    } else {
      const cleaned = part.replace(/\(.*?\)/g, '').trim()
      if (cleaned.length > 2) {
        exercises.push({ name: cleaned, sets: 3, reps: '10', rest: globalRest, isTime: false })
      }
    }
  }
  return exercises
}

function StrengthPanel({ description }: { description: string }) {
  const exercises = parseExercises(description)
  const [currentExIdx, setCurrentExIdx] = useState(0)
  const [currentSet, setCurrentSet] = useState(1)
  const [phase, setPhase] = useState<'idle' | 'work' | 'rest'>('idle')
  const [timeLeft, setTimeLeft] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const currentEx = exercises[currentExIdx]
  const totalExercises = exercises.length

  const playBeep = useCallback(() => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGBAIjFYp+Pqt2BEMS91')
      }
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {})
    } catch {}
  }, [])

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) { playBeep(); return 0 }
          if (t === 4) playBeep()
          return t - 1
        })
      }, 1000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isRunning, timeLeft, playBeep])

  useEffect(() => {
    if (timeLeft === 0 && isRunning) {
      setIsRunning(false)
      if (phase === 'work') {
        if (currentEx) {
          setPhase('rest')
          setTimeLeft(currentEx.rest)
          setIsRunning(true)
        }
      } else if (phase === 'rest') {
        if (currentEx && currentSet < currentEx.sets) {
          setCurrentSet(s => s + 1)
          setPhase('work')
          if (currentEx.isTime) {
            setTimeLeft(parseInt(currentEx.reps))
            setIsRunning(true)
          }
        } else if (currentExIdx < totalExercises - 1) {
          setCurrentExIdx(i => i + 1)
          setCurrentSet(1)
          setPhase('work')
          const nextEx = exercises[currentExIdx + 1]
          if (nextEx?.isTime) {
            setTimeLeft(parseInt(nextEx.reps))
            setIsRunning(true)
          }
        } else {
          setPhase('idle')
        }
      }
    }
  }, [timeLeft, isRunning, phase, currentEx, currentSet, currentExIdx, totalExercises, exercises])

  const startWork = () => {
    if (!currentEx) return
    setPhase('work')
    if (currentEx.isTime) {
      setTimeLeft(parseInt(currentEx.reps))
      setIsRunning(true)
    }
  }

  const skipToNext = () => {
    setIsRunning(false)
    if (currentEx && currentSet < currentEx.sets) {
      setCurrentSet(s => s + 1)
      setPhase('idle')
    } else if (currentExIdx < totalExercises - 1) {
      setCurrentExIdx(i => i + 1)
      setCurrentSet(1)
      setPhase('idle')
    }
  }

  const resetTimer = () => {
    setIsRunning(false)
    setCurrentExIdx(0)
    setCurrentSet(1)
    setPhase('idle')
    setTimeLeft(0)
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  if (exercises.length === 0) {
    return (
      <div className="rounded-xl bg-purple-500/5 border border-purple-500/15 p-4">
        <p className="text-sm text-purple-300/70">{description}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-purple-500/5 border border-purple-500/15 overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-purple-500/10">
        <div className="flex items-center gap-2">
          <Dumbbell size={14} className="text-purple-400" />
          <span className="text-sm font-semibold text-purple-300">Renforcement</span>
        </div>
        <button onClick={resetTimer} className="text-stone-600 hover:text-stone-400 transition-colors p-1">
          <RotateCcw size={12} />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Exercise list */}
        <div className="space-y-1">
          {exercises.map((ex, i) => {
            const isActive = i === currentExIdx
            const isDone = i < currentExIdx
            return (
              <div
                key={i}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                  isActive ? 'bg-purple-500/10 ring-1 ring-purple-500/20 text-purple-200' :
                  isDone ? 'text-stone-600 line-through' : 'text-stone-500'
                }`}
              >
                <span className="w-5 text-center text-xs">
                  {isDone ? <Check size={12} className="text-green-500" /> : `${i + 1}`}
                </span>
                <span className="flex-1 font-medium">{ex.name}</span>
                <span className="text-xs opacity-60">{ex.sets}×{ex.reps}</span>
                {isActive && phase !== 'idle' && (
                  <span className="text-xs text-purple-400">
                    {currentSet}/{ex.sets}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Timer */}
        {currentEx && (
          <div className="border-t border-purple-500/10 pt-4">
            <div className="text-center mb-3">
              <p className="font-semibold text-purple-200">{currentEx.name}</p>
              <p className="text-xs text-stone-500 mt-0.5">
                Set {currentSet}/{currentEx.sets} · {currentEx.reps} {currentEx.isTime ? '' : 'reps'}
              </p>
            </div>

            {((phase === 'work' && currentEx.isTime) || phase === 'rest') && (
              <div className="text-center mb-4">
                <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full border-2 ${
                  phase === 'rest' ? 'border-green-500/30 text-green-300' : 'border-purple-500/30 text-purple-200'
                }`}>
                  <div>
                    <div className="text-3xl font-mono font-bold">{formatTime(timeLeft)}</div>
                    <div className="text-[10px] uppercase opacity-50">{phase === 'rest' ? 'Repos' : 'Go'}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 flex-wrap">
              {phase === 'idle' && (
                <button onClick={startWork} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-purple-500/20 text-purple-300 text-sm font-medium hover:bg-purple-500/30 transition-colors">
                  <Play size={14} /> Go
                </button>
              )}
              {phase !== 'idle' && currentEx.isTime && (
                <button onClick={() => setIsRunning(!isRunning)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/[0.05] text-stone-300 text-sm hover:bg-white/[0.08] transition-colors">
                  {isRunning ? <Pause size={14} /> : <Play size={14} />}
                  {isRunning ? 'Pause' : 'Reprendre'}
                </button>
              )}
              {phase === 'work' && !currentEx.isTime && (
                <button
                  onClick={() => { setPhase('rest'); setTimeLeft(currentEx.rest); setIsRunning(true) }}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-green-500/15 text-green-300 text-sm font-medium hover:bg-green-500/25 transition-colors"
                >
                  <Check size={14} /> Fait — Repos {currentEx.rest}s
                </button>
              )}
              {phase === 'rest' && (
                <button onClick={() => { setIsRunning(false); setTimeLeft(0) }} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/[0.05] text-stone-300 text-sm hover:bg-white/[0.08] transition-colors">
                  <SkipForward size={14} /> Skip
                </button>
              )}
              {(currentExIdx < totalExercises - 1 || currentSet < (currentEx?.sets || 0)) && (
                <button onClick={skipToNext} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/[0.03] text-stone-500 text-sm hover:bg-white/[0.06] hover:text-stone-300 transition-colors">
                  <SkipForward size={14} /> Suivant
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
