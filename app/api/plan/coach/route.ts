import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { coachChat } from '@/lib/claude'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { planId, message } = await req.json()

  if (!planId || !message) {
    return NextResponse.json({ error: 'planId et message requis' }, { status: 400 })
  }

  const plan = await prisma.trainingPlan.findFirst({
    where: { id: planId, userId: session.user.id },
  })

  if (!plan) {
    return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { ftp: true },
  })

  const weeks = plan.weeks as any[]
  const now = new Date()
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const todayDay = dayNames[now.getDay()]

  // Trouver la semaine courante et la suivante
  const currentWeekIdx = weeks.findIndex(w => {
    const ws = new Date(w.weekStart)
    const we = new Date(ws)
    we.setDate(we.getDate() + 7)
    return now >= ws && now < we
  })

  const relevantWeeks = currentWeekIdx >= 0
    ? weeks.slice(currentWeekIdx, currentWeekIdx + 2)
    : weeks.slice(0, 2)

  const phase = relevantWeeks[0]?.phase || 'BUILD'

  try {
    const { weeks: adjustedWeeks, reply } = await coachChat({
      message,
      weeks: relevantWeeks,
      userFtp: user?.ftp || 200,
      phase,
      todayDay,
    })

    // Mettre à jour les semaines dans le plan
    const updatedWeeks = [...weeks]
    const startIdx = currentWeekIdx >= 0 ? currentWeekIdx : 0
    adjustedWeeks.forEach((w, i) => {
      if (updatedWeeks[startIdx + i]) {
        updatedWeeks[startIdx + i] = w
      }
    })

    await prisma.trainingPlan.update({
      where: { id: planId },
      data: { weeks: updatedWeeks as any },
    })

    return NextResponse.json({ weeks: updatedWeeks, reply })
  } catch (e) {
    console.error('Coach chat error:', e)
    return NextResponse.json({ error: 'Erreur du coach: ' + (e as Error).message }, { status: 500 })
  }
}
