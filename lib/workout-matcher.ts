import { prisma } from '@/lib/db'
import type { TrainingSession, SessionType, MywhooshWorkout } from '@/types'

// Mapping SessionType → MyWhoosh categories (par priorité)
const SESSION_TO_CATEGORIES: Record<string, string[]> = {
  ENDURANCE:    ['Endurance', 'Beginner'],
  TEMPO:        ['Tempo', 'Endurance'],
  THRESHOLD:    ['Threshold', 'Sweetspot'],
  VO2MAX:       ['VO2max', 'Anaerobic'],
  SWEET_SPOT:   ['Sweetspot', 'Tempo', 'Threshold'],
  RECOVERY:     ['Beginner', 'Endurance', 'Taper'],
  LONG_RIDE:    ['Endurance', 'Tempo'],
  RACE_SIM:     ['Threshold', 'VO2max', 'Tempo'],
  VIRTUAL_RIDE: ['Endurance', 'Tempo', 'Sweetspot', 'Threshold'],
}

// Sessions non-vélo → pas de matching MyWhoosh
const NO_MATCH_TYPES: SessionType[] = ['STRENGTH', 'REST']

interface MatchResult {
  workout: MywhooshWorkout
  score: number
  reasons: string[]
}

interface MatchCriteria {
  sessionType: SessionType
  durationMinutes: number
  tssTarget?: number
  intensityZone?: number
  indoor: boolean
}

/**
 * Trouve le meilleur workout MyWhoosh pour une séance donnée
 */
export async function findBestWorkout(criteria: MatchCriteria): Promise<MatchResult | null> {
  if (NO_MATCH_TYPES.includes(criteria.sessionType)) return null

  const categories = SESSION_TO_CATEGORIES[criteria.sessionType]
  if (!categories) return null

  const targetDuration = criteria.durationMinutes * 60 // convert to seconds
  const durationMargin = targetDuration * 0.3 // ±30%

  // Fetch candidates from matching categories within duration range
  const candidates = await prisma.mywhooshWorkout.findMany({
    where: {
      categoryName: { in: categories },
      duration: {
        gte: Math.max(600, targetDuration - durationMargin), // min 10 minutes
        lte: targetDuration + durationMargin,
      },
    },
  })

  if (candidates.length === 0) {
    // Fallback: broader search with wider duration margin
    const fallback = await prisma.mywhooshWorkout.findMany({
      where: {
        categoryName: { in: categories },
        duration: {
          gte: 600,
          lte: targetDuration * 2,
        },
      },
      take: 20,
    })
    if (fallback.length === 0) return null
    return scoreAndRank(fallback as unknown as MywhooshWorkout[], criteria)[0] || null
  }

  const ranked = scoreAndRank(candidates as unknown as MywhooshWorkout[], criteria)
  return ranked[0] || null
}

/**
 * Score et classe les workouts candidats
 */
function scoreAndRank(candidates: MywhooshWorkout[], criteria: MatchCriteria): MatchResult[] {
  const targetDuration = criteria.durationMinutes * 60

  return candidates
    .map(workout => {
      let score = 100
      const reasons: string[] = []

      // 1. Duration proximity (40% weight)
      const durationDiff = Math.abs(workout.duration - targetDuration) / targetDuration
      const durationScore = Math.max(0, 40 * (1 - durationDiff))
      score = durationScore
      if (durationDiff < 0.1) reasons.push('Durée quasi identique')

      // 2. Category priority (25% weight) — first category in list = best match
      const categories = SESSION_TO_CATEGORIES[criteria.sessionType] || []
      const catIndex = categories.indexOf(workout.categoryName)
      const catScore = catIndex >= 0 ? 25 * (1 - catIndex * 0.3) : 0
      score += catScore
      if (catIndex === 0) reasons.push(`Catégorie parfaite: ${workout.categoryName}`)

      // 3. TSS proximity (20% weight)
      if (criteria.tssTarget && workout.tss) {
        const tssDiff = Math.abs(workout.tss - criteria.tssTarget) / criteria.tssTarget
        const tssScore = Math.max(0, 20 * (1 - tssDiff))
        score += tssScore
        if (tssDiff < 0.15) reasons.push('TSS très proche')
      } else {
        score += 10 // neutral if no TSS data
      }

      // 4. Intensity zone match via IF (15% weight)
      if (criteria.intensityZone && workout.intensityFactor) {
        const zoneIF = zoneToIF(criteria.intensityZone)
        const ifDiff = Math.abs(workout.intensityFactor - zoneIF)
        const ifScore = Math.max(0, 15 * (1 - ifDiff * 3))
        score += ifScore
        if (ifDiff < 0.1) reasons.push('Intensité alignée')
      } else {
        score += 7.5
      }

      return { workout, score, reasons }
    })
    .sort((a, b) => b.score - a.score)
}

/**
 * Convertit une zone de puissance en IF approximatif
 */
function zoneToIF(zone: number): number {
  const mapping: Record<number, number> = {
    1: 0.45,  // Recovery
    2: 0.60,  // Endurance
    3: 0.78,  // Tempo
    4: 0.90,  // Threshold
    5: 1.05,  // VO2max
    6: 1.20,  // Anaerobic
    7: 1.50,  // Neuromuscular
  }
  return mapping[zone] || 0.70
}

/**
 * Associe les meilleurs workouts MyWhoosh à toutes les séances d'un plan
 */
export async function matchWorkoutsToSessions(
  sessions: TrainingSession[],
  indoor: boolean = true
): Promise<TrainingSession[]> {
  const matched = await Promise.all(
    sessions.map(async (session) => {
      // Skip non-cycling sessions and explicitly outdoor sessions
      if (NO_MATCH_TYPES.includes(session.type)) return session
      if (session.indoor === false) return session

      const result = await findBestWorkout({
        sessionType: session.type,
        durationMinutes: session.duration,
        tssTarget: session.tssTarget,
        intensityZone: session.intensityZone,
        indoor: session.indoor ?? indoor,
      })

      if (result) {
        return {
          ...session,
          mywhooshWorkoutId: result.workout.id,
          mywhooshWorkoutName: result.workout.name,
          indoor: session.indoor ?? true,
        }
      }

      return session
    })
  )

  return matched
}

/**
 * Retourne les top N workouts pour un type de session donné
 */
export async function getWorkoutSuggestions(
  sessionType: SessionType,
  durationMinutes: number,
  tssTarget?: number,
  limit: number = 5
): Promise<MatchResult[]> {
  if (NO_MATCH_TYPES.includes(sessionType)) return []

  const categories = SESSION_TO_CATEGORIES[sessionType]
  if (!categories) return []

  const targetDuration = durationMinutes * 60

  const candidates = await prisma.mywhooshWorkout.findMany({
    where: {
      categoryName: { in: categories },
      duration: {
        gte: Math.max(600, targetDuration * 0.5),
        lte: targetDuration * 1.5,
      },
    },
  })

  const ranked = scoreAndRank(candidates as unknown as MywhooshWorkout[], {
    sessionType,
    durationMinutes,
    tssTarget,
    indoor: true,
  })

  return ranked.slice(0, limit)
}
