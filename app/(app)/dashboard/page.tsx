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
import OnboardingWizard from '@/components/onboarding/OnboardingWizard'
import { ProgressionCard } from './components/ProgressionCard'

const PMCChart = dynamic(() => import('./PMCChart'), {
  ssr: false,
  loading: () => <div className="h-64 bg-white/[0.05] rounded-xl animate-pulse" />,
})

// ─── Types inline ─────────────────────────────────────────────────────────────

interface DashboardData {
  user: UserProfile
  races: Race[]
  race: Race | null
  activePlan: TrainingPlan | null
  recentActivities: ActivityType[]
  weekActivities: ActivityType[]
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    loadDashboard()
  }, [])

  useEffect(() => {
    if (data && !data.user.ftp && data.races.length === 0 && data.recentActivities.length === 0) {
      setShowOnboarding(true)
    }
  }, [data])

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

      setData({ user, races, race: activeRace, activePlan, recentActivities: activities, weekActivities })
    } catch (e) {
      console.error('Dashboard error:', e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <DashboardSkeleton />
  if (!data) return null

  const { user, races, race, activePlan, recentActivities, weekActivities } = data

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
    <div className="space-y-10 animate-in">
      {showOnboarding && (
        <OnboardingWizard
          user={data.user}
          onComplete={() => { setShowOnboarding(false); loadDashboard() }}
        />
      )}

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
      <div>
        <h2 className="section-title mb-4">Performance</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="FTP"
          value={user.ftp ? `${user.ftp} W` : '—'}
          sub={user.ftp && user.weight ? `${(user.ftp / user.weight).toFixed(1)} W/kg` : ''}
          icon={<Zap size={16} />}
          color="ventoux"
          index={0}
        />
        <StatCard
          label="TSS semaine"
          value={weekTss > 0 ? Math.round(weekTss).toString() : '—'}
          sub={`${weekHours}h · ${weekActivities.length} séance${weekActivities.length > 1 ? 's' : ''}`}
          icon={<Clock size={16} />}
          color="ventoux"
          index={1}
        />
        <StatCard
          label="Fitness (CTL)"
          value={latest ? Math.round(latest.ctl).toString() : '—'}
          sub="Charge chronique"
          icon={<TrendingUp size={16} />}
          color={latest?.ctl > 60 ? 'green' : 'yellow'}
          tooltip="Charge chronique — fitness sur 42 jours"
          index={2}
        />
        <StatCard
          label="Fatigue (ATL)"
          value={latest ? Math.round(latest.atl).toString() : '—'}
          sub="Charge aiguë"
          icon={<Activity size={16} />}
          color={latest?.atl > (latest?.ctl || 0) * 1.3 ? 'red' : 'yellow'}
          tooltip="Charge aiguë — fatigue sur 7 jours"
          index={3}
        />
        <StatCard
          label="Forme (TSB)"
          value={latest ? (latest.tsb > 0 ? `+${Math.round(latest.tsb)}` : Math.round(latest.tsb).toString()) : '—'}
          sub={latest?.tsb > 5 ? 'Bien reposé' : latest?.tsb < -20 ? 'Fatigué' : 'Équilibré'}
          icon={<Activity size={16} />}
          color={latest?.tsb > 5 ? 'green' : latest?.tsb < -20 ? 'red' : 'yellow'}
          tooltip="Équilibre de forme — CTL moins ATL"
          index={4}
        />
        <StatCard
          label="Temps estimé"
          value={ventouxEstimate ? formatMinutes(ventouxEstimate.timeMinutes) : '—'}
          sub={ventouxEstimate?.category || 'Ventoux Bédoin'}
          icon={<Mountain size={16} />}
          color="blue"
          index={5}
        />
        </div>
      </div>

      {/* Progression */}
      {pmc.length > 0 && (
        <ProgressionCard pmc={pmc} activePlan={activePlan} ventouxEstimate={ventouxEstimate} />
      )}

      {/* PMC Chart + prochaines séances */}
      <div>
        <h2 className="section-title mb-4">Courbe de charge</h2>
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
          <PMCChart data={pmc} raceDate={race?.date} />
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
      </div>

      {/* Stepper onboarding — affiché quand pas de plan */}
      {!activePlan && (
        <div className="card p-8 text-center">
          <h2 className="font-display text-2xl font-bold text-summit-light mb-2">{"Prêt à grimper le Ventoux ?"}</h2>
          <p className="text-stone-500 mb-8">{"3 étapes pour démarrer ton entraînement"}</p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10">
            {/* Étape 1 */}
            <div className="flex flex-col items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                races.length > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-ventoux-gradient text-white'
              }`}>
                {races.length > 0 ? '\u2713' : '1'}
              </div>
              <div className="text-center">
                <p className="text-summit-light font-medium text-sm">Ajouter une course</p>
                <p className="text-stone-600 text-xs">Ton objectif de saison</p>
              </div>
              {races.length === 0 && <Link href="/races" className="btn-primary text-xs px-4 py-1.5">Ajouter</Link>}
            </div>

            {/* Ligne pointillée */}
            <div className="hidden md:block w-12 border-t border-dashed border-stone-700" />
            <div className="md:hidden h-6 border-l border-dashed border-stone-700" />

            {/* Étape 2 — FTP configuré */}
            <div className="flex flex-col items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                user?.ftp ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/[0.06] text-stone-500'
              }`}>
                {user?.ftp ? '\u2713' : '2'}
              </div>
              <div className="text-center">
                <p className="text-summit-light font-medium text-sm">Configurer ton profil</p>
                <p className="text-stone-600 text-xs">{"FTP, poids, disponibilités"}</p>
              </div>
              {!user?.ftp && <Link href="/profile" className="btn-secondary text-xs px-4 py-1.5">Profil</Link>}
            </div>

            <div className="hidden md:block w-12 border-t border-dashed border-stone-700" />
            <div className="md:hidden h-6 border-l border-dashed border-stone-700" />

            {/* Étape 3 — Générer le plan */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/[0.06] flex items-center justify-center text-lg font-bold text-stone-500">
                3
              </div>
              <div className="text-center">
                <p className="text-summit-light font-medium text-sm">Générer ton plan</p>
                <p className="text-stone-600 text-xs">{"L'IA crée ton programme"}</p>
              </div>
              <Link href="/plan" className="btn-secondary text-xs px-4 py-1.5">Générer</Link>
            </div>
          </div>
        </div>
      )}

      {/* Activités récentes */}
      <div>
        <h2 className="section-title mb-4">Activités récentes</h2>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
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

const StatCard = React.memo(function StatCard({ label, value, sub, icon, color, tooltip, index = 0 }: {
  label: string; value: string; sub: string; icon: React.ReactNode; color: string; tooltip?: string; index?: number
}) {
  const colorMap: Record<string, string> = {
    ventoux: 'text-ventoux-400 bg-ventoux-500/10',
    green:   'text-emerald-400 bg-emerald-500/10',
    yellow:  'text-amber-400 bg-amber-500/10',
    red:     'text-red-400 bg-red-500/10',
    blue:    'text-blue-400 bg-blue-500/10',
  }

  return (
    <div className="stat-card card-hover animate-in opacity-0" title={tooltip} style={{ animationDelay: `${index * 80}ms` }}>
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
