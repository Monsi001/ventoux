import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  getStravaActivityById,
  stravaToActivity,
  refreshStravaToken,
} from '@/lib/strava'
import { calculateTSS } from '@/lib/training'

/**
 * GET /api/strava/webhook
 * Validation du webhook par Strava (hub.challenge)
 */
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode')
  const token = req.nextUrl.searchParams.get('hub.verify_token')
  const challenge = req.nextUrl.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    return NextResponse.json({ 'hub.challenge': challenge })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

/**
 * POST /api/strava/webhook
 * Réception des événements Strava (activité créée, modifiée, supprimée, déauthorisation)
 */
export async function POST(req: NextRequest) {
  const event = await req.json()

  // Répondre 200 immédiatement (Strava exige une réponse rapide)
  // Le traitement se fait en arrière-plan via waitUntil-like pattern
  // En Next.js App Router on traite directement mais on reste rapide

  if (event.object_type === 'athlete' && event.aspect_type === 'update') {
    // Déauthorisation : l'athlète a révoqué l'accès
    if (event.updates?.authorized === 'false') {
      await handleDeauthorize(String(event.owner_id))
    }
    return NextResponse.json({ ok: true })
  }

  if (event.object_type === 'activity') {
    const stravaAthleteId = String(event.owner_id)
    const stravaActivityId = String(event.object_id)

    switch (event.aspect_type) {
      case 'create':
      case 'update':
        await handleActivityCreateOrUpdate(stravaAthleteId, stravaActivityId)
        break
      case 'delete':
        await handleActivityDelete(stravaActivityId)
        break
    }
  }

  return NextResponse.json({ ok: true })
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleActivityCreateOrUpdate(stravaAthleteId: string, stravaActivityId: string) {
  // Trouver l'utilisateur par son stravaId
  const user = await prisma.user.findUnique({
    where: { stravaId: stravaAthleteId },
    select: {
      id: true,
      ftp: true,
      stravaToken: true,
      stravaRefresh: true,
      stravaExpiry: true,
    },
  })

  if (!user?.stravaToken) {
    console.error('[Strava Webhook] User not found for athlete:', stravaAthleteId)
    return
  }

  // Rafraîchir le token si expiré
  let accessToken = user.stravaToken
  if (user.stravaExpiry && user.stravaExpiry < new Date()) {
    try {
      const refreshed = await refreshStravaToken(user.stravaRefresh!)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          stravaToken: refreshed.access_token,
          stravaRefresh: refreshed.refresh_token,
          stravaExpiry: new Date(refreshed.expires_at * 1000),
        },
      })
      accessToken = refreshed.access_token
    } catch (e) {
      console.error('[Strava Webhook] Token refresh failed:', e)
      return
    }
  }

  // Récupérer l'activité depuis l'API Strava
  try {
    const stravaActivity = await getStravaActivityById(accessToken, stravaActivityId)
    const mapped = stravaToActivity(stravaActivity, user.id)

    // Calcul TSS
    let tss: number | null = null
    if (mapped.normalizedPower && user.ftp) {
      tss = calculateTSS(mapped.duration, mapped.normalizedPower, user.ftp)
    } else if (mapped.avgPower && user.ftp) {
      tss = calculateTSS(mapped.duration, mapped.avgPower, user.ftp)
    }

    await prisma.activity.upsert({
      where: { stravaId: stravaActivityId },
      update: {
        duration: mapped.duration,
        distance: mapped.distance,
        elevation: mapped.elevation,
        avgPower: mapped.avgPower,
        maxPower: mapped.maxPower,
        avgHr: mapped.avgHr,
        maxHr: mapped.maxHr,
        avgSpeed: mapped.avgSpeed,
        normalizedPower: mapped.normalizedPower,
        tss: tss ?? undefined,
        name: mapped.name,
        calories: mapped.calories,
      },
      create: { ...mapped, tss },
    })

    // Activity synced OK
  } catch (e) {
    console.error('[Strava Webhook] Activity sync failed:', stravaActivityId, e)
  }
}

async function handleActivityDelete(stravaActivityId: string) {
  try {
    await prisma.activity.deleteMany({
      where: { stravaId: stravaActivityId },
    })
    // Activity deleted OK
  } catch (e) {
    console.error('[Strava Webhook] Activity delete failed:', stravaActivityId, e)
  }
}

async function handleDeauthorize(stravaAthleteId: string) {
  try {
    await prisma.user.update({
      where: { stravaId: stravaAthleteId },
      data: {
        stravaToken: null,
        stravaRefresh: null,
        stravaExpiry: null,
      },
    })
    // Deauthorized OK
  } catch (e) {
    console.error('[Strava Webhook] Deauthorize failed:', stravaAthleteId, e)
  }
}
