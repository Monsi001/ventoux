'use client'
import { TrendingUp, Target, CheckCircle2 } from 'lucide-react'

interface ProgressionCardProps {
  pmc: { date: string; ctl: number; atl: number; tsb: number }[]
  activePlan: any
  ventouxEstimate: { timeMinutes: number; category: string } | null
}

export function ProgressionCard({ pmc, activePlan, ventouxEstimate }: ProgressionCardProps) {
  const today = new Date()

  // A. Tendance fitness (28 jours)
  const hasFitnessData = pmc.length >= 29
  const currentCTL = pmc[pmc.length - 1]?.ctl ?? 0
  const pastCTL = pmc[pmc.length - 29]?.ctl ?? 0
  const ctlDelta = Math.round(currentCTL - pastCTL)

  let fitnessText = ''
  let fitnessColor = ''
  if (hasFitnessData) {
    if (ctlDelta > 2) {
      fitnessText = `Ton fitness a augmenté de +${ctlDelta} pts en 4 semaines`
      fitnessColor = 'text-emerald-400'
    } else if (ctlDelta < -2) {
      fitnessText = `Ton fitness a baissé de ${Math.abs(ctlDelta)} pts`
      fitnessColor = 'text-red-400'
    } else {
      fitnessText = 'Ton fitness est stable'
      fitnessColor = 'text-amber-400'
    }
  }

  // B. Taux de complétion
  let completionRate = 0
  let totalSessions = 0
  let completedSessions = 0
  if (activePlan?.weeks) {
    for (const week of activePlan.weeks) {
      const weekStart = new Date(week.weekStart)
      if (weekStart < today) {
        for (const session of week.sessions || []) {
          totalSessions++
          if (session.completed) completedSessions++
        }
      }
    }
    completionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0
  }

  // C. Sparkline CTL (8 dernières semaines)
  const sparkData = pmc.filter((_, i) => i % 7 === 0).slice(-8).map(d => d.ctl)
  const min = Math.min(...sparkData)
  const max = Math.max(...sparkData)
  const range = max - min || 1
  const points = sparkData.length > 1
    ? sparkData.map((v, i) => `${(i / (sparkData.length - 1)) * 100},${100 - ((v - min) / range) * 80 + 10}`).join(' ')
    : ''

  return (
    <div className="card p-5">
      <h2 className="font-display text-xs uppercase tracking-[0.2em] text-stone-600 mb-4">Ta progression</h2>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Colonne gauche : texte */}
        <div className="space-y-4">
          {/* Tendance fitness */}
          {hasFitnessData && (
            <div className="flex items-start gap-3">
              <div className="inline-flex p-2 rounded-lg text-ventoux-400 bg-ventoux-500/10">
                <TrendingUp size={16} />
              </div>
              <div>
                <p className={`text-sm font-medium ${fitnessColor}`}>
                  {ctlDelta > 2 ? '📈 ' : ctlDelta < -2 ? '📉 ' : '→ '}
                  {fitnessText}
                </p>
                <p className="text-stone-600 text-xs mt-0.5">
                  CTL {Math.round(pastCTL)} → {Math.round(currentCTL)}
                </p>
              </div>
            </div>
          )}

          {/* Taux de complétion */}
          {activePlan && totalSessions > 0 && (
            <div className="flex items-start gap-3">
              <div className="inline-flex p-2 rounded-lg text-emerald-400 bg-emerald-500/10">
                <CheckCircle2 size={16} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-summit-light">
                  {completionRate}% des séances complétées
                </p>
                <p className="text-stone-600 text-xs mt-0.5">
                  {completedSessions}/{totalSessions} séances
                </p>
                {/* Barre de progression */}
                <div className="mt-2 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${completionRate}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Estimation Ventoux */}
          {ventouxEstimate && (
            <div className="flex items-start gap-3">
              <div className="inline-flex p-2 rounded-lg text-blue-400 bg-blue-500/10">
                <Target size={16} />
              </div>
              <div>
                <p className="text-sm font-medium text-summit-light">
                  Objectif : {ventouxEstimate.category}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Colonne droite : sparkline */}
        {sparkData.length > 1 && (
          <div className="flex flex-col justify-center">
            <p className="text-stone-600 text-xs mb-2">CTL — 8 dernières semaines</p>
            <svg viewBox="0 0 100 100" className="w-full h-16" preserveAspectRatio="none">
              <polyline
                points={points}
                fill="none"
                stroke="#FF6B35"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="flex justify-between text-stone-600 text-xs mt-1">
              <span>{Math.round(sparkData[0])}</span>
              <span>{Math.round(sparkData[sparkData.length - 1])}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
