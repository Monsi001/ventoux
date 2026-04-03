'use client'
import { format, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Clock, Zap, CheckCircle2 } from 'lucide-react'
import type { TrainingPlan, TrainingWeek, Activity } from '@/types'

const PHASE_COLORS: Record<string, string> = {
  BASE: 'text-blue-400 bg-blue-500/10',
  BUILD: 'text-amber-400 bg-amber-500/10',
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

export default function VolumeChart({ plan, activities, currentWeekIdx, onWeekSelect }: VolumeChartProps) {
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
    const actualHrs = Math.round(weekActivities.reduce((sum, a) => sum + (a.duration || 0), 0) / 3600 * 10) / 10
    const actualTss = Math.round(weekActivities.reduce((sum, a) => sum + (a.tss || 0), 0))

    const totalSessions = week.sessions?.length || 0
    const doneSessions = week.sessions?.filter(s => s.completed).length || 0
    const completionPct = totalSessions > 0 ? Math.round(doneSessions / totalSessions * 100) : 0

    return { week, i, isPast, isCurrent, plannedHrs, plannedTss, actualHrs, actualTss, doneSessions, totalSessions, completionPct, weekActivities }
  })

  // Monthly aggregation — only months covered by the plan
  const monthsMap = new Map<string, { plannedHrs: number; actualHrs: number; plannedTss: number; actualTss: number; done: number; total: number }>()
  weeksData.forEach(w => {
    const monthKey = format(new Date(w.week.weekStart), 'yyyy-MM')
    if (!monthsMap.has(monthKey)) monthsMap.set(monthKey, { plannedHrs: 0, actualHrs: 0, plannedTss: 0, actualTss: 0, done: 0, total: 0 })
    const m = monthsMap.get(monthKey)!
    m.plannedHrs += w.plannedHrs
    m.plannedTss += w.plannedTss
    m.done += w.doneSessions
    m.total += w.totalSessions
    w.weekActivities.forEach(a => {
      m.actualHrs += a.duration / 3600
      m.actualTss += a.tss || 0
    })
  })
  monthsMap.forEach(m => { m.actualHrs = Math.round(m.actualHrs * 10) / 10; m.actualTss = Math.round(m.actualTss) })
  const sortedMonths = Array.from(monthsMap.entries()).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="mt-8 space-y-8">
      {/* Weekly recap table */}
      <div>
        <h2 className="text-xs uppercase text-stone-400 tracking-widest mb-3">Récap hebdomadaire</h2>
        <div className="grid gap-2">
          {weeksData.map(({ week, i, isPast, isCurrent, plannedHrs, plannedTss, actualHrs, actualTss, completionPct, doneSessions, totalSessions }) => {
            const isSelected = i === currentWeekIdx
            const hasActual = isPast || isCurrent
            const hrsPct = plannedHrs > 0 ? Math.min(Math.round((actualHrs / plannedHrs) * 100), 100) : 0
            const weekStart = new Date(week.weekStart)

            return (
              <button
                key={i}
                onClick={() => onWeekSelect(i)}
                className={`w-full text-left rounded-xl p-4 transition-all ${
                  isSelected
                    ? 'bg-ventoux-500/10 ring-1 ring-ventoux-500/30'
                    : isCurrent
                    ? 'bg-white/[0.04] ring-1 ring-white/[0.08]'
                    : 'bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`font-display font-bold text-sm ${isSelected ? 'text-ventoux-400' : 'text-summit-light'}`}>
                      S{week.weekNumber}
                    </span>
                    <span className="text-stone-400 text-xs">
                      {format(weekStart, 'd MMM', { locale: fr })} — {format(addDays(weekStart, 6), 'd MMM', { locale: fr })}
                    </span>
                    {isCurrent && <span className="text-[10px] px-1.5 py-0.5 rounded bg-ventoux-500/20 text-ventoux-400 font-medium">En cours</span>}
                  </div>
                  {week.phase && (
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${PHASE_COLORS[week.phase] || ''}`}>
                      {week.phase}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {/* Volume */}
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-stone-500 flex-shrink-0" />
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-sm font-bold ${hasActual && actualHrs > 0 ? 'text-summit-light' : 'text-stone-400'}`}>
                          {hasActual ? `${actualHrs}h` : '—'}
                        </span>
                        <span className="text-stone-400 text-xs">/ {plannedHrs}h</span>
                      </div>
                      {hasActual && plannedHrs > 0 && (
                        <div className="mt-1 h-1 w-16 rounded-full bg-white/[0.06] overflow-hidden">
                          <div className={`h-full rounded-full ${hrsPct >= 80 ? 'bg-emerald-500' : hrsPct > 0 ? 'bg-amber-500' : 'bg-stone-700'}`} style={{ width: `${hrsPct}%` }} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* TSS */}
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-stone-500 flex-shrink-0" />
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-sm font-bold ${hasActual && actualTss > 0 ? 'text-summit-light' : 'text-stone-400'}`}>
                          {hasActual && actualTss > 0 ? actualTss : '—'}
                        </span>
                        <span className="text-stone-400 text-xs">/ {Math.round(plannedTss)} TSS</span>
                      </div>
                    </div>
                  </div>

                  {/* Complétion */}
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className={completionPct >= 80 ? 'text-emerald-400' : completionPct > 0 ? 'text-amber-400' : 'text-stone-500'} />
                    <div>
                      <span className={`text-sm font-bold ${completionPct >= 80 ? 'text-emerald-400' : completionPct > 0 ? 'text-amber-400' : 'text-stone-400'}`}>
                        {doneSessions}/{totalSessions}
                      </span>
                      <span className="text-stone-400 text-xs ml-1">séances</span>
                    </div>
                  </div>
                </div>
              </button>
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

                  <div className="grid grid-cols-3 gap-3">
                    {/* Volume */}
                    <div>
                      <p className="text-stone-400 text-[10px] uppercase tracking-wider mb-1">Volume</p>
                      <p className="font-display text-lg font-bold text-summit-light">{m.actualHrs}h</p>
                      <p className="text-stone-400 text-xs">sur {Math.round(m.plannedHrs * 10) / 10}h prévues</p>
                      {m.plannedHrs > 0 && (
                        <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <div className={`h-full rounded-full ${hrsPct >= 80 ? 'bg-emerald-500' : hrsPct > 0 ? 'bg-amber-500' : 'bg-stone-700'}`} style={{ width: `${hrsPct}%` }} />
                        </div>
                      )}
                    </div>

                    {/* TSS */}
                    <div>
                      <p className="text-stone-400 text-[10px] uppercase tracking-wider mb-1">TSS</p>
                      <p className="font-display text-lg font-bold text-summit-light">{m.actualTss}</p>
                      <p className="text-stone-400 text-xs">sur {Math.round(m.plannedTss)} prévus</p>
                    </div>

                    {/* Complétion */}
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
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
