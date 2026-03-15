import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// PATCH /api/plan/update-session — Modifier une session (changer de jour, etc.)
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { planId, weekIndex, sessionId, updates } = await req.json()

  const plan = await prisma.trainingPlan.findFirst({
    where: { id: planId, userId: session.user.id },
  })

  if (!plan) return NextResponse.json({ error: 'Plan non trouvé' }, { status: 404 })

  const weeks = plan.weeks as any[]
  if (!weeks[weekIndex]) return NextResponse.json({ error: 'Semaine non trouvée' }, { status: 404 })

  // Trouver et mettre à jour la session
  const weekSessions = weeks[weekIndex].sessions as any[]
  const sessionIdx = weekSessions.findIndex((s: any) => s.id === sessionId)
  if (sessionIdx === -1) return NextResponse.json({ error: 'Session non trouvée' }, { status: 404 })

  // Appliquer les modifications (day, etc.)
  weeks[weekIndex].sessions[sessionIdx] = {
    ...weeks[weekIndex].sessions[sessionIdx],
    ...updates,
  }

  await prisma.trainingPlan.update({
    where: { id: planId },
    data: { weeks: weeks as any },
  })

  return NextResponse.json({ ok: true })
}
