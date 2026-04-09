'use client'
import { format, addDays, startOfWeek, subWeeks } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Clock, Zap, CheckCircle2, TrendingUp, Mountain, Heart, Gauge, Flame, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { TrainingPlan, TrainingWeek, Activity } from '@/types'

function getPhaseKey(type: string): string {
  const upper = type.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
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

interface VolumeChartProps {
  plan: TrainingPlan
  activities: Activity[]
  currentWeekIdx: number
  onWeekSelect: (idx: number) => void
}

function formatDur(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h > 0 ? `${h}h${m > 0 ? m.toString().padStart(2, '0') : ''}` : `${m}min`
}

export default function VolumeChart({ plan, activities, currentWeekIdx, onWeekSelect }: VolumeChartProps) {
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null)

  if (!plan.weeks || plan.weeks.length <= 1) return null

  const today = new Date()
  const weeksData = plan.weeks.map((week: TrainingWeek, i: number) => {
    const weekStart = new Date(week.weekStart)
    const weekEnd = addDays(weekStart, 6)
    const isPast = weekEnd < today
    const isCurrent = today >= weekStart && today <= weekEnd

    const plannedMin = week.sessions?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0
    const plannedHrs = Math.round(plannedMin / 60 * 10) / 10
    const plannedTss = week.sessions?.reduce((sum, s) => sum + (s.tssTarget || 0), 0) || 0

    const weekActivities = activities.filter(a => {
      const d = new Date(a.date)
      return d >= weekStart && d <= weekEnd
    })

    // Aggregated stats from activities
    const totalDuration = weekActivities.reduce((s, a) => s + (a.duration || 0), 0)
    const actualHrs = Math.round(totalDuration / 3600 * 10) / 10
    const actualTss = Math.round(weekActivities.reduce((s, a) => s + (a.tss || 0), 0))
    const totalDistance = Math.round(weekActivities.reduce((s, a) => s + (a.distance || 0), 0) * 10) / 10
    const totalElevation = Math.round(weekActivities.reduce((s, a) => s + (a.elevation || 0), 0))
    const totalCalories = Math.round(weekActivities.reduce((s, a) => s + (a.calories || 0), 0))

    // Averages (only from activities that have the metric)
    const withPower = weekActivities.filter(a => a.avgPower)
    const avgPower = withPower.length > 0 ? Math.round(withPower.reduce((s, a) => s + a.avgPower!, 0) / withPower.length) : null
    const maxPower = weekActivities.reduce((m, a) => Math.max(m, a.maxPower || 0), 0) || null
    const withNP = weekActivities.filter(a => a.normalizedPower)
    const avgNP = withNP.length > 0 ? Math.round(withNP.reduce((s, a) => s + a.normalizedPower!, 0) / withNP.length) : null
    const withHr = weekActivities.filter(a => a.avgHr)
    const avgHr = withHr.length > 0 ? Math.round(withHr.reduce((s, a) => s + a.avgHr!, 0) / withHr.length) : null
    const maxHr = weekActivities.reduce((m, a) => Math.max(m, a.maxHr || 0), 0) || null
    const withIF = weekActivities.filter(a => a.intensityFactor)
    const avgIF = withIF.length > 0 ? Math.round(withIF.reduce((s, a) => s + a.intensityFactor!, 0) / withIF.length * 100) / 100 : null
    const avgSpeed = weekActivities.filter(a => a.avgSpeed).length > 0
      ? Math.round(weekActivities.filter(a => a.avgSpeed).reduce((s, a) => s + a.avgSpeed!, 0) / weekActivities.filter(a => a.avgSpeed).length * 10) / 10
      : null

    const CYCLING_TYPES = ['RIDE', 'VIRTUAL_RIDE']
    const DAY_KEYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
    const totalSessions = week.sessions?.length || 0
    const doneSessions = week.sessions?.filter(s => {
      if (s.completed) return true
      const dayIdx = DAY_KEYS.indexOf(s.day)
      if (dayIdx < 0) return false
      const sessionDate = format(addDays(weekStart, dayIdx), 'yyyy-MM-dd')
      return weekActivities.some(a => {
        const actDate = format(new Date(a.date), 'yyyy-MM-dd')
        if (actDate !== sessionDate) return false
        if (s.type === 'STRENGTH') return a.type === 'STRENGTH'
        return CYCLING_TYPES.includes(a.type)
      })
    }).length || 0
    const completionPct = totalSessions > 0 ? Math.round(doneSessions / totalSessions * 100) : 0

    return {
      week, i, isPast, isCurrent,
      plannedHrs, plannedTss, actualHrs, actualTss,
      totalDistance, totalElevation, totalCalories,
      avgPower, maxPower, avgNP, avgHr, maxHr, avgIF, avgSpeed,
      doneSessions, totalSessions, completionPct,
      weekActivities, totalDuration,
    }
  })

  // Build historical weeks from activities before the plan
  const firstPlanDate = plan.weeks[0] ? new Date(plan.weeks[0].weekStart) : new Date()
  const historicalActivities = activities.filter(a => new Date(a.date) < firstPlanDate)

  type WeekRow = typeof weeksData[0] & { isHistorical?: boolean; weekLabel?: string }

  const historicalWeeks: WeekRow[] = []
  if (historicalActivities.length > 0) {
    // Group by ISO week
    const weekMap = new Map<string, Activity[]>()
    historicalActivities.forEach(a => {
      const ws = startOfWeek(new Date(a.date), { weekStartsOn: 1 })
      const key = format(ws, 'yyyy-MM-dd')
      if (!weekMap.has(key)) weekMap.set(key, [])
      weekMap.get(key)!.push(a)
    })

    // Only keep last 8 historical weeks max
    const sortedKeys = Array.from(weekMap.keys()).sort().slice(-8)
    sortedKeys.forEach((key) => {
      const wa = weekMap.get(key)!
      const weekStart = new Date(key)
      const totalDuration = wa.reduce((s, a) => s + (a.duration || 0), 0)
      const withPower = wa.filter(a => a.avgPower)
      const withNP = wa.filter(a => a.normalizedPower)
      const withHr = wa.filter(a => a.avgHr)
      const withIF = wa.filter(a => a.intensityFactor)
      const withSpeed = wa.filter(a => a.avgSpeed)

      historicalWeeks.push({
        week: { weekStart: key, weekNumber: 0, sessions: [], phase: '', notes: '' } as unknown as TrainingWeek,
        i: -1,
        isPast: true,
        isCurrent: false,
        isHistorical: true,
        weekLabel: format(weekStart, 'd MMM', { locale: fr }) + ' — ' + format(addDays(weekStart, 6), 'd MMM', { locale: fr }),
        plannedHrs: 0,
        plannedTss: 0,
        actualHrs: Math.round(totalDuration / 3600 * 10) / 10,
        actualTss: Math.round(wa.reduce((s, a) => s + (a.tss || 0), 0)),
        totalDistance: Math.round(wa.reduce((s, a) => s + (a.distance || 0), 0) * 10) / 10,
        totalElevation: Math.round(wa.reduce((s, a) => s + (a.elevation || 0), 0)),
        totalCalories: Math.round(wa.reduce((s, a) => s + (a.calories || 0), 0)),
        avgPower: withPower.length > 0 ? Math.round(withPower.reduce((s, a) => s + a.avgPower!, 0) / withPower.length) : null,
        maxPower: wa.reduce((m, a) => Math.max(m, a.maxPower || 0), 0) || null,
        avgNP: withNP.length > 0 ? Math.round(withNP.reduce((s, a) => s + a.normalizedPower!, 0) / withNP.length) : null,
        avgHr: withHr.length > 0 ? Math.round(withHr.reduce((s, a) => s + a.avgHr!, 0) / withHr.length) : null,
        maxHr: wa.reduce((m, a) => Math.max(m, a.maxHr || 0), 0) || null,
        avgIF: withIF.length > 0 ? Math.round(withIF.reduce((s, a) => s + a.intensityFactor!, 0) / withIF.length * 100) / 100 : null,
        avgSpeed: withSpeed.length > 0 ? Math.round(withSpeed.reduce((s, a) => s + a.avgSpeed!, 0) / withSpeed.length * 10) / 10 : null,
        doneSessions: 0,
        totalSessions: 0,
        completionPct: 0,
        weekActivities: wa,
        totalDuration,
      })
    })
  }

  const allWeeks: WeekRow[] = [...historicalWeeks, ...weeksData]

  // Monthly aggregation
  const monthsMap = new Map<string, { plannedHrs: number; actualHrs: number; plannedTss: number; actualTss: number; done: number; total: number; distance: number; elevation: number; calories: number }>()
  weeksData.forEach(w => {
    const monthKey = format(new Date(w.week.weekStart), 'yyyy-MM')
    if (!monthsMap.has(monthKey)) monthsMap.set(monthKey, { plannedHrs: 0, actualHrs: 0, plannedTss: 0, actualTss: 0, done: 0, total: 0, distance: 0, elevation: 0, calories: 0 })
    const m = monthsMap.get(monthKey)!
    m.plannedHrs += w.plannedHrs
    m.plannedTss += w.plannedTss
    m.done += w.doneSessions
    m.total += w.totalSessions
    m.distance += w.totalDistance
    m.elevation += w.totalElevation
    m.calories += w.totalCalories
    w.weekActivities.forEach(a => {
      m.actualHrs += a.duration / 3600
      m.actualTss += a.tss || 0
    })
  })
  monthsMap.forEach(m => {
    m.actualHrs = Math.round(m.actualHrs * 10) / 10
    m.actualTss = Math.round(m.actualTss)
    m.distance = Math.round(m.distance * 10) / 10
    m.elevation = Math.round(m.elevation)
    m.calories = Math.round(m.calories)
  })
  const sortedMonths = Array.from(monthsMap.entries()).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="mt-8 space-y-8">
      {/* Weekly recap */}
      <div>
        <h2 className="text-xs uppercase text-stone-400 tracking-widest mb-3">Récap hebdomadaire</h2>
        <div className="grid gap-2">
          {allWeeks.map((w) => {
            const weekKey = w.week.weekStart
            const isSelected = !w.isHistorical && w.i === currentWeekIdx
            const hasActual = w.isPast || w.isCurrent
            const hasStats = hasActual && w.weekActivities.length > 0
            const isExpanded = expandedWeek === weekKey
            const hrsPct = w.plannedHrs > 0 ? Math.min(Math.round((w.actualHrs / w.plannedHrs) * 100), 100) : 0
            const weekStart = new Date(w.week.weekStart)

            return (
              <div
                key={weekKey}
                className={`rounded-xl transition-all ${
                  isSelected
                    ? 'bg-ventoux-500/10 ring-1 ring-ventoux-500/30'
                    : w.isCurrent
                    ? 'bg-white/[0.04] ring-1 ring-white/[0.08]'
                    : 'bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                {/* Main row — always visible */}
                <button
                  onClick={() => { if (!w.isHistorical) onWeekSelect(w.i) }}
                  className="w-full text-left p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`font-display font-bold text-sm ${w.isHistorical ? 'text-stone-400' : isSelected ? 'text-ventoux-400' : 'text-summit-light'}`}>
                        {w.isHistorical ? 'Avant plan' : `S${w.week.weekNumber}`}
                      </span>
                      <span className="text-stone-400 text-xs">
                        {w.weekLabel || `${format(weekStart, 'd MMM', { locale: fr })} — ${format(addDays(weekStart, 6), 'd MMM', { locale: fr })}`}
                      </span>
                      {w.isCurrent && <span className="text-[10px] px-1.5 py-0.5 rounded bg-ventoux-500/20 text-ventoux-400 font-medium">En cours</span>}
                      {w.isPast && hasStats && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          hrsPct >= 80 ? 'bg-emerald-500/20 text-emerald-400' : hrsPct > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-stone-700/30 text-stone-400'
                        }`}>
                          {hrsPct}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {w.week.phase && (
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${PHASE_COLORS[getPhaseKey(w.week.phase)] || ''}`}>
                          {w.week.phase}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-stone-500 flex-shrink-0" />
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-sm font-bold ${hasActual && w.actualHrs > 0 ? 'text-summit-light' : 'text-stone-400'}`}>
                            {hasActual ? `${w.actualHrs}h` : '—'}
                          </span>
                          <span className="text-stone-400 text-xs">/ {w.plannedHrs}h</span>
                        </div>
                        {hasActual && w.plannedHrs > 0 && (
                          <div className="mt-1 h-1 w-16 rounded-full bg-white/[0.06] overflow-hidden">
                            <div className={`h-full rounded-full ${hrsPct >= 80 ? 'bg-emerald-500' : hrsPct > 0 ? 'bg-amber-500' : 'bg-stone-700'}`} style={{ width: `${hrsPct}%` }} />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Zap size={14} className="text-stone-500 flex-shrink-0" />
                      <div className="flex items-baseline gap-1">
                        <span className={`text-sm font-bold ${hasActual && w.actualTss > 0 ? 'text-summit-light' : 'text-stone-400'}`}>
                          {hasActual && w.actualTss > 0 ? w.actualTss : '—'}
                        </span>
                        <span className="text-stone-400 text-xs">/ {Math.round(w.plannedTss)} TSS</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={14} className={w.completionPct >= 80 ? 'text-emerald-400' : w.completionPct > 0 ? 'text-amber-400' : 'text-stone-500'} />
                      <div>
                        <span className={`text-sm font-bold ${w.completionPct >= 80 ? 'text-emerald-400' : w.completionPct > 0 ? 'text-amber-400' : 'text-stone-400'}`}>
                          {w.doneSessions}/{w.totalSessions}
                        </span>
                        <span className="text-stone-400 text-xs ml-1">séances</span>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expand button — always available */}
                <div className="px-4 pb-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpandedWeek(isExpanded ? null : weekKey) }}
                    className="flex items-center gap-1 text-stone-400 hover:text-stone-300 text-xs transition-colors py-1"
                  >
                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {isExpanded ? 'Masquer' : hasStats
                      ? `Stats détaillées (${w.weekActivities.length} activité${w.weekActivities.length > 1 ? 's' : ''})`
                      : `Détail des ${w.totalSessions} séances prévues`
                    }
                  </button>
                </div>

                {/* Expanded section */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-white/[0.04] mt-1 pt-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* Distance */}
                      {w.totalDistance > 0 && (
                        <div className="bg-white/[0.03] rounded-lg p-3">
                          <div className="flex items-center gap-1.5 text-stone-400 text-[10px] uppercase tracking-wider mb-1">
                            <TrendingUp size={10} /> Distance
                          </div>
                          <p className="font-display text-lg font-bold text-summit-light">{w.totalDistance} <span className="text-xs text-stone-400">km</span></p>
                        </div>
                      )}

                      {/* Dénivelé */}
                      {w.totalElevation > 0 && (
                        <div className="bg-white/[0.03] rounded-lg p-3">
                          <div className="flex items-center gap-1.5 text-stone-400 text-[10px] uppercase tracking-wider mb-1">
                            <Mountain size={10} /> Dénivelé
                          </div>
                          <p className="font-display text-lg font-bold text-summit-light">{w.totalElevation.toLocaleString()} <span className="text-xs text-stone-400">m D+</span></p>
                        </div>
                      )}

                      {/* Puissance moyenne */}
                      {w.avgPower && (
                        <div className="bg-white/[0.03] rounded-lg p-3">
                          <div className="flex items-center gap-1.5 text-stone-400 text-[10px] uppercase tracking-wider mb-1">
                            <Zap size={10} /> Puissance moy
                          </div>
                          <p className="font-display text-lg font-bold text-summit-light">{w.avgPower} <span className="text-xs text-stone-400">W</span></p>
                          {w.maxPower && <p className="text-stone-400 text-xs">Max {w.maxPower} W</p>}
                        </div>
                      )}

                      {/* NP */}
                      {w.avgNP && (
                        <div className="bg-white/[0.03] rounded-lg p-3">
                          <div className="flex items-center gap-1.5 text-stone-400 text-[10px] uppercase tracking-wider mb-1">
                            <Gauge size={10} /> NP
                          </div>
                          <p className="font-display text-lg font-bold text-summit-light">{w.avgNP} <span className="text-xs text-stone-400">W</span></p>
                          {w.avgIF && <p className="text-stone-400 text-xs">IF {w.avgIF.toFixed(2)}</p>}
                        </div>
                      )}

                      {/* FC */}
                      {w.avgHr && (
                        <div className="bg-white/[0.03] rounded-lg p-3">
                          <div className="flex items-center gap-1.5 text-stone-400 text-[10px] uppercase tracking-wider mb-1">
                            <Heart size={10} /> FC moyenne
                          </div>
                          <p className="font-display text-lg font-bold text-summit-light">{w.avgHr} <span className="text-xs text-stone-400">bpm</span></p>
                          {w.maxHr && <p className="text-stone-400 text-xs">Max {w.maxHr} bpm</p>}
                        </div>
                      )}

                      {/* Vitesse */}
                      {w.avgSpeed && (
                        <div className="bg-white/[0.03] rounded-lg p-3">
                          <div className="flex items-center gap-1.5 text-stone-400 text-[10px] uppercase tracking-wider mb-1">
                            <TrendingUp size={10} /> Vitesse moy
                          </div>
                          <p className="font-display text-lg font-bold text-summit-light">{w.avgSpeed} <span className="text-xs text-stone-400">km/h</span></p>
                        </div>
                      )}

                      {/* Calories */}
                      {w.totalCalories > 0 && (
                        <div className="bg-white/[0.03] rounded-lg p-3">
                          <div className="flex items-center gap-1.5 text-stone-400 text-[10px] uppercase tracking-wider mb-1">
                            <Flame size={10} /> Calories
                          </div>
                          <p className="font-display text-lg font-bold text-summit-light">{w.totalCalories.toLocaleString()} <span className="text-xs text-stone-400">kcal</span></p>
                        </div>
                      )}

                      {/* Durée totale */}
                      <div className="bg-white/[0.03] rounded-lg p-3">
                        <div className="flex items-center gap-1.5 text-stone-400 text-[10px] uppercase tracking-wider mb-1">
                          <Clock size={10} /> Temps total
                        </div>
                        <p className="font-display text-lg font-bold text-summit-light">{formatDur(w.totalDuration)}</p>
                        <p className="text-stone-400 text-xs">{w.weekActivities.length} activité{w.weekActivities.length > 1 ? 's' : ''}</p>
                      </div>
                    </div>

                    {/* Activities list (for weeks with data) */}
                    {w.weekActivities.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="text-stone-400 text-[10px] uppercase tracking-wider mb-1">Activités réalisées</p>
                        {w.weekActivities.map(a => (
                          <div key={a.id} className="flex items-center gap-3 text-xs py-1.5 px-2 rounded-lg hover:bg-white/[0.02]">
                            <span className="text-stone-500 w-12 flex-shrink-0">{format(new Date(a.date), 'EEE d', { locale: fr })}</span>
                            <span className="text-summit-light font-medium truncate flex-1">{a.name}</span>
                            <span className="text-stone-400 flex-shrink-0">{formatDur(a.duration)}</span>
                            {a.distance && <span className="text-stone-400 flex-shrink-0">{a.distance.toFixed(1)}km</span>}
                            {a.tss && <span className="text-ventoux-400 flex-shrink-0 font-medium">TSS {Math.round(a.tss)}</span>}
                            {a.avgPower && <span className="text-stone-400 flex-shrink-0">{a.avgPower}W</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Planned sessions detail (for weeks without full activity data) */}
                    {!w.isHistorical && w.week.sessions?.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="text-stone-400 text-[10px] uppercase tracking-wider mb-1">Séances prévues</p>
                        {[...w.week.sessions].sort((a: any, b: any) => {
                          const order = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
                          return order.indexOf(a.day) - order.indexOf(b.day)
                        }).map((s: any) => {
                          const DAY_KEYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
                          const DAY_FR: Record<string, string> = { MON: 'LUN', TUE: 'MAR', WED: 'MER', THU: 'JEU', FRI: 'VEN', SAT: 'SAM', SUN: 'DIM' }
                          const CYCLING_TYPES = ['RIDE', 'VIRTUAL_RIDE']
                          const dayIdx = DAY_KEYS.indexOf(s.day)
                          const sessionDate = dayIdx >= 0 ? format(addDays(new Date(w.week.weekStart), dayIdx), 'yyyy-MM-dd') : null
                          const isDone = s.completed || (sessionDate && w.weekActivities.some((a: Activity) => {
                            const actDate = format(new Date(a.date), 'yyyy-MM-dd')
                            if (actDate !== sessionDate) return false
                            if (s.type === 'STRENGTH') return a.type === 'STRENGTH'
                            return CYCLING_TYPES.includes(a.type)
                          }))
                          return (
                          <div key={s.id} className="flex items-center gap-3 text-xs py-1.5 px-2 rounded-lg bg-white/[0.015]">
                            <span className="text-stone-500 w-8 flex-shrink-0 uppercase">{DAY_FR[s.day] || s.day?.slice(0, 3)}</span>
                            <span className="text-summit-light font-medium truncate flex-1">{s.name || s.type}</span>
                            <span className="text-stone-400 flex-shrink-0">{s.duration}min</span>
                            {s.tssTarget && <span className="text-ventoux-400/70 flex-shrink-0">TSS ~{s.tssTarget}</span>}
                            {s.intensityZone && <span className="text-stone-500 flex-shrink-0">Z{s.intensityZone}</span>}
                            {isDone && <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" />}
                          </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Monthly summary */}
      {sortedMonths.length > 0 && (
        <div>
          <h2 className="text-xs uppercase text-stone-400 tracking-widest mb-3">Bilan mensuel</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sortedMonths.map(([key, m]) => {
              const label = format(new Date(key + '-01'), 'MMMM yyyy', { locale: fr })
              const pct = m.total > 0 ? Math.round(m.done / m.total * 100) : 0
              const hrsPct = m.plannedHrs > 0 ? Math.min(Math.round((m.actualHrs / m.plannedHrs) * 100), 100) : 0

              return (
                <div key={key} className="card p-4">
                  <p className="text-sm font-medium text-summit-light capitalize mb-3">{label}</p>

                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                      <p className="text-stone-400 text-[10px] uppercase tracking-wider mb-1">Volume</p>
                      <p className="font-display text-lg font-bold text-summit-light">{m.actualHrs}h</p>
                      <p className="text-stone-400 text-xs">sur {Math.round(m.plannedHrs * 10) / 10}h</p>
                      {m.plannedHrs > 0 && (
                        <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <div className={`h-full rounded-full ${hrsPct >= 80 ? 'bg-emerald-500' : hrsPct > 0 ? 'bg-amber-500' : 'bg-stone-700'}`} style={{ width: `${hrsPct}%` }} />
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-stone-400 text-[10px] uppercase tracking-wider mb-1">TSS</p>
                      <p className="font-display text-lg font-bold text-summit-light">{m.actualTss}</p>
                      <p className="text-stone-400 text-xs">sur {Math.round(m.plannedTss)}</p>
                    </div>

                    <div>
                      <p className="text-stone-400 text-[10px] uppercase tracking-wider mb-1">Complétion</p>
                      <p className={`font-display text-lg font-bold ${pct >= 80 ? 'text-emerald-400' : pct > 0 ? 'text-amber-400' : 'text-stone-400'}`}>{pct}%</p>
                      <p className="text-stone-400 text-xs">{m.done}/{m.total} séances</p>
                      {m.total > 0 && (
                        <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <div className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-stone-700'}`} style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Extra monthly KPIs */}
                  {(m.distance > 0 || m.elevation > 0 || m.calories > 0) && (
                    <div className="flex items-center gap-4 text-xs text-stone-400 border-t border-white/[0.04] pt-2">
                      {m.distance > 0 && <span>{m.distance} km</span>}
                      {m.elevation > 0 && <span>{m.elevation.toLocaleString()} m D+</span>}
                      {m.calories > 0 && <span>{m.calories.toLocaleString()} kcal</span>}
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
}
