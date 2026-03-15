import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Single endpoint that returns all data needed for initial page loads
// Avoids multiple round-trips (profile + races + activities + plans)
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const include = searchParams.get('include')?.split(',') || ['profile', 'races', 'activities', 'plans']
  const activityLimit = parseInt(searchParams.get('activityLimit') || '60')

  const queries: Record<string, Promise<any>> = {}

  if (include.includes('profile')) {
    queries.profile = prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, height: true, weight: true, ftp: true, homeLat: true, homeLng: true, homeCity: true, stravaId: true, createdAt: true },
    })
  }

  if (include.includes('races')) {
    queries.races = prisma.race.findMany({
      where: { userId: session.user.id },
      orderBy: { date: 'asc' },
    })
  }

  if (include.includes('activities')) {
    queries.activities = prisma.activity.findMany({
      where: { userId: session.user.id },
      orderBy: { date: 'desc' },
      take: activityLimit,
    })
  }

  if (include.includes('plans')) {
    queries.plans = prisma.trainingPlan.findMany({
      where: { userId: session.user.id, isActive: true },
      include: { race: true },
      orderBy: { generatedAt: 'desc' },
    })
  }

  const keys = Object.keys(queries)
  const values = await Promise.all(Object.values(queries))

  const result: Record<string, any> = {}
  keys.forEach((k, i) => { result[k] = values[i] })

  const response = NextResponse.json(result)
  response.headers.set('Cache-Control', 'private, max-age=5, stale-while-revalidate=30')
  return response
}
