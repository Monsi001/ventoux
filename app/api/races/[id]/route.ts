import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params

  const race = await prisma.race.findFirst({
    where: { id, userId: session.user.id },
  })

  if (!race) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })
  return NextResponse.json(race)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params
  const data = await req.json()

  const race = await prisma.race.updateMany({
    where: { id, userId: session.user.id },
    data: {
      name: data.name,
      date: data.date ? new Date(data.date) : undefined,
      distance: data.distance ? parseFloat(data.distance) : undefined,
      elevation: data.elevation ? parseInt(data.elevation) : undefined,
      location: data.location,
      targetLevel: data.targetLevel,
      notes: data.notes,
      isActive: data.isActive,
    },
  })

  return NextResponse.json({ updated: race.count > 0 })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params

  await prisma.race.deleteMany({
    where: { id, userId: session.user.id },
  })

  return NextResponse.json({ deleted: true })
}
