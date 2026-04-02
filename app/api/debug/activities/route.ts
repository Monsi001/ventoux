import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, role: true, stravaId: true },
  })

  const count = await prisma.activity.count({
    where: { userId: session.user.id },
  })

  const allCounts = await prisma.activity.groupBy({
    by: ['userId'],
    _count: true,
  })

  return NextResponse.json({ currentUser: user, myActivities: count, allUserCounts: allCounts })
}
