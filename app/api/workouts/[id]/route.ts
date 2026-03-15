import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'

// GET /api/workouts/[id] — Détail complet d'un workout MyWhoosh (avec steps)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { id } = await params

  const workout = await prisma.mywhooshWorkout.findUnique({
    where: { id },
  })

  if (!workout) {
    return NextResponse.json({ error: 'Workout non trouvé' }, { status: 404 })
  }

  return NextResponse.json(workout)
}
