'use client'
import { useState, useEffect, useRef } from 'react'
import { format, addDays, startOfWeek } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Sparkles, ChevronLeft, ChevronRight, Loader2, RefreshCw, Info, Mountain, X, Dumbbell, Bike, Check, Calendar, Trash2, Sun, MapPin, Download, Train, Wind, Thermometer, CheckCircle2, AlertCircle, MoreHorizontal } from 'lucide-react'
import dynamic from 'next/dynamic'
import type { TrainingPlan, TrainingWeek, TrainingSession, Race, Activity, UserProfile } from '@/types'
import { calculatePMC } from '@/lib/training'
import { GlossaryButton, Term } from '@/components/ui/Tooltip'
import { cachedFetch, invalidateCache } from '@/lib/fetch-cache'
import SessionCard from './components/SessionCard'
import { Confetti } from '@/components/ui/Confetti'
import { useToast } from '@/components/ui/ToastProvider'
import { hapticLight, hapticMedium, hapticSuccess } from '@/lib/haptics'

const CoachChat = dynamic(() => import('./components/CoachChat'), { ssr: false })
const StrengthPanelDynamic = dynamic(() => import('./components/StrengthPanel'), { ssr: false })
const VolumeChart = dynamic(() => import('./components/VolumeChart'), { ssr: false })

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

// Phase color matching — handles exact keys and fuzzy names like "Base Aerobic", "Build Intensity", "Peak Ventoux"
function getPhaseKey(type: string): string {
  const upper = type.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
  if (upper.includes('TAPER') || upper.includes('AFFUT')) return 'TAPER'
  if (upper.includes('RECOVERY') || upper.includes('RECUP')) return 'RECOVERY'
  if (upper.includes('PEAK') || upper.includes('VENTOUX') || upper.includes('SPECIFIQUE')) return 'PEAK'
  if (upper.includes('INTENSIT') || upper.includes('SPECIALTY')) return 'BUILD_INTENSITY'
  if (upper.includes('BUILD') || upper.includes('AEROBI')) return 'BUILD'
  if (upper.includes('BASE')) return 'BASE'
  return type.toUpperCase()
}

const PHASE_COLORS: Record<string, string> = {
  BASE: 'text-blue-400 bg-blue-500/10',
  BUILD: 'text-amber-400 bg-amber-500/10',
  BUILD_INTENSITY: 'text-orange-400 bg-orange-500/10',
  PEAK: 'text-red-400 bg-red-500/10',
  SPECIALTY: 'text-red-400 bg-red-500/10',
  TAPER: 'text-green-400 bg-green-500/10',
  RECOVERY: 'text-stone-400 bg-stone-700/30',
}

const PHASE_BAR_COLORS: Record<string, string> = {
  BASE: 'bg-blue-500', BUILD: 'bg-amber-500', BUILD_INTENSITY: 'bg-orange-500',
  PEAK: 'bg-red-500', SPECIALTY: 'bg-red-500', TAPER: 'bg-green-500', RECOVERY: 'bg-stone-600',
}

const PHASE_DOT_COLORS: Record<string, string> = {
  BASE: 'bg-blue-400', BUILD: 'bg-amber-400', BUILD_INTENSITY: 'bg-orange-400',
  PEAK: 'bg-red-400', SPECIALTY: 'bg-red-400', TAPER: 'bg-green-400', RECOVERY: 'bg-stone-400',
}

const DAY_KEYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const DAYS_FR_LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export default function PlanPage() {
  const [plan, setPlan] = useState<TrainingPlan | null>(null)
  const [races, setRaces] = useState<Race[]>([])
  const [user, setUser] = useState<UserProfile | null>(null)
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
  const [activeTab, setActiveTab] = useState<'week' | 'overview' | 'coach'>('week')
  const [rideSuggestions, setRideSuggestions] = useState<any[] | null>(null)
  const [loadingRide, setLoadingRide] = useState(false)
  const [planStartDate, setPlanStartDate] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'))
  const [strengthPerWeek, setStrengthPerWeek] = useState(1)
  const [showActionsMenu, setShowActionsMenu] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const slideOverRef = useRef<HTMLDivElement>(null)
  const actionsMenuRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const { toast } = useToast()

  // Focus trap for session detail slide-over
  useEffect(() => {
    if (!selectedSession || !slideOverRef.current) return

    const panel = slideOverRef.current
    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    const focusables = panel.querySelectorAll<HTMLElement>(focusableSelector)
    if (focusables.length > 0) focusables[0].focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedSession(null)
        return
      }
      if (e.key !== 'Tab') return

      const currentFocusables = panel.querySelectorAll<HTMLElement>(focusableSelector)
      if (currentFocusables.length === 0) return

      const first = currentFocusables[0]
      const last = currentFocusables[currentFocusables.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedSession])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setShowActionsMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadData() {
    setLoading(true)
    const data = await cachedFetch('/api/init?include=profile,plans,races,activities&activityLimit=60')
    const plans = Array.isArray(data.plans) ? data.plans : []
    const racesData = Array.isArray(data.races) ? data.races : []
    const activitiesData = Array.isArray(data.activities) ? data.activities : []

    setRaces(racesData)
    setActivities(activitiesData)
    if (data.profile) setUser(data.profile)

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
    hapticMedium()

    try {
      const res = await fetch('/api/plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raceId: selectedRaceId, startDate: planStartDate, strengthPerWeek }),
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
    hapticLight()
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

    // Update selectedSession immediately so the UI toggles
    if (selectedSession?.id === sessionId) {
      setSelectedSession({ ...selectedSession, indoor })
    }

    if (indoor) {
      const session = plan.weeks[currentWeekIdx]?.sessions.find(s => s.id === sessionId)
      if (session) {
        // If already has a linked workout, just load its detail
        if (session.mywhooshWorkoutId && session.mywhooshWorkoutName) {
          if (selectedSession?.id === sessionId) {
            setSelectedSession({ ...selectedSession, indoor: true, mywhooshWorkoutId: session.mywhooshWorkoutId, mywhooshWorkoutName: session.mywhooshWorkoutName })
          }
          loadWorkoutDetail(session.mywhooshWorkoutId)
          await fetch('/api/plan/update-session', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId: plan.id, weekIndex: currentWeekIdx, sessionId, updates: { indoor: true } }),
          }).catch(() => {})
          return
        }
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
        body: JSON.stringify({ planId: plan.id, weekIndex: currentWeekIdx, sessionId, updates: { indoor } }),
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

  const [matchedActivity, setMatchedActivity] = useState<Activity | null>(null)

  function openSessionDetail(session: TrainingSession) {
    setSelectedSession(session)
    setMywhooshWorkout(null)
    setRideSuggestions(null)

    // Check if a Strava/existing activity matches this session
    if (currentWeek) {
      const dayIdx = DAY_KEYS.indexOf(session.day)
      const dayActivities = getActivitiesForDay(currentWeek.weekStart, dayIdx)
      const matched = matchSessionToActivity(session, dayActivities)
      setMatchedActivity(matched || null)
    } else {
      setMatchedActivity(null)
    }

    if (session.mywhooshWorkoutId) {
      loadWorkoutDetail(session.mywhooshWorkoutId)
    }
    if (!session.indoor && session.type !== 'STRENGTH' && session.type !== 'REST') {
      loadRideSuggestions(session)
    }
  }

  function getActivitiesForDay(weekStart: string, dayIdx: number): Activity[] {
    const dayDate = format(addDays(new Date(weekStart), dayIdx), 'yyyy-MM-dd')
    return activities.filter(a => format(new Date(a.date), 'yyyy-MM-dd') === dayDate)
  }

  // Match activity types to session types
  const SESSION_TO_ACTIVITY_TYPE: Record<string, string[]> = {
    ENDURANCE: ['RIDE', 'VIRTUAL_RIDE'],
    TEMPO: ['RIDE', 'VIRTUAL_RIDE'],
    THRESHOLD: ['RIDE', 'VIRTUAL_RIDE'],
    VO2MAX: ['RIDE', 'VIRTUAL_RIDE'],
    SWEET_SPOT: ['RIDE', 'VIRTUAL_RIDE'],
    RECOVERY: ['RIDE', 'VIRTUAL_RIDE'],
    LONG_RIDE: ['RIDE'],
    RACE_SIM: ['RIDE', 'VIRTUAL_RIDE'],
    VIRTUAL_RIDE: ['VIRTUAL_RIDE', 'RIDE'],
    STRENGTH: ['STRENGTH'],
    REST: [],
  }

  function matchSessionToActivity(session: TrainingSession, dayActivities: Activity[]): Activity | undefined {
    if (dayActivities.length === 0) return undefined
    // Direct match by activityId if already linked
    if (session.activityId) return dayActivities.find(a => a.id === session.activityId)
    // Match by compatible activity type, en excluant les trajets (commute) et les TSS trop faibles
    const compatibleTypes = SESSION_TO_ACTIVITY_TYPE[session.type] || ['RIDE', 'VIRTUAL_RIDE']
    return dayActivities.find(a =>
      compatibleTypes.includes(a.type) &&
      !a.commute &&
      (a.tss === null || a.tss >= 20)
    )
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

      // Celebration
      hapticSuccess()
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 3000)
      toast('Bravo ! Séance complétée 🎉', 'celebration')

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

      <div className="flex items-center gap-4 mb-6 text-sm">
        <div className={`flex items-center gap-2 ${races.length > 0 ? 'text-emerald-400' : 'text-stone-500'}`}>
          {races.length > 0 ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          Course objectif
        </div>
        <div className={`flex items-center gap-2 ${user?.ftp ? 'text-emerald-400' : 'text-stone-500'}`}>
          {user?.ftp ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          FTP renseigné
        </div>
      </div>

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
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] text-sm w-full">
              <Dumbbell size={15} className={strengthPerWeek > 0 ? 'text-purple-400' : 'text-stone-500'} />
              <span className="text-stone-400 flex-1">Renfo/sem</span>
              <div className="flex items-center gap-1">
                {[0, 1, 2, 3].map(n => (
                  <button
                    key={n}
                    onClick={() => setStrengthPerWeek(n)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                      strengthPerWeek === n
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'text-stone-500 hover:text-stone-300 hover:bg-white/[0.05]'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={generatePlan}
              disabled={generating || !selectedRaceId}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Sparkles size={16} /> Générer le plan
            </button>
          </>
        ) : (
          <p className="text-stone-400 text-sm text-center">
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
      <p className="text-stone-500 mt-2 animate-pulse">Génération du plan en cours...</p>
      <div className="mt-4 flex gap-1">
        <div className="w-2 h-2 rounded-full bg-ventoux-500 animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 rounded-full bg-ventoux-500 animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 rounded-full bg-ventoux-500 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const dx = touchStartX.current - e.changedTouches[0].clientX
    const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY)
    if (Math.abs(dx) > 60 && Math.abs(dx) > dy * 1.5) {
      hapticLight()
      if (dx > 0) setCurrentWeekIdx(i => Math.min((plan?.weeks?.length || 1) - 1, i + 1))
      else setCurrentWeekIdx(i => Math.max(0, i - 1))
    }
  }

  // ─── Plan view ──────────────────────────────────────────────────────────────
  return (
    <div className="animate-in pb-8" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <Confetti trigger={showConfetti} />
      {/* Sticky header */}
      <div className="sticky top-0 z-30 -mx-4 px-4 pt-2 pb-3 bg-gradient-to-b from-stone-950 via-stone-950/95 to-transparent">

        {/* Row 1: Course context + actions */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Mountain size={11} className="text-stone-500 flex-shrink-0" />
            {races.length > 1 ? (
              <select value={selectedRaceId} onChange={e => setSelectedRaceId(e.target.value)}
                className="bg-transparent text-xs text-stone-500 truncate max-w-[160px] outline-none cursor-pointer [color-scheme:dark]">
                {races.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            ) : (
              <span className="text-xs text-stone-500 truncate">
                {plan!.race?.name || races.find(r => r.id === selectedRaceId)?.name || ''}
              </span>
            )}
            {(() => {
              const raceDate = plan!.race?.date || races.find(r => r.id === selectedRaceId)?.date
              if (!raceDate) return null
              const days = Math.max(0, Math.ceil((new Date(raceDate).getTime() - new Date().getTime()) / 86400000))
              return days > 0 ? <span className="text-xs text-stone-600 flex-shrink-0">· J-{days}</span> : null
            })()}
          </div>
          <div className="flex items-center gap-0.5">
            <GlossaryButton />
            <div className="relative" ref={actionsMenuRef}>
              <button
                onClick={() => setShowActionsMenu(v => !v)}
                aria-label="Plus d'options"
                className={`p-2.5 rounded-lg transition-all ${showActionsMenu ? 'text-stone-300 bg-white/[0.06]' : 'text-stone-500 hover:text-stone-300 hover:bg-white/[0.05]'}`}
              >
                <MoreHorizontal size={16} />
              </button>
              {showActionsMenu && (
                <div className="absolute right-0 top-full mt-1.5 bg-stone-900 border border-white/[0.08] rounded-xl shadow-2xl z-50 w-56 overflow-hidden">
                  <div className="p-3 border-b border-white/[0.06]">
                    <p className="text-xs text-stone-500 uppercase tracking-wider mb-3">Régénérer le plan</p>
                    <div className="flex items-center gap-2 mb-2.5">
                      <Calendar size={13} className="text-stone-400 flex-shrink-0" />
                      <input type="date" value={planStartDate} onChange={e => setPlanStartDate(e.target.value)}
                        className="input text-xs py-1 px-2 flex-1 [color-scheme:dark]" />
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <Dumbbell size={13} className={strengthPerWeek > 0 ? 'text-purple-400' : 'text-stone-500'} />
                      <div className="flex items-center gap-0.5">
                        {[0, 1, 2, 3].map(n => (
                          <button key={n} onClick={() => setStrengthPerWeek(n)}
                            className={`w-7 h-7 rounded-md text-xs font-medium transition-all ${strengthPerWeek === n ? 'bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30' : 'text-stone-500 hover:text-stone-300'}`}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => { generatePlan(); setShowActionsMenu(false) }} disabled={generating}
                      className="btn-primary w-full flex items-center justify-center gap-2 text-sm py-2">
                      <Sparkles size={14} /> Régénérer
                    </button>
                  </div>
                  <button onClick={() => { deletePlan(); setShowActionsMenu(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 size={14} /> Supprimer le plan
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Week navigation (centered) */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => { hapticLight(); setCurrentWeekIdx(i => Math.max(0, i - 1)) }}
            disabled={currentWeekIdx === 0}
            aria-label="Semaine précédente"
            className="p-2.5 rounded-lg text-stone-500 hover:text-summit-light hover:bg-white/[0.05] disabled:opacity-20 transition-all"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <h1 className="font-display text-lg font-bold text-summit-light uppercase tracking-wide">
                S{currentWeek?.weekNumber || currentWeekIdx + 1}
              </h1>
              {currentWeek?.phase && (
                <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${PHASE_COLORS[getPhaseKey(currentWeek.phase)] || ''}`}>
                  {plan!.phases?.find((p: any) => currentWeek.weekNumber >= p.startWeek && currentWeek.weekNumber <= p.endWeek)?.name || currentWeek.phase}
                </span>
              )}
            </div>
            {currentWeek && (
              <p className="text-stone-400 text-xs mt-0.5">
                {format(new Date(currentWeek.weekStart), 'd MMM', { locale: fr })}
                {' — '}
                {format(addDays(new Date(currentWeek.weekStart), 6), 'd MMM', { locale: fr })}
              </p>
            )}
          </div>
          <button
            onClick={() => { hapticLight(); setCurrentWeekIdx(i => Math.min((plan!.weeks?.length || 1) - 1, i + 1)) }}
            disabled={currentWeekIdx >= (plan!.weeks?.length || 1) - 1}
            aria-label="Semaine suivante"
            className="p-2.5 rounded-lg text-stone-500 hover:text-summit-light hover:bg-white/[0.05] disabled:opacity-20 transition-all"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Row 3: Tabs */}
        <div className="flex bg-stone-900/60 rounded-xl p-1 gap-1 mt-3">
          {[
            { key: 'week', label: 'Semaine' },
            { key: 'overview', label: 'Vue d\'ensemble' },
            { key: 'coach', label: 'Coach' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm transition-all ${
                activeTab === tab.key
                  ? 'bg-ventoux-500/20 text-ventoux-400 font-semibold'
                  : 'text-stone-500 font-medium hover:text-stone-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Tab: Vue d'ensemble ──────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <>
      {/* Phase progress bar */}
      {plan!.phases?.length > 0 && (() => {
        const totalPlanWeeks = Math.max(...plan!.phases.map((p: any) => p.endWeek || 0), 1)
        const currentWeekNum = currentWeek?.weekNumber || 1
        const currentPhase = plan!.phases.find((p: any) => currentWeekNum >= p.startWeek && currentWeekNum <= p.endWeek)
        const progressPct = Math.min(100, Math.max(0, ((currentWeekNum - 0.5) / totalPlanWeeks) * 100))

        return (
          <div className="mb-8">
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
                      className={`transition-all ${PHASE_BAR_COLORS[getPhaseKey(phase.type)] || 'bg-stone-600'} ${
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
                    <span className={`text-[10px] ${isActive ? 'text-stone-300 font-medium' : 'text-stone-400'}`}>
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
      <div className="border-t border-white/[0.04]" />
      {latestPmc && (
        <div className="grid grid-cols-3 gap-3 mb-8 mt-8">
          <div className="bg-white/[0.02] rounded-xl p-3 text-center">
            <p className={`font-display text-2xl font-bold ${latestPmc.ctl > 60 ? 'text-green-400' : latestPmc.ctl > 30 ? 'text-amber-400' : 'text-stone-300'}`}>
              {Math.round(latestPmc.ctl)}
            </p>
            <p className="text-stone-400 text-xs uppercase tracking-widest mt-0.5">
              <Term term="CTL">CTL</Term> · Fitness
            </p>
          </div>
          <div className="bg-white/[0.02] rounded-xl p-3 text-center">
            <p className={`font-display text-2xl font-bold ${latestPmc.atl > latestPmc.ctl * 1.3 ? 'text-red-400' : 'text-stone-300'}`}>
              {Math.round(latestPmc.atl)}
            </p>
            <p className="text-stone-400 text-xs uppercase tracking-widest mt-0.5">
              <Term term="ATL">ATL</Term> · Fatigue
            </p>
          </div>
          <div className="bg-white/[0.02] rounded-xl p-3 text-center">
            <p className={`font-display text-2xl font-bold ${latestPmc.tsb > 5 ? 'text-green-400' : latestPmc.tsb < -20 ? 'text-red-400' : 'text-amber-400'}`}>
              {latestPmc.tsb > 0 ? '+' : ''}{Math.round(latestPmc.tsb)}
            </p>
            <p className="text-stone-400 text-xs uppercase tracking-widest mt-0.5">
              <Term term="TSB">TSB</Term> · {latestPmc.tsb > 5 ? 'Reposé' : latestPmc.tsb < -20 ? 'Fatigué' : 'Forme'}
            </p>
          </div>
        </div>
      )}

      {/* AI Notes — Diagnostic & Stratégie */}
      {plan!.aiNotes && (
        <div className="card p-5 mb-8 border-l-4 border-ventoux-500/60">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-ventoux-gradient flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </div>
            <h3 className="font-display text-sm font-bold text-summit-light uppercase tracking-wider">Diagnostic & Stratégie</h3>
          </div>
          <div className="space-y-2">
            {plan!.aiNotes
              .split(/\n+/)
              .map((l: string) => l.trim())
              .filter(Boolean)
              .flatMap((l: string) => l.includes('• ') ? l.split(/(?=• )/).map((s: string) => s.trim()).filter(Boolean) : [l])
              .map((line: string, i: number) => {
                const clean = line.replace(/^[•\-]\s*/, '').trim()
                const parts = clean.split(/\*\*(.+?)\*\*/g)
                return (
                  <p key={i} className="text-sm text-stone-300 leading-relaxed pl-3 border-l-2 border-ventoux-500/25">
                    {parts.map((part, j) =>
                      j % 2 === 1
                        ? <strong key={j} className="text-stone-100 font-medium">{part}</strong>
                        : part
                    )}
                  </p>
                )
              })
            }
          </div>
        </div>
      )}

      {/* Volume chart in overview */}
      <div className="border-t border-white/[0.04] mt-8 mb-8" />
      <VolumeChart plan={plan!} activities={activities} currentWeekIdx={currentWeekIdx} onWeekSelect={setCurrentWeekIdx} />
        </>
      )}

      {/* ─── Tab: Semaine ──────────────────────────────────────────────────── */}
      {activeTab === 'week' && (
        <>
      {/* Volume & TSS progress */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-xs text-stone-400 uppercase tracking-wider">Volume</span>
            <span className="text-xs text-stone-300 font-medium">
              {actualWeekHours > 0 ? `${actualWeekHours}h` : '0h'}
              <span className="text-stone-500"> / {weekTotalHours}h</span>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
            <div className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${weekTotalHours > 0 ? Math.min(100, (actualWeekHours / weekTotalHours) * 100) : 0}%` }} />
          </div>
        </div>
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-xs text-stone-400 uppercase tracking-wider"><Term term="TSS">TSS</Term></span>
            <span className="text-xs text-stone-300 font-medium">
              {actualWeekTss > 0 ? actualWeekTss : '0'}
              <span className="text-stone-500"> / {weekTotalTss}</span>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
            <div className="h-full rounded-full bg-amber-500 transition-all duration-500"
              style={{ width: `${weekTotalTss > 0 ? Math.min(100, (actualWeekTss / weekTotalTss) * 100) : 0}%` }} />
          </div>
        </div>
      </div>

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
        <div className="card p-4 mb-5 border-l-4 border-blue-500/40">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Info size={12} className="text-blue-400" />
            </div>
            <h3 className="font-display text-xs font-bold text-summit-light uppercase tracking-wider">
              Notes semaine {currentWeek.weekNumber}
            </h3>
          </div>
          <div className="text-sm text-stone-300 leading-relaxed space-y-1">
            {currentWeek.notes.split(/\.\s+/).filter(Boolean).map((sentence: string, i: number) => (
              <p key={i}>• {sentence.trim().replace(/\.$/, '')}</p>
            ))}
          </div>
        </div>
      )}

      {/* ─── Sessions calendar ─────────────────────────────────────────────────── */}
      <div className="border-t border-white/[0.04] mb-8" />
      {currentWeek && (
        <>
          {/* Desktop: 7 columns */}
          <div className="hidden md:grid grid-cols-7 gap-1.5">
            {DAY_KEYS.map((dayKey, i) => {
              const sessions = currentWeek.sessions?.filter((s: TrainingSession) => s.day === dayKey) || []
              const weekDate = addDays(new Date(currentWeek.weekStart), i)
              const isToday = format(weekDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
              const dayActivities = getActivitiesForDay(currentWeek.weekStart, i)

              return (
                <div
                  key={dayKey}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-ventoux-500/30') }}
                  onDragLeave={(e) => { e.currentTarget.classList.remove('ring-2', 'ring-ventoux-500/30') }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.currentTarget.classList.remove('ring-2', 'ring-ventoux-500/30')
                    const sessionId = e.dataTransfer.getData('sessionId')
                    if (sessionId) moveSession(sessionId, dayKey)
                  }}
                  className={`rounded-xl min-h-[160px] flex flex-col transition-all ${
                    isToday ? 'ring-1 ring-ventoux-500/40 bg-ventoux-500/[0.03]' : 'bg-white/[0.015]'
                  }`}
                >
                  {/* Day header */}
                  <div className={`px-2.5 py-2 text-center border-b border-white/[0.04] ${isToday ? 'text-ventoux-400' : 'text-stone-400'}`}>
                    <p className="text-xs font-medium">{DAYS_FR[i]}</p>
                    <p className={`text-lg font-display font-bold ${isToday ? 'text-ventoux-400' : 'text-stone-500'}`}>{format(weekDate, 'd')}</p>
                  </div>

                  {/* Day content */}
                  <div className="flex-1 p-1.5 space-y-1.5">
                    {sessions.map((session: TrainingSession) => {
                      const matched = matchSessionToActivity(session, dayActivities)
                      return (
                        <div key={session.id}>
                          <SessionCard
                            session={session}
                            onClick={() => openSessionDetail(session)}
                            done={!!matched || !!session.completed}
                            compact
                            draggable
                          />
                          {matched && (
                            <div className="px-2 py-1 rounded-lg bg-green-500/10 text-[10px] text-green-400 flex items-center gap-1 mt-0.5">
                              <Check size={8} />
                              <span className="truncate">{matched.name}</span>
                              {matched.tss && <span className="ml-auto opacity-60">TSS {Math.round(matched.tss)}</span>}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {/* Activities without a matching session */}
                    {dayActivities.filter(a => !sessions.some(s => matchSessionToActivity(s, [a]))).map(a => (
                      <div key={a.id} className="px-2 py-1 rounded-lg bg-blue-500/10 text-[10px] text-blue-400 flex items-center gap-1">
                        <Check size={8} />
                        <span className="truncate">{a.name}</span>
                        {a.tss && <span className="ml-auto opacity-60">TSS {Math.round(a.tss)}</span>}
                      </div>
                    ))}
                    {sessions.length === 0 && dayActivities.length === 0 && (
                      <div className="flex items-center justify-center h-full text-stone-800 text-xs">
                        Repos
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Mobile: stacked list (today first) */}
          <div className="md:hidden space-y-2">
            {(() => {
              const todayStr = format(new Date(), 'yyyy-MM-dd')
              const todayIndex = DAY_KEYS.findIndex((_, i) =>
                format(addDays(new Date(currentWeek.weekStart), i), 'yyyy-MM-dd') === todayStr
              )
              const sortedIndices = todayIndex >= 0
                ? [...Array(7).keys()].slice(todayIndex).concat([...Array(7).keys()].slice(0, todayIndex))
                : [...Array(7).keys()]

              return sortedIndices.map(i => {
                const dayKey = DAY_KEYS[i]
                const sessions = currentWeek.sessions?.filter((s: TrainingSession) => s.day === dayKey) || []
                const weekDate = addDays(new Date(currentWeek.weekStart), i)
                const isToday = format(weekDate, 'yyyy-MM-dd') === todayStr
                const dayActivities = getActivitiesForDay(currentWeek.weekStart, i)

                if (sessions.length === 0 && dayActivities.length === 0) return null

                return (
                  <div key={dayKey} className={`rounded-xl overflow-hidden ${
                    isToday ? 'ring-2 ring-ventoux-500/30 bg-ventoux-500/5' : ''
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
                      {isToday && <span className="text-[10px] text-ventoux-500 bg-ventoux-500/10 px-2 py-0.5 rounded-full font-medium">Aujourd&apos;hui</span>}
                    </div>

                    {/* Sessions */}
                    <div className={`px-3 pb-3 pt-1.5 space-y-2 ${isToday ? 'py-2' : ''}`}>
                      {sessions.map((session: TrainingSession) => {
                        const matched = matchSessionToActivity(session, dayActivities)
                        return (
                          <div key={session.id}>
                            <SessionCard
                              session={session}
                              onClick={() => openSessionDetail(session)}
                              done={!!matched || !!session.completed}
                              compact={!isToday}
                            />
                            {matched && (
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-xs mt-1">
                                <Check size={10} />
                                <span className="font-medium truncate">{matched.name}</span>
                                {matched.tss && <span className="ml-auto opacity-60">TSS {Math.round(matched.tss)}</span>}
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {/* Unmatched activities */}
                      {dayActivities.filter(a => !sessions.some(s => matchSessionToActivity(s, [a]))).map(a => (
                        <div key={a.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs">
                          <Check size={10} />
                          <span className="font-medium truncate">{a.name}</span>
                          {a.tss && <span className="ml-auto opacity-60">TSS {Math.round(a.tss)}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            })()}

            {/* Show rest days count on mobile */}
            {(() => {
              const activeDays = DAY_KEYS.filter((dayKey, i) => {
                const sessions = currentWeek.sessions?.filter((s: TrainingSession) => s.day === dayKey) || []
                const dayActs = getActivitiesForDay(currentWeek.weekStart, i)
                return sessions.length > 0 || dayActs.length > 0
              }).length
              const restDays = 7 - activeDays
              return restDays > 0 ? (
                <p className="text-center text-stone-700 text-xs py-2">{restDays} jour{restDays > 1 ? 's' : ''} de repos</p>
              ) : null
            })()}
          </div>
        </>
      )}

        </>
      )}

      {/* ─── Tab: Coach ──────────────────────────────────────────────────── */}
      {activeTab === 'coach' && (
        <CoachChat plan={plan!} onPlanUpdate={(weeks) => setPlan({ ...plan!, weeks })} fullPage />
      )}

      {/* ─── Session detail slide-over ─────────────────────────────────────────── */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedSession(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            ref={slideOverRef}
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
                  <p className="text-[10px] text-stone-400 uppercase">Durée</p>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                  <p className="text-xl font-display font-bold text-summit-light">{selectedSession.tssTarget || '—'}</p>
                  <p className="text-[10px] text-stone-400 uppercase"><Term term="TSS">TSS</Term></p>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                  <p className="text-xl font-display font-bold" style={{ color: ZONE_COLORS[selectedSession.intensityZone] || '#888' }}>
                    Z{selectedSession.intensityZone}
                  </p>
                  <p className="text-[10px] text-stone-400 uppercase">Zone</p>
                </div>
              </div>

              {/* Activity match / Mark as done */}
              {matchedActivity ? (
                <div className="rounded-xl bg-green-500/10 ring-1 ring-green-500/20 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-green-500/10">
                    <Check size={16} className="text-green-400 flex-shrink-0" />
                    <span className="text-green-300 text-sm font-medium flex-1">Réalisée</span>
                    <span className="text-green-400/60 text-[10px] uppercase">{matchedActivity.source === 'STRAVA' ? 'Strava' : matchedActivity.source === 'MYWHOOSH' ? 'MyWhoosh' : 'Manuel'}</span>
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    <p className="text-sm text-summit-light font-medium">{matchedActivity.name}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-400">
                      {matchedActivity.duration > 0 && <span>{Math.round(matchedActivity.duration / 60)}min</span>}
                      {matchedActivity.distance && <span>{matchedActivity.distance.toFixed(1)}km</span>}
                      {matchedActivity.elevation && <span>{Math.round(matchedActivity.elevation)}m D+</span>}
                      {matchedActivity.avgPower && <span>{matchedActivity.avgPower}W moy</span>}
                      {matchedActivity.tss && <span>TSS {Math.round(matchedActivity.tss)}</span>}
                      {matchedActivity.avgHr && <span>{matchedActivity.avgHr}bpm</span>}
                    </div>
                  </div>
                </div>
              ) : selectedSession.completed ? (
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
              {selectedSession.mywhooshWorkoutName && (
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
                        <div className="flex gap-3 text-xs text-stone-400">
                          {mywhooshWorkout.tss && <span>TSS {mywhooshWorkout.tss}</span>}
                          {mywhooshWorkout.intensityFactor && <span>IF {mywhooshWorkout.intensityFactor.toFixed(2)}</span>}
                          <span>{Math.round(mywhooshWorkout.duration / 60)}min</span>
                          <span>{mywhooshWorkout.stepCount} blocs</span>
                        </div>

                        {mywhooshWorkout.steps?.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase text-stone-400 mb-1.5">Structure</p>
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
                          Cherchez &quot;{selectedSession.mywhooshWorkoutName}&quot; dans MyWhoosh
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
                        className="text-stone-400 hover:text-stone-400 transition-colors"
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
                          <div className="flex items-center gap-1.5 text-[10px] text-stone-400 mb-2.5">
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
                <StrengthPanelDynamic description={selectedSession.description} />
              )}

              {/* Move to another day */}
              <div>
                <p className="text-[10px] uppercase text-stone-400 mb-2 tracking-wider">Déplacer</p>
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
                              : 'bg-white/[0.03] text-stone-400 hover:bg-white/[0.06] hover:text-stone-300'
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

      {/* ─── Coach chat (floating widget, hidden when coach tab is active) ─── */}
      {activeTab !== 'coach' && (
        <CoachChat plan={plan!} onPlanUpdate={(weeks) => setPlan({ ...plan!, weeks })} />
      )}

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

