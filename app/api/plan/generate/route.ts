import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generateTrainingPlan } from '@/lib/claude'
import type { UserProfile, Race, Activity, WeeklyConstraint } from '@/types'
import { calculatePMC } from '@/lib/training'
import { subDays, startOfWeek } from 'date-fns'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { raceId, startDate, strengthPerWeek = 1 } = await req.json()

  if (!raceId) {
    return NextResponse.json({ error: 'raceId obligatoire' }, { status: 400 })
  }

  // Date de début du plan (lundi de la semaine choisie, ou lundi courant)
  const planStart = startDate
    ? startOfWeek(new Date(startDate), { weekStartsOn: 1 })
    : startOfWeek(new Date(), { weekStartsOn: 1 })

  // Récupérer les données nécessaires
  const [user, race, recentActivities, pmcActivities, constraints] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, height: true, weight: true, ftp: true, stravaId: true, createdAt: true },
    }),
    prisma.race.findFirst({
      where: { id: raceId, userId: session.user.id },
    }),
    // Activités récentes depuis la date de début du plan (pour voir ce qui a été fait)
    prisma.activity.findMany({
      where: {
        userId: session.user.id,
        date: { gte: subDays(planStart, 60) },
      },
      orderBy: { date: 'desc' },
      take: 40,
    }),
    // Activités pour le calcul PMC/CTL/ATL (90 jours)
    prisma.activity.findMany({
      where: {
        userId: session.user.id,
        date: { gte: subDays(new Date(), 90) },
        tss: { not: null },
      },
      orderBy: { date: 'desc' },
      select: { date: true, tss: true },
    }),
    prisma.weeklyConstraint.findMany({
      where: {
        userId: session.user.id,
        weekStart: { gte: planStart },
      },
      orderBy: { weekStart: 'asc' },
      take: 12,
    }),
  ])

  if (!user || !race) {
    return NextResponse.json({ error: 'Utilisateur ou course introuvable' }, { status: 404 })
  }

  // Calculer CTL/ATL actuels (sur 90 jours)
  const activitiesForPMC = pmcActivities
    .map(a => ({ date: a.date.toISOString(), tss: a.tss! }))

  const pmc = calculatePMC(activitiesForPMC, 60)
  const latestPMC = pmc[pmc.length - 1]

  try {
    // Sérialiser les dates Prisma (Date) en string ISO pour le passage à Claude
    const userInput = { ...user, createdAt: user.createdAt.toISOString() } as unknown as UserProfile
    const raceInput = { ...race, date: race.date.toISOString(), createdAt: race.createdAt.toISOString(), updatedAt: race.updatedAt.toISOString() } as unknown as Race
    const activitiesInput = recentActivities.map(a => ({ ...a, date: a.date.toISOString(), createdAt: a.createdAt.toISOString() })) as unknown as Activity[]
    const constraintsInput = constraints.map(c => ({ ...c, weekStart: c.weekStart.toISOString(), createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() })) as unknown as WeeklyConstraint[]

    const { weeks, phases, aiNotes } = await generateTrainingPlan({
      user: userInput,
      race: raceInput,
      recentActivities: activitiesInput,
      constraints: constraintsInput,
      currentCTL: latestPMC?.ctl,
      currentATL: latestPMC?.atl,
      startDate: planStart.toISOString(),
      strengthPerWeek: Math.min(3, Math.max(0, Number(strengthPerWeek) || 1)),
    })

    // Désactiver les anciens plans pour cette course
    await prisma.trainingPlan.updateMany({
      where: { userId: session.user.id, raceId },
      data: { isActive: false },
    })

    // Sauvegarder le nouveau plan
    const plan = await prisma.trainingPlan.create({
      data: {
        userId: session.user.id,
        raceId,
        weeks: weeks as any,
        phases: phases as any,
        aiNotes,
        isActive: true,
      },
      include: { race: true },
    })

    return NextResponse.json(plan)
  } catch (e) {
    console.error('Plan generation error:', e)
    return NextResponse.json(
      { error: 'Erreur lors de la génération du plan: ' + (e as Error).message },
      { status: 500 }
    )
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const raceId = searchParams.get('raceId')

  const plans = await prisma.trainingPlan.findMany({
    where: {
      userId: session.user.id,
      ...(raceId ? { raceId } : {}),
      isActive: true,
    },
    include: { race: true },
    orderBy: { generatedAt: 'desc' },
  })

  return NextResponse.json(plans)
}
