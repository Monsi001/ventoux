import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      stravaId: null,
      stravaToken: null,
      stravaRefresh: null,
      stravaExpiry: null,
    },
  })

  return NextResponse.json({ ok: true })
}
