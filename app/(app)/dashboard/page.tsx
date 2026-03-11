'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  TrendingUp, Zap, Calendar, Mountain, Clock,
  Activity, ChevronRight, RefreshCw, AlertTriangle
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine
} from 'recharts'
import { calculatePMC, estimateVentouxTime, formatMinutes } from '@/lib/training'
import { format, differenceInDays, startOfWeek, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Activity as ActivityType, TrainingPlan, Race, UserProfile } from '@/types'

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
      const [userRes, racesRes, activitiesRes, plansRes] = await Promise.all([
        fetch('/api/profile'),
        fetch('/api/races'),
        fetch('/api/activities?limit=60'),
        fetch('/api/plan/generate'),
      ])

      const [user, races, activities, plans] = await Promise.all([
        userRes.json(),
        racesRes.json(),
        activitiesRes.json(),
        plansRes.json(),
      ])

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

  // Calcul PMC
  const activitiesForPMC = recentActivities
    .filter(a => a.tss !== null)
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
          <h1 className="font-display text-3xl font-bold text-summit-light uppercase tracking-wide">
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
            <p className="font-display text-4xl font-bold text-summit-light mt-0.5">
              J{daysUntilRace > 0 ? `-${daysUntilRace}` : daysUntilRace === 0 ? '0' : `+${Math.abs(daysUntilRace)}`}
            </p>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="FTP"
          value={user.ftp ? `${user.ftp} W` : '—'}
          sub={user.ftp && user.weight ? `${(user.ftp / user.weight).toFixed(1)} W/kg` : ''}
          icon={<Zap size={16} />}
          color="ventoux"
        />
        <StatCard
          label="Fitness (CTL)"
          value={latest ? Math.round(latest.ctl).toString() : '—'}
          sub="Charge chronique"
          icon={<TrendingUp size={16} />}
          color={latest?.ctl > 60 ? 'green' : 'yellow'}
        />
        <StatCard
          label="Forme (TSB)"
          value={latest ? (latest.tsb > 0 ? `+${Math.round(latest.tsb)}` : Math.round(latest.tsb).toString()) : '—'}
          sub={latest?.tsb > 5 ? 'Bien reposé' : latest?.tsb < -20 ? 'Fatigué' : 'Équilibré'}
          icon={<Activity size={16} />}
          color={latest?.tsb > 5 ? 'green' : latest?.tsb < -20 ? 'red' : 'yellow'}
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
            <div className="flex items-center gap-4 text-xs text-stone-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-blue-400 inline-block rounded" />CTL</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-red-400 inline-block rounded" />ATL</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-ventoux-500 inline-block rounded" />TSB</span>
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
              <p className="text-stone-500 text-sm">Aucun plan généré</p>
              <Link href="/races" className="btn-primary text-sm inline-block mt-3 px-4 py-2">
                Créer un plan
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
            <p className="text-stone-500 text-sm">Aucune activité — connectez Strava ou uploadez un fichier</p>
            <Link href="/activities" className="btn-secondary text-sm inline-block mt-3 px-4 py-2">
              Importer des activités
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sous-composants ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub: string; icon: React.ReactNode; color: string
}) {
  const colorMap: Record<string, string> = {
    ventoux: 'text-ventoux-400 bg-ventoux-500/10',
    green:   'text-emerald-400 bg-emerald-500/10',
    yellow:  'text-amber-400 bg-amber-500/10',
    red:     'text-red-400 bg-red-500/10',
    blue:    'text-blue-400 bg-blue-500/10',
  }

  return (
    <div className="stat-card card-hover">
      <div className={`inline-flex p-2 rounded-lg ${colorMap[color]} mb-2`}>
        {icon}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="text-stone-600 text-xs mt-0.5">{sub}</div>}
    </div>
  )
}

function PMCChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis
          dataKey="date"
          tickFormatter={d => format(new Date(d), 'dd/MM')}
          tick={{ fill: '#6E6C69', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval={13}
        />
        <YAxis tick={{ fill: '#6E6C69', fontSize: 10 }} axisLine={false} tickLine={false} />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
        <Tooltip
          contentStyle={{ background: '#141312', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }}
          labelFormatter={d => format(new Date(d), 'dd MMM', { locale: fr })}
        />
        <Line dataKey="ctl" stroke="#60A5FA" strokeWidth={2} dot={false} name="CTL (fitness)" />
        <Line dataKey="atl" stroke="#F87171" strokeWidth={2} dot={false} name="ATL (fatigue)" />
        <Line dataKey="tsb" stroke="#FF6B35" strokeWidth={2} dot={false} name="TSB (forme)" />
      </LineChart>
    </ResponsiveContainer>
  )
}

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

function ActivityRow({ activity, userFtp }: { activity: ActivityType; userFtp: number | null }) {
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
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="skeleton h-8 w-48 rounded-xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 skeleton h-64 rounded-2xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    </div>
  )
}
