import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const races = await prisma.race.findMany({
    where: { userId: session.user.id },
    orderBy: { date: 'asc' },
  })

  return NextResponse.json(races)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { name, date, distance, elevation, location, targetLevel, notes } = await req.json()

  if (!name || !date || !distance || !elevation) {
    return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 })
  }

  const race = await prisma.race.create({
    data: {
      userId: session.user.id,
      name,
      date: new Date(date),
      distance: parseFloat(distance),
      elevation: parseInt(elevation),
      location: location || null,
      targetLevel: targetLevel || 'FINISH',
      notes: notes || null,
    },
  })

  return NextResponse.json(race)
}
