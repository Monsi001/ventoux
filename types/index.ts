// Types partagés dans toute l'application

export interface UserProfile {
  id: string
  email: string
  name: string
  role: 'USER' | 'ADMIN'
  height: number | null   // cm
  weight: number | null   // kg
  ftp: number | null      // watts
  homeLat: number | null
  homeLng: number | null
  homeCity: string | null
  stravaId: string | null
  createdAt: string
}

export interface Race {
  id: string
  userId: string
  name: string
  date: string
  distance: number        // km
  elevation: number       // m D+
  location: string | null
  targetLevel: RaceTargetLevel
  notes: string | null
  isActive: boolean
  createdAt: string
}

export type RaceTargetLevel = 'FINISH' | 'TOP_25' | 'TOP_10' | 'PODIUM'

// ─── Plan d'entraînement ──────────────────────────────────────────────────────

export interface TrainingPlan {
  id: string
  userId: string
  raceId: string
  race: Race
  generatedAt: string
  weeks: TrainingWeek[]
  phases: TrainingPhase[]
  aiNotes: string | null
  isActive: boolean
}

export interface TrainingPhase {
  name: string
  type: 'BASE' | 'BUILD' | 'PEAK' | 'TAPER' | 'RECOVERY'
  startWeek: number   // numéro de semaine (1-indexed depuis aujourd'hui)
  endWeek: number
  description: string
  weeklyHoursTarget: number
}

export interface TrainingWeek {
  weekNumber: number     // 1 = semaine courante
  weekStart: string      // ISO date (lundi)
  phase: string
  totalHours: number
  totalTss: number
  sessions: TrainingSession[]
  notes: string
}

export interface TrainingSession {
  id: string
  day: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'
  type: SessionType
  name: string
  duration: number      // minutes
  description: string
  tssTarget: number
  intensityZone: PowerZone
  completed?: boolean
  activityId?: string   // lié à une Activity si réalisée
  mywhooshWorkoutId?: string    // référence au workout MyWhoosh sélectionné
  mywhooshWorkoutName?: string  // nom du workout MyWhoosh pour affichage
  indoor?: boolean              // true = home trainer / MyWhoosh
}

export type SessionType =
  | 'ENDURANCE'
  | 'TEMPO'
  | 'THRESHOLD'
  | 'VO2MAX'
  | 'SWEET_SPOT'
  | 'RECOVERY'
  | 'LONG_RIDE'
  | 'RACE_SIM'
  | 'STRENGTH'
  | 'REST'
  | 'VIRTUAL_RIDE'

export type PowerZone = 1 | 2 | 3 | 4 | 5 | 6 | 7

// ─── Activités ───────────────────────────────────────────────────────────────

export interface Activity {
  id: string
  userId: string
  source: 'STRAVA' | 'MYWHOOSH' | 'MANUAL'
  stravaId: string | null
  type: 'RIDE' | 'VIRTUAL_RIDE' | 'RUN' | 'STRENGTH' | 'HIKE' | 'OTHER'
  name: string
  date: string
  duration: number       // secondes
  distance: number | null  // km
  elevation: number | null // m D+
  avgPower: number | null  // watts
  maxPower: number | null
  avgHr: number | null     // bpm
  maxHr: number | null
  avgSpeed: number | null  // km/h
  tss: number | null
  commute: boolean
  normalizedPower: number | null
  intensityFactor: number | null
  calories: number | null
  notes: string | null
  createdAt: string
}

// ─── Contraintes semaine ──────────────────────────────────────────────────────

export interface WeeklyConstraint {
  id: string
  userId: string
  weekStart: string
  availableDays: {
    mon: boolean
    tue: boolean
    wed: boolean
    thu: boolean
    fri: boolean
    sat: boolean
    sun: boolean
  }
  maxHours: number | null
  notes: string | null
}

// ─── Météo ────────────────────────────────────────────────────────────────────

export interface WeatherForecast {
  date: string
  location: string
  temp: number           // °C
  feelsLike: number
  windSpeed: number      // km/h
  windGust: number
  precipitation: number  // mm
  description: string
  icon: string
  suitable: boolean      // calculé côté serveur
}

// ─── Métriques de forme ───────────────────────────────────────────────────────

export interface FitnessMetrics {
  date: string
  ctl: number   // Chronic Training Load (fitness)
  atl: number   // Acute Training Load (fatigue)
  tsb: number   // Training Stress Balance (forme = CTL - ATL)
  tss: number   // TSS du jour
}

// ─── Strava ───────────────────────────────────────────────────────────────────

// ─── MyWhoosh Workouts ───────────────────────────────────────────────────────

export interface MywhooshWorkout {
  id: string
  mywhooshId: number
  name: string
  description: string | null
  categoryId: number
  categoryName: string
  duration: number      // seconds
  tss: number | null
  intensityFactor: number | null
  kj: number | null
  stepCount: number
  steps: MywhooshStep[]
  authorName: string | null
  isRecovery: boolean
}

export interface MywhooshStep {
  ID: number
  StepType: 'E_WarmUp' | 'E_Normal' | 'E_FreeRide' | 'E_CoolDown'
  Power: number          // FTP multiplier (0.5 = 50% FTP)
  StartPower: number     // for ramps
  EndPower: number       // for ramps
  Time: number           // seconds
  Rpm: number            // cadence target (0 = free)
  IntervalId: number
  WorkoutMessage: Array<{
    ID: number
    Time: number
    Message: string
  }>
}

// ─── Strava ───────────────────────────────────────────────────────────────────

export interface StravaActivity {
  id: number
  name: string
  type: string
  sport_type: string
  start_date: string
  elapsed_time: number
  moving_time: number
  distance: number
  total_elevation_gain: number
  average_speed: number
  average_watts?: number
  max_watts?: number
  average_heartrate?: number
  max_heartrate?: number
  weighted_average_watts?: number
  commute?: boolean
  suffer_score?: number
  calories?: number
  map?: {
    summary_polyline: string
  }
}
