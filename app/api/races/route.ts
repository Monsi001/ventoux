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

  const parsedDistance = parseFloat(distance)
  const parsedElevation = parseInt(elevation)
  if (isNaN(parsedDistance) || isNaN(parsedElevation) || parsedDistance <= 0 || parsedElevation < 0) {
    return NextResponse.json({ error: 'Distance ou dénivelé invalide' }, { status: 400 })
  }

  const parsedDate = new Date(date)
  if (isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: 'Date invalide' }, { status: 400 })
  }

  const race = await prisma.race.create({
    data: {
      userId: session.user.id,
      name,
      date: parsedDate,
      distance: parsedDistance,
      elevation: parsedElevation,
      location: location || null,
      targetLevel: targetLevel || 'FINISH',
      notes: notes || null,
    },
  })

  return NextResponse.json(race)
}
