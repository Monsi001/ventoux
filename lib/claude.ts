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
  strengthPerWeek?: number  // nombre de séances renfo par semaine (défaut: 1, max: 3)
}

export async function generateTrainingPlan(input: GeneratePlanInput): Promise<{
  weeks: TrainingWeek[]
  phases: TrainingPhase[]
  aiNotes: string
}> {
  const { user, race, recentActivities, constraints, currentCTL = 40, currentATL = 40, startDate, strengthPerWeek = 1 } = input

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

  // 4 semaines à générer = semaine courante + 3 suivantes
  const NUM_WEEKS = Math.min(4, weeksRemaining)
  const weekStarts = Array.from({ length: NUM_WEEKS }, (_, i) => ({
    num: currentWeekNumber + i,
    start: format(addWeeks(currentMonday, i), 'yyyy-MM-dd'),
  }))
  const weeksListStr = weekStarts.map(w => `S${w.num} (début ${w.start})`).join(', ')

  // Semaines avec test FTP (toutes les 2 semaines en partant de S2)
  const ftpTestWeeks = weekStarts
    .filter(w => w.num % 2 === 0)
    .map(w => `S${w.num}`)
  const ftpTestStr = ftpTestWeeks.length > 0
    ? `OBLIGATOIRE: En semaine${ftpTestWeeks.length > 1 ? 's' : ''} ${ftpTestWeeks.join(' et ')}, une des 3 séances vélo DOIT être un test FTP: type THRESHOLD, name "Test FTP", description "TEST FTP: échauffement 15min, 20min all-out, récup 10min", duration 50, tssTarget 70, intensityZone 4. Planifier en début de semaine (MAR ou MER).`
    : ''

  const prompt = `Entraîneur cycliste. Profil: ${user.weight || '?'}kg, FTP ${user.ftp || '?'}W${user.ftp && user.weight ? ` (${(user.ftp / user.weight).toFixed(1)}W/kg)` : ''}, CTL ${currentCTL}, ATL ${currentATL}.
Course: ${race.name}, ${format(raceDate, 'dd/MM/yyyy')}, ${race.distance}km, ${race.elevation}m D+.
Plan total: ${totalWeeks} semaines (début ${format(planStart, 'dd/MM/yyyy')}). On est en semaine ${currentWeekNumber}/${totalWeeks}, il reste ${weeksRemaining} semaines.
Volume récent: ~${weeklyHours}h/sem. Activités récentes: ${activitySummary || 'aucune'}.
Adapte la phase et l'intensité au fait qu'on est en semaine ${currentWeekNumber} du plan. Assure une progression de charge cohérente sur les 4 semaines (3 semaines montée + 1 semaine récup si pertinent).
Génère TOUTES les phases (du début à la fin du plan) et les séances des ${NUM_WEEKS} SEMAINES suivantes: ${weeksListStr}. CHAQUE semaine: 3 séances vélo indoor + ${strengthPerWeek} séance(s) STRENGTH + 1 sortie longue weekend = ${3 + strengthPerWeek + 1} séances total.${strengthPerWeek === 0 ? ' PAS de séance STRENGTH.' : ''}
RÉPARTITION SEMAINE/WEEKEND:
- SEMAINE (LUN-VEN): 3 séances vélo indoor (home trainer)${strengthPerWeek > 0 ? ` + ${strengthPerWeek} séance(s) STRENGTH` : ''}. Toutes indoor=true. Répartition vélo: 1 intensité (THRESHOLD/VO2MAX/SWEET_SPOT), 1 endurance/tempo (ENDURANCE/TEMPO), 1 récup ou endurance courte (RECOVERY/ENDURANCE).${strengthPerWeek > 0 ? ` Les séances STRENGTH peuvent être le même jour qu'une séance vélo (seul doublé autorisé).` : ''}
- WEEKEND (SAM ou DIM): 1 sortie longue EXTÉRIEURE (indoor=false). Type LONG_RIDE ou ENDURANCE. Durée plus longue (2h-4h selon la phase). C'est LA séance de volume de la semaine. Description: terrain/parcours adapté (cols, vallonné, plat selon l'objectif).
JAMAIS 2 séances vélo le même jour (seul combo autorisé: 1 vélo + 1 STRENGTH). Descriptions vélo: 5 mots max.${strengthPerWeek > 0 ? ' STRENGTH: exercices détaillés (nom, séries x reps, repos).' : ''}
Types vélo: ENDURANCE, TEMPO, THRESHOLD, VO2MAX, SWEET_SPOT, RECOVERY, LONG_RIDE, RACE_SIM.
${ftpTestStr}
JSON compact, format EXACT:
{"phases":[{"name":"Base","type":"BASE","startWeek":1,"endWeek":4,"description":"...","weeklyHoursTarget":8}],"weeks":[{"weekNumber":${weekStarts[0].num},"weekStart":"${weekStarts[0].start}","phase":"BUILD","totalHours":6,"totalTss":300,"notes":"...","sessions":[{"id":"w${weekStarts[0].num}-s1","day":"TUE","type":"THRESHOLD","name":"Seuil","duration":60,"description":"2x20min au seuil","tssTarget":75,"intensityZone":4,"indoor":true},${strengthPerWeek > 0 ? `{"id":"w${weekStarts[0].num}-s2","day":"WED","type":"STRENGTH","name":"Renfo jambes","duration":40,"description":"Squats 4x12, Fentes 3x10/j (60s repos), Gainage planche 3x45s, Pont fessier 3x20, Extensions lombaires 3x15","tssTarget":0,"intensityZone":1,"indoor":true},` : ''}{"id":"w${weekStarts[0].num}-s3","day":"THU","type":"ENDURANCE","name":"Z2","duration":75,"description":"Z2 cadence haute","tssTarget":55,"intensityZone":2,"indoor":true},{"id":"w${weekStarts[0].num}-s4","day":"SAT","type":"LONG_RIDE","name":"Sortie longue","duration":180,"description":"Sortie vallonnée cols","tssTarget":150,"intensityZone":2,"indoor":false}]}],"aiNotes":"..."}`

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 16000,
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

    const parsed = JSON.parse(cleaned)

    // Valider la structure minimale
    if (!parsed.weeks || !parsed.phases) {
      throw new Error('Structure du plan invalide')
    }

    // Associer les workouts MyWhoosh aux séances vélo indoor
    let enrichedWeeks
    try {
      enrichedWeeks = await Promise.all(
        parsed.weeks.map(async (week: TrainingWeek) => ({
          ...week,
          sessions: await matchWorkoutsToSessions(week.sessions),
        }))
      )
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
- Les séances en semaine (LUN-VEN) sont sur home trainer (indoor: true). La séance du weekend (SAM/DIM) est une sortie longue extérieure (indoor: false).
- Si la météo est mauvaise pour la sortie weekend, convertis-la en séance indoor (indoor: true) avec un type adapté (ENDURANCE ou SWEET_SPOT longue durée). Le système associera automatiquement un workout MyWhoosh adapté.
- Pour les séances STRENGTH, détaille les exercices (nom, séries, répétitions, repos)
- Conserve le type et l'intensityZone appropriés pour chaque séance vélo

Réponds UNIQUEMENT avec un JSON valide :
{
  "adjustedWeek": { ... même structure que TrainingWeek, chaque session a un champ "indoor": true/false ... },
  "explanation": "2-3 phrases expliquant les ajustements effectués"
}`

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 16000,
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
Règles: 3 séances vélo indoor en semaine + 1 STRENGTH + 1 sortie longue extérieure le weekend. JAMAIS 2 séances vélo le même jour (seul combo autorisé: 1 vélo + 1 STRENGTH). Séances LUN-VEN = indoor: true, weekend = indoor: false (sauf si converti pour météo). Pas 2 intenses consécutives, repos min 1j après VO2MAX/THRESHOLD. STRENGTH: exercices détaillés (nom, séries x reps, repos). Si aucun ajustement nécessaire, renvoie les semaines telles quelles.
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

// ─── Coach chat — ajustement en langage naturel ─────────────────────────────

interface CoachChatInput {
  message: string
  weeks: TrainingWeek[]
  userFtp: number
  phase: string
  todayDay: string  // MON, TUE, etc.
}

export async function coachChat(input: CoachChatInput): Promise<{
  weeks: TrainingWeek[]
  reply: string
}> {
  const { message, weeks, userFtp, phase, todayDay } = input

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

  const prompt = `Tu es un coach cycliste bienveillant et pragmatique. L'athlète te parle via un chat rapide.
FTP: ${userFtp}W. Phase: ${phase}. Aujourd'hui: ${todayDay}.

L'athlète dit: "${message}"

Adapte le plan de la semaine en conséquence. Exemples:
- "je suis malade" → passe les séances restantes en RECOVERY ou REST, réduis durée/TSS
- "pas le temps aujourd'hui" → supprime ou raccourcit la séance du jour (${todayDay}), redistribue si pertinent
- "je me sens en forme" → augmente légèrement l'intensité ou la durée des prochaines séances
- "j'ai mal aux genoux" → adapte le renfo, évite les impacts, favorise le vélo doux
- "je peux rajouter une séance" → ajoute une séance adaptée à la phase

Règles:
- JAMAIS 2 séances vélo le même jour (seul combo autorisé: 1 vélo + 1 STRENGTH)
- Séances semaine (LUN-VEN) = indoor (home trainer). Weekend (SAM/DIM) = sortie longue extérieure (indoor: false), sauf si météo/dispo mauvaise → passer en indoor: true
- Garde les mêmes id et jours (day) pour les séances existantes
- Tu peux changer type, durée, tssTarget, intensityZone, description, indoor
- Tu peux mettre une séance en REST (durée 0, tss 0) pour l'annuler
- STRENGTH: exercices détaillés si modifiés
- Réponds en français, ton amical et encourageant

Semaines actuelles:
${JSON.stringify(weeksSummary)}

JSON EXACT: {"weeks":[même structure],"reply":"ta réponse courte au coach (2-3 phrases max, encourageant)"}`

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    messages: [
      { role: 'user', content: prompt },
      { role: 'assistant', content: '{' },
    ],
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Réponse Claude inattendue')

  const rawText = '{' + content.text
  const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const result = JSON.parse(cleaned)

  if (!result.weeks) throw new Error('Structure invalide')

  // Valider : préserver les jours originaux
  const validatedWeeks = result.weeks.map((adjustedWeek: TrainingWeek, wIdx: number) => {
    const originalWeek = weeks[wIdx]
    if (!originalWeek) return adjustedWeek

    const validatedSessions = originalWeek.sessions.map(originalSession => {
      const adjusted = adjustedWeek.sessions?.find((s: TrainingSession) => s.id === originalSession.id)
      if (!adjusted) return originalSession

      return {
        ...originalSession,
        type: adjusted.type || originalSession.type,
        name: adjusted.name || originalSession.name,
        duration: adjusted.duration ?? originalSession.duration,
        tssTarget: adjusted.tssTarget ?? originalSession.tssTarget,
        intensityZone: adjusted.intensityZone ?? originalSession.intensityZone,
        description: adjusted.description || originalSession.description,
      }
    })

    return { ...originalWeek, sessions: validatedSessions }
  })

  const enrichedWeeks = await Promise.all(
    validatedWeeks.map(async (week: TrainingWeek) => ({
      ...week,
      sessions: await matchWorkoutsToSessions(week.sessions),
    }))
  )

  return { weeks: enrichedWeeks, reply: result.reply || '' }
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
