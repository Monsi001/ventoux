import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getAllStravaActivities, stravaToActivity, refreshStravaToken } from '@/lib/strava'
import { calculateTSS } from '@/lib/training'
import { subHours } from 'date-fns'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stravaToken: true, stravaRefresh: true, stravaExpiry: true, ftp: true },
  })

  if (!user?.stravaToken) {
    return NextResponse.json({ error: 'Strava non connecté' }, { status: 400 })
  }

  // Rafraîchir le token si expiré
  let accessToken = user.stravaToken
  if (user.stravaExpiry && user.stravaExpiry < new Date()) {
    const refreshed = await refreshStravaToken(user.stravaRefresh!)
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        stravaToken: refreshed.access_token,
        stravaRefresh: refreshed.refresh_token,
        stravaExpiry: new Date(refreshed.expires_at * 1000),
      },
    })
    accessToken = refreshed.access_token
  }

  // Récupérer uniquement les activités après la dernière en base
  // Avec 2h de marge pour capter les activités modifiées après coup sur Strava
  const lastActivity = await prisma.activity.findFirst({
    where: { userId: session.user.id, source: 'STRAVA' },
    orderBy: { date: 'desc' },
    select: { date: true },
  })

  const after = lastActivity?.date
    ? subHours(lastActivity.date, 2)
    : undefined // première sync → tout récupérer

  const activities = await getAllStravaActivities(accessToken, after)

  let created = 0
  let updated = 0
  for (const sa of activities) {
    const mapped = stravaToActivity(sa, session.user.id)

    let tss: number | null = null
    if (mapped.normalizedPower && user.ftp) {
      tss = calculateTSS(mapped.duration, mapped.normalizedPower, user.ftp)
    } else if (mapped.avgPower && user.ftp) {
      tss = calculateTSS(mapped.duration, mapped.avgPower, user.ftp)
    }

    try {
      const existing = await prisma.activity.findUnique({
        where: { stravaId: mapped.stravaId! },
        select: { id: true },
      })

      await prisma.activity.upsert({
        where: { stravaId: mapped.stravaId! },
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
        },
        create: { ...mapped, tss },
      })

      if (existing) updated++
      else created++
    } catch (err) {
      console.error(`Strava upsert failed for activity ${mapped.stravaId}:`, err)
    }
  }

  return NextResponse.json({ created, updated, total: activities.length })
}
