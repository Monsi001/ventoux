import Anthropic from '@anthropic-ai/sdk'
import { TrainingPlan, TrainingWeek, TrainingPhase, Activity, Race, UserProfile, WeeklyConstraint } from '@/types'
import { differenceInWeeks, format, startOfWeek, addWeeks, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'

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
}

export async function generateTrainingPlan(input: GeneratePlanInput): Promise<{
  weeks: TrainingWeek[]
  phases: TrainingPhase[]
  aiNotes: string
}> {
  const { user, race, recentActivities, constraints, currentCTL = 40, currentATL = 40 } = input

  const raceDate = new Date(race.date)
  const today = new Date()
  const weeksUntilRace = differenceInWeeks(raceDate, today)

  // Résumé des activités récentes (8 semaines)
  const activitySummary = recentActivities
    .slice(0, 30)
    .map(a => ({
      date: format(new Date(a.date), 'dd/MM', { locale: fr }),
      type: a.type,
      duration: Math.round(a.duration / 60) + 'min',
      distance: a.distance ? a.distance + 'km' : null,
      tss: a.tss,
      avgPower: a.avgPower,
      source: a.source,
    }))

  // Contraintes des prochaines semaines
  const constraintSummary = constraints.slice(0, 8).map(c => ({
    week: format(new Date(c.weekStart), 'dd/MM', { locale: fr }),
    available: Object.entries(c.availableDays)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(','),
    maxHours: c.maxHours,
    notes: c.notes,
  }))

  const prompt = `Tu es un entraîneur cycliste expert, spécialisé dans la préparation des gran fondos montagneux.

## Profil athlète
- Nom : ${user.name}
- Taille : ${user.height || '?'} cm
- Poids : ${user.weight || '?'} kg
- FTP : ${user.ftp || '?'} watts${user.ftp && user.weight ? ` (${(user.ftp / user.weight).toFixed(1)} W/kg)` : ''}
- Fitness actuel (CTL) : ${currentCTL}
- Fatigue actuelle (ATL) : ${currentATL}

## Objectif
- Course : ${race.name}
- Date : ${format(raceDate, 'EEEE d MMMM yyyy', { locale: fr })}
- Distance : ${race.distance} km
- Dénivelé : ${race.elevation} m D+
- Lieu : ${race.location || 'non précisé'}
- Objectif : ${race.targetLevel}
- Semaines disponibles : ${weeksUntilRace}

## Activités récentes (30 derniers jours)
${JSON.stringify(activitySummary, null, 2)}

## Contraintes semaines à venir
${constraintSummary.length > 0 ? JSON.stringify(constraintSummary, null, 2) : 'Aucune contrainte renseignée — supposer 3 séances/semaine disponibles'}

## Instructions
Génère un plan d'entraînement complet et détaillé pour préparer cette course.

Le plan doit :
1. Être structuré en phases (Base, Build, Peak, Taper) adaptées aux ${weeksUntilRace} semaines disponibles
2. Inclure des séances de renforcement musculaire (gainage, jambes, posture vélo) 1-2x/semaine
3. Progresser en charge de façon raisonnée (règle des 10%, semaines de récupération)
4. Intégrer des séances spécifiques col (seuil, sweet spot, Z2 long)
5. Respecter les contraintes de disponibilité
6. Distinguer sorties extérieures et séances MyWhoosh/home trainer

Réponds UNIQUEMENT avec un JSON valide dans ce format exact, sans markdown, sans commentaires :
{
  "phases": [
    {
      "name": "Phase de base",
      "type": "BASE",
      "startWeek": 1,
      "endWeek": 6,
      "description": "...",
      "weeklyHoursTarget": 8
    }
  ],
  "weeks": [
    {
      "weekNumber": 1,
      "weekStart": "2025-03-17",
      "phase": "BASE",
      "totalHours": 7.5,
      "totalTss": 280,
      "notes": "Semaine d'entrée en matière...",
      "sessions": [
        {
          "id": "w1-s1",
          "day": "TUE",
          "type": "ENDURANCE",
          "name": "Z2 fondamental",
          "duration": 90,
          "description": "Sortie endurance en Z2 strict. Fréquence cardiaque sous ${user.ftp ? Math.round(user.ftp * 0.75) : 140}W. Terrain plat.",
          "tssTarget": 65,
          "intensityZone": 2
        }
      ]
    }
  ],
  "aiNotes": "Résumé coach en 3-4 phrases sur la stratégie globale et les points d'attention particuliers pour cet athlète."
}`

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Réponse Claude inattendue')

  try {
    // Nettoyer le JSON (parfois Claude ajoute des backticks)
    const cleaned = content.text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const parsed = JSON.parse(cleaned)

    // Valider la structure minimale
    if (!parsed.weeks || !parsed.phases) {
      throw new Error('Structure du plan invalide')
    }

    return {
      weeks: parsed.weeks,
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

Réponds UNIQUEMENT avec un JSON valide :
{
  "adjustedWeek": { ... même structure que TrainingWeek ... },
  "explanation": "2-3 phrases expliquant les ajustements effectués"
}`

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Réponse Claude inattendue')

  const cleaned = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(cleaned)
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
