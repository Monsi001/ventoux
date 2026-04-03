'use client'
import { format, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'
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
    const actualTss = weekActivities.reduce((sum, a) => sum + (a.tss || 0), 0)

    const totalSessions = week.sessions?.length || 0
    const doneSessions = week.sessions?.filter(s => s.completed).length || 0
    const completionPct = totalSessions > 0 ? Math.round(doneSessions / totalSessions * 100) : 0

    return { week, i, isPast, isCurrent, plannedHrs, plannedTss, actualHrs, actualTss, doneSessions, totalSessions, completionPct, weekActivities }
  })

  const maxHrs = Math.max(...weeksData.map(w => Math.max(w.plannedHrs, w.actualHrs)), 1)

  // Monthly aggregation — only months covered by the plan
  const months = new Map<string, { plannedHrs: number, actualHrs: number, plannedTss: number, actualTss: number, done: number, total: number }>()

  weeksData.forEach(w => {
    const monthKey = format(new Date(w.week.weekStart), 'yyyy-MM')
    if (!months.has(monthKey)) months.set(monthKey, { plannedHrs: 0, actualHrs: 0, plannedTss: 0, actualTss: 0, done: 0, total: 0 })
    const m = months.get(monthKey)!
    m.plannedHrs += w.plannedHrs
    m.plannedTss += w.plannedTss
    m.done += w.doneSessions
    m.total += w.totalSessions
    // Actual hours/TSS from activities matching this week only
    w.weekActivities.forEach(a => {
      m.actualHrs += a.duration / 3600
      m.actualTss += a.tss || 0
    })
  })

  months.forEach(m => { m.actualHrs = Math.round(m.actualHrs * 10) / 10 })

  // Sort months chronologically
  const sortedMonths = Array.from(months.entries()).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="mt-8 space-y-6">
      {/* Weekly volume chart */}
      <div>
        <h2 className="text-xs uppercase text-stone-400 tracking-widest mb-3">Volume hebdomadaire</h2>
        <div className="flex gap-1 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 items-end" style={{ minHeight: 140 }}>
          {weeksData.map(({ week, i, isPast, isCurrent, plannedHrs, plannedTss, actualHrs, actualTss, completionPct, doneSessions, totalSessions }) => {
            const isSelected = i === currentWeekIdx
            const barH = Math.max(8, (plannedHrs / maxHrs) * 100)
            const actualH = Math.max(0, (actualHrs / maxHrs) * 100)
            const hasActual = isPast || isCurrent

            return (
              <button
                key={i}
                onClick={() => onWeekSelect(i)}
                className={`flex-shrink-0 w-14 md:flex-1 md:w-auto flex flex-col items-center gap-1 transition-all rounded-lg py-1.5 px-0.5 ${
                  isSelected
                    ? 'bg-ventoux-500/15 ring-1 ring-ventoux-500/30'
                    : 'hover:bg-white/[0.03]'
                }`}
              >
                {/* Bars */}
                <div className="relative w-full flex justify-center items-end gap-[2px]" style={{ height: 80 }}>
                  <div
                    className={`w-3 rounded-t transition-all ${isPast ? 'bg-stone-800' : isCurrent ? 'bg-ventoux-500/30' : 'bg-stone-800/60'}`}
                    style={{ height: `${barH}%` }}
                    title={`Prévu: ${plannedHrs}h`}
                  />
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

                {hasActual && totalSessions > 0 && (
                  <div className={`text-[9px] font-medium px-1 rounded ${
                    completionPct >= 80 ? 'text-green-400' : completionPct > 0 ? 'text-amber-400' : 'text-stone-400'
                  }`}>
                    {doneSessions}/{totalSessions}
                  </div>
                )}

                <p className={`text-[10px] font-mono font-bold ${isSelected ? 'text-ventoux-400' : isCurrent ? 'text-summit-light' : 'text-stone-400'}`}>
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
        <div className="flex items-center gap-4 mt-2 text-[10px] text-stone-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-stone-800 inline-block" /> Prévu</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500 inline-block" /> Réalisé</span>
        </div>
      </div>

      {/* Monthly summary */}
      {sortedMonths.length > 1 && (
        <div>
          <h2 className="text-xs uppercase text-stone-400 tracking-widest mb-3">Bilan mensuel</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {sortedMonths.map(([key, m]) => {
              const label = format(new Date(key + '-01'), 'MMM yyyy', { locale: fr })
              const pct = m.total > 0 ? Math.round(m.done / m.total * 100) : 0
              return (
                <div key={key} className="bg-white/[0.02] rounded-xl p-3 space-y-2">
                  <p className="text-xs font-medium text-stone-400 capitalize">{label}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-lg font-bold text-summit-light">{Math.round(m.actualHrs * 10) / 10}h</span>
                    <span className="text-[10px] text-stone-400">/ {Math.round(m.plannedHrs * 10) / 10}h</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-summit-light font-medium">{Math.round(m.actualTss)} <span className="text-stone-400">TSS</span></span>
                    <span className="text-[10px] text-stone-400">/ {Math.round(m.plannedTss)}</span>
                  </div>
                  {m.total > 0 && (
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-stone-400">Complétion</span>
                        <span className={pct >= 80 ? 'text-green-400' : pct > 0 ? 'text-amber-400' : 'text-stone-400'}>{pct}%</span>
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
}
