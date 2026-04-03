import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { calculateTSS, calculateIF, calculateNP } from '@/lib/training'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50') || 50, 1), 100)
  const offset = Math.max(parseInt(searchParams.get('offset') || '0') || 0, 0)
  const type = searchParams.get('type')

  const activities = await prisma.activity.findMany({
    where: {
      userId: session.user.id,
      ...(type ? { type: type as any } : {}),
    },
    orderBy: { date: 'desc' },
    take: limit,
    skip: offset,
    select: {
      id: true, userId: true, source: true, stravaId: true, type: true,
      name: true, date: true, duration: true, distance: true, elevation: true,
      avgPower: true, maxPower: true, avgHr: true, maxHr: true, avgSpeed: true,
      tss: true, normalizedPower: true, intensityFactor: true, calories: true,
      notes: true, createdAt: true,
    },
  })

  return NextResponse.json(activities)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { ftp: true },
  })

  const data = await req.json()

  // Calcul TSS si on a la puissance et le FTP
  let tss = data.tss
  if (!tss && data.normalizedPower && user?.ftp) {
    const if_ = calculateIF(data.normalizedPower, user.ftp)
    tss = calculateTSS(data.duration, data.normalizedPower, user.ftp)
  }

  const activity = await prisma.activity.create({
    data: {
      userId: session.user.id,
      source: data.source || 'MANUAL',
      type: data.type,
      name: data.name,
      date: new Date(data.date),
      duration: parseInt(data.duration),
      distance: data.distance ? parseFloat(data.distance) : null,
      elevation: data.elevation ? parseInt(data.elevation) : null,
      avgPower: data.avgPower ? parseInt(data.avgPower) : null,
      maxPower: data.maxPower ? parseInt(data.maxPower) : null,
      avgHr: data.avgHr ? parseInt(data.avgHr) : null,
      maxHr: data.maxHr ? parseInt(data.maxHr) : null,
      avgSpeed: data.avgSpeed ? parseFloat(data.avgSpeed) : null,
      tss: tss ? parseFloat(tss) : null,
      normalizedPower: data.normalizedPower ? parseInt(data.normalizedPower) : null,
      intensityFactor: data.intensityFactor ? parseFloat(data.intensityFactor) : null,
      calories: data.calories ? parseInt(data.calories) : null,
      notes: data.notes || null,
    },
  })

  return NextResponse.json(activity)
}
