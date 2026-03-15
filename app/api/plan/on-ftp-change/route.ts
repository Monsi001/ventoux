import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { readjustAfterChange } from '@/lib/claude'
import type { TrainingWeek } from '@/types'

// Called when user updates their FTP — readjusts the active plan
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { newFtp } = await req.json()
  if (!newFtp) return NextResponse.json({ error: 'newFtp requis' }, { status: 400 })

  // Find active plan
  const plan = await prisma.trainingPlan.findFirst({
    where: { userId: session.user.id, isActive: true },
    orderBy: { generatedAt: 'desc' },
  })

  if (!plan) return NextResponse.json({ ok: true, message: 'Aucun plan actif' })

  const weeks = plan.weeks as unknown as TrainingWeek[]
  const phases = plan.phases as any[]
  const currentPhase = phases?.length > 0 ? phases[phases.length - 1]?.type || 'BUILD' : 'BUILD'

  try {
    const { weeks: adjustedWeeks, explanation } = await readjustAfterChange({
      weeks,
      changedSessionId: '__ftp_change__',
      changeDescription: `FTP mise à jour à ${newFtp}W. Ajuste les intensités et TSS cibles de toutes les séances en conséquence.`,
      userFtp: newFtp,
      phase: currentPhase,
    })

    await prisma.trainingPlan.update({
      where: { id: plan.id },
      data: { weeks: adjustedWeeks as any },
    })

    return NextResponse.json({ ok: true, explanation, weeks: adjustedWeeks })
  } catch (e) {
    console.error('FTP readjust error:', e)
    return NextResponse.json({ ok: true, message: 'Readjust échoué, plan inchangé' })
  }
}
