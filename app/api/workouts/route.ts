import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getWorkoutSuggestions } from '@/lib/workout-matcher'
import type { SessionType } from '@/types'

// GET /api/workouts — Liste et recherche du catalogue MyWhoosh
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const search = searchParams.get('search')
  const sessionType = searchParams.get('sessionType') as SessionType | null
  const duration = searchParams.get('duration') // minutes
  const tss = searchParams.get('tss')
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20') || 20, 1), 100)
  const offset = Math.max(parseInt(searchParams.get('offset') || '0') || 0, 0)

  // Mode suggestions : trouver les meilleurs workouts pour une séance
  if (sessionType && duration) {
    const suggestions = await getWorkoutSuggestions(
      sessionType,
      parseInt(duration),
      tss ? parseInt(tss) : undefined,
      limit
    )

    return NextResponse.json({
      suggestions: suggestions.map(s => ({
        ...s.workout,
        matchScore: Math.round(s.score),
        matchReasons: s.reasons,
      })),
    })
  }

  // Mode catalogue : lister / rechercher
  const where: Record<string, unknown> = {}
  if (category) where.categoryName = category
  if (search) where.name = { contains: search, mode: 'insensitive' }

  const [workouts, total] = await Promise.all([
    prisma.mywhooshWorkout.findMany({
      where,
      select: {
        id: true,
        mywhooshId: true,
        name: true,
        description: true,
        categoryName: true,
        duration: true,
        tss: true,
        intensityFactor: true,
        stepCount: true,
        isRecovery: true,
      },
      orderBy: [{ categoryName: 'asc' }, { name: 'asc' }],
      skip: offset,
      take: limit,
    }),
    prisma.mywhooshWorkout.count({ where }),
  ])

  // Stats par catégorie
  const categories = await prisma.mywhooshWorkout.groupBy({
    by: ['categoryName'],
    _count: true,
    orderBy: { categoryName: 'asc' },
  })

  return NextResponse.json({
    workouts,
    total,
    categories: categories.map(c => ({ name: c.categoryName, count: c._count })),
  })
}
