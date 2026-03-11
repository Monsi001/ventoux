import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { startOfWeek } from 'date-fns'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const constraints = await prisma.weeklyConstraint.findMany({
    where: { userId: session.user.id },
    orderBy: { weekStart: 'asc' },
  })

  return NextResponse.json(constraints)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { weekStart, availableDays, maxHours, notes } = await req.json()

  // Normaliser au lundi de la semaine
  const monday = startOfWeek(new Date(weekStart), { weekStartsOn: 1 })

  const constraint = await prisma.weeklyConstraint.upsert({
    where: {
      userId_weekStart: {
        userId: session.user.id,
        weekStart: monday,
      },
    },
    update: { availableDays, maxHours: maxHours || null, notes: notes || null },
    create: {
      userId: session.user.id,
      weekStart: monday,
      availableDays: availableDays || {
        mon: true, tue: true, wed: true,
        thu: true, fri: true, sat: true, sun: true,
      },
      maxHours: maxHours || null,
      notes: notes || null,
    },
  })

  return NextResponse.json(constraint)
}
