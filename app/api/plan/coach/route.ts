import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { coachChat } from '@/lib/claude'
import { rateLimit } from '@/lib/rate-limit'

const MAX_MESSAGES = 30
const MAX_AGE_DAYS = 10

async function pruneOldMessages(planId: string) {
  const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000)

  await prisma.coachMessage.deleteMany({
    where: { planId, createdAt: { lt: cutoff } },
  })

  const kept = await prisma.coachMessage.findMany({
    where: { planId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
    skip: MAX_MESSAGES,
  })
  if (kept.length > 0) {
    await prisma.coachMessage.deleteMany({
      where: { id: { in: kept.map(m => m.id) } },
    })
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const planId = searchParams.get('planId')
  if (!planId) return NextResponse.json({ error: 'planId requis' }, { status: 400 })

  const plan = await prisma.trainingPlan.findFirst({
    where: { id: planId, userId: session.user.id },
    select: { id: true },
  })
  if (!plan) return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 })

  const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000)

  const messages = await prisma.coachMessage.findMany({
    where: { planId, createdAt: { gte: cutoff } },
    orderBy: { createdAt: 'desc' },
    take: MAX_MESSAGES,
    select: { id: true, role: true, text: true, createdAt: true },
  })

  return NextResponse.json({ messages: messages.reverse() })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { success } = rateLimit(`chat:${session.user.id}`, 10, 60_000)
  if (!success) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })

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

  // Persister le message utilisateur avant l'appel Claude
  const userMsg = await prisma.coachMessage.create({
    data: {
      userId: session.user.id,
      planId,
      role: 'USER',
      text: message,
    },
    select: { id: true, role: true, text: true, createdAt: true },
  })

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

    const coachMsg = await prisma.coachMessage.create({
      data: {
        userId: session.user.id,
        planId,
        role: 'COACH',
        text: reply,
        weeksSnapshot: weeks as any, // état AVANT l'ajustement, pour revert
      },
      select: { id: true, role: true, text: true, createdAt: true },
    })

    await pruneOldMessages(planId)

    return NextResponse.json({
      weeks: updatedWeeks,
      reply,
      userMessage: userMsg,
      coachMessage: coachMsg,
    })
  } catch (e) {
    console.error('Coach chat error:', e)
    return NextResponse.json({ error: 'Erreur du coach: ' + (e as Error).message }, { status: 500 })
  }
}
