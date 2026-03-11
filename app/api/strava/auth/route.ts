import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getStravaAuthUrl } from '@/lib/strava'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const url = getStravaAuthUrl(session.user.id)
  return NextResponse.redirect(url)
}
