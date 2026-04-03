import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (me?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const fromUserId = 'cmnhoxtxq0001oa01yrpsmpv6'
  const toUserId = session.user.id

  // Transfer activities
  const activities = await prisma.activity.updateMany({
    where: { userId: fromUserId },
    data: { userId: toUserId },
  })

  // Transfer any races, plans, etc.
  const races = await prisma.race.updateMany({
    where: { userId: fromUserId },
    data: { userId: toUserId },
  })

  // Delete the old user
  await prisma.user.delete({ where: { id: fromUserId } })

  return NextResponse.json({
    transferred: { activities: activities.count, races: races.count },
    deletedUser: fromUserId,
  })
}
