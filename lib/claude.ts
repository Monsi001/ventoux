import Anthropic from '@anthropic-ai/sdk'
import { TrainingPlan, TrainingWeek, TrainingPhase, TrainingSession, Activity, Race, UserProfile, WeeklyConstraint } from '@/types'
import { differenceInWeeks, format, startOfWeek, addWeeks, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { matchWorkoutsToSessions } from '@/lib/workout-matcher'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface GeneratePlanInput {
  user: UserProfile
  race: Race
  recentActivities: Activity[]
  constraints: WeeklyConstraint[]
  currentCTL?: number
  currentATL?: number
  startDate?: string  // ISO date — début du plan (permet d'antidater)
}

export async function generateTrainingPlan(input: GeneratePlanInput): Promise<{
  weeks: TrainingWeek[]
  phases: TrainingPhase[]
  aiNotes: string
}> {
  const { user, race, recentActivities, constraints, currentCTL = 40, currentATL = 40, startDate } = input

  const raceDate = new Date(race.date)
  const now = new Date()
  const planStart = startDate ? new Date(startDate) : startOfWeek(now, { weekStartsOn: 1 })
  const currentMonday = startOfWeek(now, { weekStartsOn: 1 })
  const totalWeeks = differenceInWeeks(raceDate, planStart)
  const weeksElapsed = differenceInWeeks(currentMonday, planStart)
  const weeksRemaining = differenceInWeeks(raceDate, currentMonday)
  const currentWeekNumber = weeksElapsed + 1

  // Activités passées depuis le début du plan
  const pastActivities = recentActivities.filter(a => new Date(a.date) <= now)

  const activitySummary = pastActivities
    .slice(0, 15)
    .map(a => `${format(new Date(a.date), 'dd/MM')}: ${a.type} ${Math.round(a.duration / 60)}min${a.tss ? ' TSS' + Math.round(a.tss) : ''}${a.avgPower ? ' ' + a.avgPower + 'W' : ''}`)
    .join('; ')

  // Volume hebdo moyen récent
  const weeklyHours = pastActivities.length > 0
    ? Math.round(pastActivities.reduce((sum, a) => sum + a.duration, 0) / 3600 / Math.max(1, Math.ceil(pastActivities.length / 3)) * 10) / 10
    : 0

  // Les 2 semaines à générer = semaine courante + semaine prochaine
  const weekStartCurrent = format(currentMonday, 'yyyy-MM-dd')
  const weekStartNext = format(addWeeks(currentMonday, 1), 'yyyy-MM-dd')

  const prompt = `Entraîneur cycliste. Profil: ${user.weight || '?'}kg, FTP ${user.ftp || '?'}W${user.ftp && user.weight ? ` (${(user.ftp / user.weight).toFixed(1)}W/kg)` : ''}, CTL ${currentCTL}, ATL ${currentATL}.
Course: ${race.name}, ${format(raceDate, 'dd/MM/yyyy')}, ${race.distance}km, ${race.elevation}m D+.
Plan total: ${totalWeeks} semaines (début ${format(planStart, 'dd/MM/yyyy')}). On est en semaine ${currentWeekNumber}/${totalWeeks}, il reste ${weeksRemaining} semaines.
Volume récent: ~${weeklyHours}h/sem. Activités récentes: ${activitySummary || 'aucune'}.
Adapte la phase et l'intensité au fait qu'on est en semaine ${currentWeekNumber} du plan.
Génère TOUTES les phases (du début à la fin du plan) et les séances de la SEMAINE COURANTE (S${currentWeekNumber}, début ${weekStartCurrent}) et la SEMAINE SUIVANTE (S${currentWeekNumber + 1}, début ${weekStartNext}). CHAQUE semaine: 2 séances vélo + 1 séance STRENGTH. JAMAIS 2 séances vélo le même jour (seul combo autorisé: 1 vélo + 1 STRENGTH). Descriptions vélo: 5 mots max. STRENGTH: exercices détaillés (nom, séries x reps, repos).
Types vélo: ENDURANCE, TEMPO, THRESHOLD, VO2MAX, SWEET_SPOT, RECOVERY, LONG_RIDE, RACE_SIM.
JSON compact, format EXACT:
{"phases":[{"name":"Base","type":"BASE","startWeek":1,"endWeek":4,"description":"...","weeklyHoursTarget":6}],"weeks":[{"weekNumber":${currentWeekNumber},"weekStart":"${weekStartCurrent}","phase":"BUILD","totalHours":5,"totalTss":200,"notes":"...","sessions":[{"id":"w${currentWeekNumber}-s1","day":"TUE","type":"ENDURANCE","name":"Z2","duration":60,"description":"Z2 strict","tssTarget":45,"intensityZone":2,"indoor":true},{"id":"w${currentWeekNumber}-s2","day":"THU","type":"STRENGTH","name":"Renfo jambes","duration":40,"description":"Squats 4x12, Fentes 3x10/j (60s repos), Gainage planche 3x45s, Pont fessier 3x20, Extensions lombaires 3x15","tssTarget":0,"intensityZone":1,"indoor":true}]}],"aiNotes":"..."}`

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    messages: [
      { role: 'user', content: prompt },
      { role: 'assistant', content: '{' },
    ],
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Réponse Claude inattendue')

  // Vérifier si la réponse a été tronquée
  if (response.stop_reason === 'max_tokens') {
    console.error('Réponse Claude tronquée (max_tokens atteint)')
    throw new Error('Le plan généré est trop long. Réessayez.')
  }

  try {
    // Reconstruire le JSON (on a préfixé avec '{')
    const rawText = '{' + content.text
    const cleaned = rawText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    console.log('Claude stop_reason:', response.stop_reason)
    console.log('Claude response length:', cleaned.length)

    const parsed = JSON.parse(cleaned)

    // Valider la structure minimale
    if (!parsed.weeks || !parsed.phases) {
      throw new Error('Structure du plan invalide')
    }

    console.log('Plan parsed OK:', parsed.weeks.length, 'weeks,', parsed.phases.length, 'phases')

    // Associer les workouts MyWhoosh aux séances vélo indoor
    let enrichedWeeks
    try {
      enrichedWeeks = await Promise.all(
        parsed.weeks.map(async (week: TrainingWeek) => ({
          ...week,
          sessions: await matchWorkoutsToSessions(week.sessions),
        }))
      )
      console.log('MyWhoosh matching OK')
    } catch (matchError) {
      console.error('MyWhoosh matching failed, using raw sessions:', matchError)
      enrichedWeeks = parsed.weeks
    }

    return {
      weeks: enrichedWeeks,
      phases: parsed.phases,
      aiNotes: parsed.aiNotes || '',
    }
  } catch (e) {
    console.error('Erreur parsing plan Claude:', e)
    console.error('Réponse brute:', content.text.substring(0, 500))
    throw new Error('Impossible de parser le plan généré par Claude')
  }
}

// ─── Ajustement hebdomadaire du plan ─────────────────────────────────────────

interface AdjustWeekInput {
  currentWeek: TrainingWeek
  completedActivities: Activity[]
  weatherForecast: Array<{ date: string; suitable: boolean; description: string }>
  constraints?: WeeklyConstraint
  userFtp: number
}

export async function adjustWeekPlan(input: AdjustWeekInput): Promise<{
  adjustedWeek: TrainingWeek
  explanation: string
}> {
  const { currentWeek, completedActivities, weatherForecast, constraints, userFtp } = input

  const prompt = `Tu es un entraîneur cycliste. Ajuste ce plan de semaine selon les données réelles.

## Plan initial
${JSON.stringify(currentWeek, null, 2)}

## Séances déjà réalisées
${JSON.stringify(completedActivities.map(a => ({
  date: a.date,
  type: a.type,
  duration: Math.round(a.duration / 60),
  tss: a.tss,
  avgPower: a.avgPower,
  name: a.name,
})), null, 2)}

## Météo de la semaine
${JSON.stringify(weatherForecast, null, 2)}

## Contraintes
${constraints ? `Jours disponibles : ${Object.entries(constraints.availableDays).filter(([,v])=>v).map(([k])=>k).join(', ')}
Max heures : ${constraints.maxHours || 'non limité'}
Notes : ${constraints.notes || 'aucune'}` : 'Aucune contrainte spécifique'}

FTP athlète : ${userFtp}W

## Règles importantes
- Si la météo est mauvaise pour une sortie extérieure, convertis-la en séance indoor (indoor: true). Le système associera automatiquement un workout MyWhoosh adapté.
- Pour les séances STRENGTH, détaille les exercices (nom, séries, répétitions, repos)
- Conserve le type et l'intensityZone appropriés pour chaque séance vélo

Réponds UNIQUEMENT avec un JSON valide :
{
  "adjustedWeek": { ... même structure que TrainingWeek, chaque session a un champ "indoor": true/false ... },
  "explanation": "2-3 phrases expliquant les ajustements effectués"
}`

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Réponse Claude inattendue')

  const cleaned = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const result = JSON.parse(cleaned)

  // Matcher les workouts MyWhoosh pour les séances indoor
  result.adjustedWeek.sessions = await matchWorkoutsToSessions(result.adjustedWeek.sessions)

  return result
}

// ─── Réajustement après modification utilisateur ─────────────────────────────

interface ReadjustInput {
  weeks: TrainingWeek[]           // les 2 semaines du plan
  changedSessionId: string        // la séance modifiée
  changeDescription: string       // ex: "déplacé de MAR à JEU" ou "passé en indoor"
  userFtp: number
  phase: string                   // phase actuelle du plan (BASE, BUILD, etc.)
}

export async function readjustAfterChange(input: ReadjustInput): Promise<{
  weeks: TrainingWeek[]
  explanation: string
}> {
  const { weeks, changedSessionId, changeDescription, userFtp, phase } = input

  // Compact session summary
  const weeksSummary = weeks.map(w => ({
    weekNumber: w.weekNumber,
    weekStart: w.weekStart,
    phase: w.phase,
    sessions: w.sessions.map(s => ({
      id: s.id, day: s.day, type: s.type, name: s.name,
      duration: s.duration, tssTarget: s.tssTarget,
      intensityZone: s.intensityZone, indoor: s.indoor,
      ...(s.type === 'STRENGTH' ? { description: s.description } : {}),
    })),
  }))

  const prompt = `Entraîneur cycliste. FTP ${userFtp}W, phase ${phase}.
L'athlète a modifié la séance "${changedSessionId}": ${changeDescription}.
Ajuste l'INTENSITÉ, la DURÉE ou le TYPE des AUTRES séances si nécessaire pour garder un plan cohérent.
INTERDIT: NE CHANGE PAS le jour (day) des séances. NE CHANGE PAS la séance "${changedSessionId}". Garde les mêmes id, mêmes jours.
Règles: JAMAIS 2 séances vélo le même jour (seul combo autorisé: 1 vélo + 1 STRENGTH). Pas 2 intenses consécutives, repos min 1j après VO2MAX/THRESHOLD. STRENGTH: exercices détaillés (nom, séries x reps, repos). Si aucun ajustement nécessaire, renvoie les semaines telles quelles.
Semaines:
${JSON.stringify(weeksSummary)}
JSON: {"weeks":[même structure, mêmes jours],"explanation":"1-2 phrases"}`

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [
      { role: 'user', content: prompt },
      { role: 'assistant', content: '{' },
    ],
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Réponse Claude inattendue')

  if (response.stop_reason === 'max_tokens') {
    throw new Error('Réponse tronquée')
  }

  const rawText = '{' + content.text
  const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const result = JSON.parse(cleaned)

  if (!result.weeks) throw new Error('Structure invalide')

  // Validation: préserver les jours originaux et empêcher les doublons
  // Claude ne doit PAS déplacer de séances, seulement ajuster contenu/intensité/durée
  const validatedWeeks = result.weeks.map((adjustedWeek: TrainingWeek, wIdx: number) => {
    const originalWeek = weeks[wIdx]
    if (!originalWeek) return adjustedWeek

    // Pour chaque session originale, garder son jour et son indoor d'origine
    // mais accepter les changements de type/durée/tss/description de Claude
    const validatedSessions = originalWeek.sessions.map(originalSession => {
      const adjusted = adjustedWeek.sessions?.find((s: TrainingSession) => s.id === originalSession.id)
      if (!adjusted) return originalSession // session disparue → garder l'originale

      // La session modifiée par l'utilisateur ne doit PAS être touchée par Claude
      if (originalSession.id === changedSessionId) return originalSession

      return {
        ...originalSession,
        // Accepter les ajustements de contenu seulement
        type: adjusted.type || originalSession.type,
        name: adjusted.name || originalSession.name,
        duration: adjusted.duration || originalSession.duration,
        tssTarget: adjusted.tssTarget ?? originalSession.tssTarget,
        intensityZone: adjusted.intensityZone ?? originalSession.intensityZone,
        description: adjusted.description || originalSession.description,
        // NE PAS changer : day, indoor, mywhooshWorkoutId, mywhooshWorkoutName
      }
    })

    return { ...originalWeek, sessions: validatedSessions }
  })

  // Re-match MyWhoosh pour les séances indoor dont le type/durée a changé
  const enrichedWeeks = await Promise.all(
    validatedWeeks.map(async (week: TrainingWeek) => ({
      ...week,
      sessions: await matchWorkoutsToSessions(week.sessions),
    }))
  )

  return { weeks: enrichedWeeks, explanation: result.explanation || '' }
}

// ─── Analyse d'activité ───────────────────────────────────────────────────────

export async function analyzeActivity(activity: Activity, userFtp: number): Promise<string> {
  const prompt = `Analyse cette séance de cyclisme en 3-4 phrases. Donne des insights sur la performance, la récupération nécessaire et comment l'intégrer dans la progression.

Séance : ${activity.name}
Type : ${activity.type}
Durée : ${Math.round(activity.duration / 60)} min
Distance : ${activity.distance || '?'} km
Puissance moyenne : ${activity.avgPower || '?'} W (FTP : ${userFtp} W — ${activity.avgPower ? Math.round(activity.avgPower / userFtp * 100) : '?'}% FTP)
TSS : ${activity.tss || '?'}
Source : ${activity.source}`

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0]
  return content.type === 'text' ? content.text : ''
}
