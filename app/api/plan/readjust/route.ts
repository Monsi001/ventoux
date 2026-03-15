import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { readjustAfterChange } from '@/lib/claude'
import type { TrainingWeek } from '@/types'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { planId, changedSessionId, changeDescription } = await req.json()

  if (!planId || !changedSessionId || !changeDescription) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  const [plan, user] = await Promise.all([
    prisma.trainingPlan.findFirst({
      where: { id: planId, userId: session.user.id },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { ftp: true },
    }),
  ])

  if (!plan) return NextResponse.json({ error: 'Plan non trouvé' }, { status: 404 })

  const weeks = plan.weeks as unknown as TrainingWeek[]
  const phases = plan.phases as any[]

  // Trouver la phase actuelle
  const currentPhase = phases?.length > 0
    ? phases[phases.length - 1]?.type || 'BUILD'
    : 'BUILD'

  try {
    const { weeks: adjustedWeeks, explanation } = await readjustAfterChange({
      weeks,
      changedSessionId,
      changeDescription,
      userFtp: user?.ftp || 200,
      phase: currentPhase,
    })

    // Sauvegarder les semaines réajustées
    await prisma.trainingPlan.update({
      where: { id: planId },
      data: { weeks: adjustedWeeks as any },
    })

    return NextResponse.json({ weeks: adjustedWeeks, explanation })
  } catch (e) {
    console.error('Readjust error:', e)
    return NextResponse.json(
      { error: 'Erreur de réajustement: ' + (e as Error).message },
      { status: 500 }
    )
  }
}
