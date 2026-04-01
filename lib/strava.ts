import { StravaActivity } from '@/types'

const STRAVA_API = 'https://www.strava.com/api/v3'
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token'

export function getStravaAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/strava/callback`,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read_all',
    state: userId, // on passe l'userId pour retrouver l'user au retour
  })
  return `https://www.strava.com/oauth/authorize?${params}`
}

export async function exchangeStravaCode(code: string): Promise<{
  access_token: string
  refresh_token: string
  expires_at: number
  athlete: { id: number; firstname: string; lastname: string }
}> {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Strava auth error: ${err}`)
  }

  return res.json()
}

export async function refreshStravaToken(refreshToken: string): Promise<{
  access_token: string
  refresh_token: string
  expires_at: number
}> {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) throw new Error('Impossible de rafraîchir le token Strava')
  return res.json()
}

export async function getStravaActivities(
  accessToken: string,
  after?: number, // timestamp Unix
  page = 1,
  perPage = 50
): Promise<StravaActivity[]> {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  })
  if (after) params.set('after', String(after))

  const res = await fetch(`${STRAVA_API}/athlete/activities?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) throw new Error(`Strava API error: ${res.status}`)
  return res.json()
}

/**
 * Récupère toutes les activités depuis une date (pagination auto)
 */
export async function getAllStravaActivities(
  accessToken: string,
  afterDate?: Date
): Promise<StravaActivity[]> {
  const after = afterDate ? Math.floor(afterDate.getTime() / 1000) : undefined
  const all: StravaActivity[] = []
  let page = 1

  while (true) {
    const batch = await getStravaActivities(accessToken, after, page, 100)
    if (batch.length === 0) break
    all.push(...batch)
    if (batch.length < 100) break
    page++
  }

  return all
}

/**
 * Récupère une activité Strava par son ID
 */
export async function getStravaActivityById(
  accessToken: string,
  activityId: string | number
): Promise<StravaActivity> {
  const res = await fetch(`${STRAVA_API}/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Strava API error: ${res.status}`)
  return res.json()
}

/**
 * Convertit une activité Strava vers notre format Activity
 */
export function stravaToActivity(s: StravaActivity, userId: string) {
  const type = mapStravaType(s.type || s.sport_type)

  return {
    userId,
    source: 'STRAVA' as const,
    stravaId: String(s.id),
    type,
    name: s.name,
    date: new Date(s.start_date),
    duration: s.moving_time,
    distance: s.distance ? s.distance / 1000 : null,     // m → km
    elevation: s.total_elevation_gain ? Math.round(s.total_elevation_gain) : null,
    avgPower: s.average_watts ? Math.round(s.average_watts) : null,
    maxPower: s.max_watts ? Math.round(s.max_watts) : null,
    avgHr: s.average_heartrate ? Math.round(s.average_heartrate) : null,
    maxHr: s.max_heartrate ? Math.round(s.max_heartrate) : null,
    avgSpeed: s.average_speed ? Math.round(s.average_speed * 3.6 * 10) / 10 : null, // m/s → km/h
    normalizedPower: s.weighted_average_watts ? Math.round(s.weighted_average_watts) : null,
    calories: s.calories || null,
  }
}

function mapStravaType(type: string) {
  const map: Record<string, string> = {
    Ride: 'RIDE',
    VirtualRide: 'VIRTUAL_RIDE',
    MountainBikeRide: 'RIDE',
    GravelRide: 'RIDE',
    Run: 'RUN',
    Hike: 'HIKE',
    WeightTraining: 'STRENGTH',
    Workout: 'STRENGTH',
  }
  return (map[type] || 'OTHER') as any
}
