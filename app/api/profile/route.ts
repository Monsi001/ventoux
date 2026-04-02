import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, role: true, height: true, weight: true, ftp: true, homeLat: true, homeLng: true, homeCity: true, stravaId: true, createdAt: true },
  })

  if (!user) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })

  return NextResponse.json(user)
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { name, height, weight, ftp, homeLat, homeLng, homeCity } = await req.json()

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: name || undefined,
      height: height !== undefined ? parseFloat(height) : undefined,
      weight: weight !== undefined ? parseFloat(weight) : undefined,
      ftp: ftp !== undefined ? parseInt(ftp) : undefined,
      homeLat: homeLat !== undefined ? parseFloat(homeLat) : undefined,
      homeLng: homeLng !== undefined ? parseFloat(homeLng) : undefined,
      homeCity: homeCity !== undefined ? homeCity : undefined,
    },
    select: { id: true, email: true, name: true, role: true, height: true, weight: true, ftp: true, homeLat: true, homeLng: true, homeCity: true, stravaId: true, createdAt: true },
  })

  return NextResponse.json(user)
}
