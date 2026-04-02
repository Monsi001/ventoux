import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { exchangeStravaCode, getAllStravaActivities, stravaToActivity } from '@/lib/strava'
import { calculateTSS, calculateIF } from '@/lib/training'
import { subDays } from 'date-fns'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // userId
  const error = searchParams.get('error')

  if (error || !code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/profile?strava=error&reason=${error || 'missing_params'}`
    )
  }

  try {
    const tokens = await exchangeStravaCode(code)
    const stravaId = String(tokens.athlete.id)

    // Détacher ce compte Strava s'il est déjà lié à un autre user
    await prisma.user.updateMany({
      where: { stravaId, id: { not: state } },
      data: { stravaId: null, stravaToken: null, stravaRefresh: null, stravaExpiry: null },
    })

    // Sauvegarder tokens Strava
    const user = await prisma.user.update({
      where: { id: state },
      data: {
        stravaId,
        stravaToken: tokens.access_token,
        stravaRefresh: tokens.refresh_token,
        stravaExpiry: new Date(tokens.expires_at * 1000),
      },
    })

    // Import initial des activités des 3 derniers mois
    const activities = await getAllStravaActivities(
      tokens.access_token,
      subDays(new Date(), 90)
    )

    const ftpUser = await prisma.user.findUnique({
      where: { id: state },
      select: { ftp: true },
    })

    // Insérer en base (ignorer les doublons)
    for (const sa of activities) {
      const mapped = stravaToActivity(sa, state)

      // Calcul TSS
      let tss: number | null = null
      if (mapped.normalizedPower && ftpUser?.ftp) {
        tss = calculateTSS(mapped.duration, mapped.normalizedPower, ftpUser.ftp)
      } else if (mapped.avgPower && ftpUser?.ftp) {
        tss = calculateTSS(mapped.duration, mapped.avgPower, ftpUser.ftp)
      }

      try {
        await prisma.activity.upsert({
          where: { stravaId: mapped.stravaId! },
          update: {},  // Ne pas écraser si déjà importé
          create: { ...mapped, tss },
        })
      } catch {
        // Ignorer erreurs de doublons
      }
    }

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/profile?strava=connected&imported=${activities.length}`
    )
  } catch (e) {
    console.error('Strava callback error:', e)
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/profile?strava=error&reason=exchange_failed`
    )
  }
}
