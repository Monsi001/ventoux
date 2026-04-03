'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  TrendingUp, Zap, Calendar, Mountain, Clock,
  Activity, ChevronRight, RefreshCw, AlertTriangle,
  CheckCircle2, Moon
} from 'lucide-react'
import { calculatePMC, estimateVentouxTime, formatMinutes } from '@/lib/training'
import { format, differenceInDays, startOfWeek, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Activity as ActivityType, TrainingPlan, Race, UserProfile } from '@/types'
import { cachedFetch } from '@/lib/fetch-cache'

const PMCChart = dynamic(() => import('./PMCChart'), {
  ssr: false,
  loading: () => <div className="h-64 bg-white/[0.05] rounded-xl animate-pulse" />,
})

// ─── Types inline ─────────────────────────────────────────────────────────────

interface DashboardData {
  user: UserProfile
  race: Race | null
  activePlan: TrainingPlan | null
  recentActivities: ActivityType[]
  weekActivities: ActivityType[]
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    setLoading(true)
    try {
      const initData = await cachedFetch('/api/init?include=profile,races,activities,plans&activityLimit=60')
      const user = initData.profile
      const races = Array.isArray(initData.races) ? initData.races : []
      const activities = Array.isArray(initData.activities) ? initData.activities : []
      const plans = Array.isArray(initData.plans) ? initData.plans : []

      const activeRace = Array.isArray(races)
        ? races.find((r: Race) => r.isActive) || races[0]
        : null

      const activePlan = Array.isArray(plans) ? plans[0] : null

      // Activités de la semaine courante
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
      const weekActivities = (activities as ActivityType[]).filter(a =>
        new Date(a.date) >= weekStart
      )

      setData({ user, race: activeRace, activePlan, recentActivities: activities, weekActivities })
    } catch (e) {
      console.error('Dashboard error:', e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <DashboardSkeleton />
  if (!data) return null

  const { user, race, activePlan, recentActivities, weekActivities } = data

  // Stats semaine
  const weekTss = weekActivities.reduce((s, a) => s + (a.tss || 0), 0)
  const weekHours = Math.round(weekActivities.reduce((s, a) => s + a.duration, 0) / 3600 * 10) / 10

  // Calcul PMC (le filtre tss != null est fait côté requête Prisma)
  const activitiesForPMC = recentActivities
    .map(a => ({ date: a.date, tss: a.tss! }))

  const pmc = calculatePMC(activitiesForPMC, 60)
  const latest = pmc[pmc.length - 1]

  // Estimation Ventoux
  const ventouxEstimate = user.weight && user.ftp
    ? estimateVentouxTime(user.weight, user.ftp)
    : null

  // Prochaines séances du plan
  const today = new Date()
  const currentWeekNum = activePlan
    ? Math.max(1, Math.ceil(differenceInDays(today, new Date()) / 7) + 1)
    : 1

  const nextSessions = activePlan?.weeks
    ?.find((w: any) => {
      const weekStart = new Date(w.weekStart)
      const weekEnd = addDays(weekStart, 7)
      return today >= weekStart && today < weekEnd
    })
    ?.sessions?.slice(0, 3) || []

  const daysUntilRace = race ? differenceInDays(new Date(race.date), today) : null

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-summit-light uppercase tracking-wide">
            Tableau de bord
          </h1>
          <p className="text-stone-500 mt-0.5">
            {format(today, "EEEE d MMMM yyyy", { locale: fr })}
          </p>
        </div>
        {race && daysUntilRace !== null && (
          <div className="text-right">
            <div className="flex items-center gap-2 text-ventoux-400">
              <Mountain size={16} />
              <span className="font-display text-sm uppercase tracking-widest">{race.name}</span>
            </div>
            <p className="font-display text-3xl md:text-4xl font-bold text-summit-light mt-0.5">
              J{daysUntilRace > 0 ? `-${daysUntilRace}` : daysUntilRace === 0 ? '0' : `+${Math.abs(daysUntilRace)}`}
            </p>
          </div>
        )}
      </div>

      {/* Today Hero */}
      <TodayHero activePlan={activePlan} />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="FTP"
          value={user.ftp ? `${user.ftp} W` : '—'}
          sub={user.ftp && user.weight ? `${(user.ftp / user.weight).toFixed(1)} W/kg` : ''}
          icon={<Zap size={16} />}
          color="ventoux"
        />
        <StatCard
          label="TSS semaine"
          value={weekTss > 0 ? Math.round(weekTss).toString() : '—'}
          sub={`${weekHours}h · ${weekActivities.length} séance${weekActivities.length > 1 ? 's' : ''}`}
          icon={<Clock size={16} />}
          color="ventoux"
        />
        <StatCard
          label="Fitness (CTL)"
          value={latest ? Math.round(latest.ctl).toString() : '—'}
          sub="Charge chronique"
          icon={<TrendingUp size={16} />}
          color={latest?.ctl > 60 ? 'green' : 'yellow'}
          tooltip="Charge chronique — fitness sur 42 jours"
        />
        <StatCard
          label="Fatigue (ATL)"
          value={latest ? Math.round(latest.atl).toString() : '—'}
          sub="Charge aiguë"
          icon={<Activity size={16} />}
          color={latest?.atl > (latest?.ctl || 0) * 1.3 ? 'red' : 'yellow'}
          tooltip="Charge aiguë — fatigue sur 7 jours"
        />
        <StatCard
          label="Forme (TSB)"
          value={latest ? (latest.tsb > 0 ? `+${Math.round(latest.tsb)}` : Math.round(latest.tsb).toString()) : '—'}
          sub={latest?.tsb > 5 ? 'Bien reposé' : latest?.tsb < -20 ? 'Fatigué' : 'Équilibré'}
          icon={<Activity size={16} />}
          color={latest?.tsb > 5 ? 'green' : latest?.tsb < -20 ? 'red' : 'yellow'}
          tooltip="Équilibre de forme — CTL moins ATL"
        />
        <StatCard
          label="Temps estimé"
          value={ventouxEstimate ? formatMinutes(ventouxEstimate.timeMinutes) : '—'}
          sub={ventouxEstimate?.category || 'Ventoux Bédoin'}
          icon={<Mountain size={16} />}
          color="blue"
        />
      </div>

      {/* PMC Chart + prochaines séances */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* PMC */}
        <div className="md:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title text-base">Performance Management</h2>
            <div className="flex items-center gap-3 text-xs text-stone-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-white/10 inline-block rounded-sm" />TSS</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-blue-400 inline-block rounded" />CTL</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-red-400 inline-block rounded" />ATL</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-ventoux-500 inline-block rounded" />TSB</span>
            </div>
          </div>
          <PMCChart data={pmc.slice(-42)} />
        </div>

        {/* Prochaines séances */}
        <div className="card p-5">
          <h2 className="section-title text-base mb-4">Cette semaine</h2>
          {nextSessions.length > 0 ? (
            <div className="space-y-3">
              {nextSessions.map((session: any) => (
                <SessionCard key={session.id} session={session} userFtp={user.ftp} />
              ))}
              <Link href="/plan" className="flex items-center justify-between text-ventoux-400 text-sm mt-2 hover:text-ventoux-300 transition-colors">
                Voir le plan complet
                <ChevronRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar size={32} className="mx-auto text-stone-700 mb-3" />
              <p className="text-stone-500 text-sm">{"Aucun plan d'entraînement actif"}</p>
              <Link href="/plan" className="btn-primary text-sm inline-block mt-3 px-4 py-2">
                Générer un plan
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Activités récentes */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title text-base">Activités récentes</h2>
          <Link href="/activities" className="btn-ghost text-sm flex items-center gap-1.5">
            Tout voir <ChevronRight size={14} />
          </Link>
        </div>
        {recentActivities.length > 0 ? (
          <div className="space-y-2">
            {recentActivities.slice(0, 5).map(a => (
              <ActivityRow key={a.id} activity={a} userFtp={user.ftp} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Activity size={32} className="mx-auto text-stone-700 mb-3" />
            <p className="text-stone-500 text-sm">Aucune activité enregistrée</p>
            <p className="text-stone-600 text-xs mt-1">Connectez votre compte Strava ou importez un fichier GPX/FIT</p>
            <div className="flex items-center justify-center gap-3 mt-3">
              <Link href="/profile" className="btn-primary text-sm inline-block px-4 py-2">
                Connecter Strava
              </Link>
              <Link href="/activities" className="btn-secondary text-sm inline-block px-4 py-2">
                Importer un fichier
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sous-composants ─────────────────────────────────────────────────────────

const DAY_KEYS_FROM_JS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const TYPE_ICONS_EMOJI: Record<string, string> = {
  ENDURANCE: '🚴', TEMPO: '⚡', THRESHOLD: '🔥', VO2MAX: '💥',
  SWEET_SPOT: '🎯', RECOVERY: '🌿', LONG_RIDE: '🏔️', RACE_SIM: '🏁',
  STRENGTH: '💪', REST: '😴', VIRTUAL_RIDE: '🖥️',
}

function TodayHero({ activePlan }: { activePlan: TrainingPlan | null }) {
  if (!activePlan) return null

  const today = new Date()
  const todayDayKey = DAY_KEYS_FROM_JS[today.getDay()]

  // Find current week
  const currentWeek = activePlan.weeks?.find((w: any) => {
    const weekStart = new Date(w.weekStart)
    const weekEnd = addDays(weekStart, 7)
    return today >= weekStart && today < weekEnd
  })

  if (!currentWeek) return null

  const todaySession = currentWeek.sessions?.find((s: any) => s.day === todayDayKey)

  // Rest day
  if (!todaySession) {
    return (
      <div className="card p-5 relative overflow-hidden border-l-4 border-stone-600">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 p-3 rounded-xl bg-stone-800/50">
            <Moon size={24} className="text-stone-400" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-500 mb-1">Aujourd&apos;hui</p>
            <p className="font-display text-xl font-bold text-summit-light">Repos</p>
            <p className="text-stone-500 text-sm mt-0.5">La récupération fait partie de l&apos;entraînement</p>
          </div>
        </div>
      </div>
    )
  }

  // Session completed
  if (todaySession.completed) {
    const color = ZONE_COLORS[todaySession.intensityZone] || '#6E6C69'
    return (
      <div className="card p-5 relative overflow-hidden border-l-4" style={{ borderLeftColor: color }}>
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 p-3 rounded-xl bg-emerald-500/10">
            <CheckCircle2 size={24} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-500 mb-1">Aujourd&apos;hui</p>
            <p className="font-display text-xl font-bold text-summit-light">Séance terminée</p>
            <p className="text-stone-500 text-sm mt-0.5">{todaySession.name} — Bien joué, continue comme ça !</p>
          </div>
        </div>
      </div>
    )
  }

  // Session pending
  const color = ZONE_COLORS[todaySession.intensityZone] || '#6E6C69'
  const icon = TYPE_ICONS_EMOJI[todaySession.type] || '🚴'
  const zoneLabel = TYPE_LABELS[todaySession.type] || todaySession.type

  return (
    <div className="card p-5 relative overflow-hidden border-l-4" style={{ borderLeftColor: color }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-widest text-stone-500 mb-1">Aujourd&apos;hui</p>
          <p className="font-display text-xl font-bold text-summit-light">
            <span className="mr-2">{icon}</span>{todaySession.name}
          </p>

          {/* Metrics row */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.05] text-sm text-stone-300">
              <Clock size={13} /> {todaySession.duration} min
            </span>
            {todaySession.tssTarget && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.05] text-sm text-stone-300">
                <Zap size={13} /> TSS {todaySession.tssTarget}
              </span>
            )}
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium"
              style={{ background: color + '20', color }}
            >
              Z{todaySession.intensityZone} · {zoneLabel}
            </span>
          </div>

          {/* Description */}
          {todaySession.description && (
            <p className="text-stone-500 text-sm mt-2 line-clamp-2">{todaySession.description}</p>
          )}
        </div>

        <Link href="/plan" className="btn-primary text-sm px-4 py-2 flex-shrink-0 mt-1">
          Voir la séance
        </Link>
      </div>
    </div>
  )
}

const StatCard = React.memo(function StatCard({ label, value, sub, icon, color, tooltip }: {
  label: string; value: string; sub: string; icon: React.ReactNode; color: string; tooltip?: string
}) {
  const colorMap: Record<string, string> = {
    ventoux: 'text-ventoux-400 bg-ventoux-500/10',
    green:   'text-emerald-400 bg-emerald-500/10',
    yellow:  'text-amber-400 bg-amber-500/10',
    red:     'text-red-400 bg-red-500/10',
    blue:    'text-blue-400 bg-blue-500/10',
  }

  return (
    <div className="stat-card card-hover" title={tooltip}>
      <div className={`inline-flex p-2 rounded-lg ${colorMap[color]} mb-2`}>
        {icon}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="text-stone-600 text-xs mt-0.5">{sub}</div>}
    </div>
  )
})

const ZONE_COLORS: Record<number, string> = {
  1: '#6B9EFF', 2: '#4ECCA3', 3: '#F7C948', 4: '#FF9F45', 5: '#FF5252', 6: '#C45EFF', 7: '#FF2D9A',
}

const TYPE_LABELS: Record<string, string> = {
  ENDURANCE: 'Endurance Z2', TEMPO: 'Tempo', THRESHOLD: 'Seuil', VO2MAX: 'VO2Max',
  SWEET_SPOT: 'Sweet Spot', RECOVERY: 'Récupération', LONG_RIDE: 'Longue sortie',
  RACE_SIM: 'Simulation course', STRENGTH: 'Renforcement', REST: 'Repos', VIRTUAL_RIDE: 'Home trainer',
}

const DAY_FR: Record<string, string> = {
  MON: 'Lun', TUE: 'Mar', WED: 'Mer', THU: 'Jeu', FRI: 'Ven', SAT: 'Sam', SUN: 'Dim',
}

function SessionCard({ session, userFtp }: { session: any; userFtp: number | null }) {
  const color = ZONE_COLORS[session.intensityZone] || '#6E6C69'
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] transition-colors">
      <div className="w-1.5 h-10 rounded-full flex-shrink-0" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <p className="text-summit-light text-sm font-medium truncate">{session.name}</p>
        <p className="text-stone-500 text-xs">{DAY_FR[session.day]} · {session.duration}min · TSS~{session.tssTarget}</p>
      </div>
    </div>
  )
}

const ActivityRow = React.memo(function ActivityRow({ activity, userFtp }: { activity: ActivityType; userFtp: number | null }) {
  const sourceColors: Record<string, string> = {
    STRAVA: '#FC4C02', MYWHOOSH: '#1E3A5F', MANUAL: '#6E6C69',
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors group">
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sourceColors[activity.source] }} />
      <div className="flex-1 min-w-0">
        <p className="text-summit-light text-sm truncate">{activity.name}</p>
        <p className="text-stone-600 text-xs">
          {format(new Date(activity.date), 'dd MMM', { locale: fr })}
          {activity.distance ? ` · ${activity.distance.toFixed(1)} km` : ''}
          {activity.elevation ? ` · ${activity.elevation} m D+` : ''}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        {activity.tss && <p className="text-sm font-mono text-stone-400">TSS {Math.round(activity.tss)}</p>}
        {activity.avgPower && userFtp && (
          <p className="text-xs text-stone-600">{Math.round((activity.avgPower / userFtp) * 100)}% FTP</p>
        )}
      </div>
    </div>
  )
})

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="skeleton h-8 w-48 rounded-xl" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 skeleton h-64 rounded-2xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    </div>
  )
}
