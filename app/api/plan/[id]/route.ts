import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// DELETE /api/plan/[id] — Supprimer un plan
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params

  await prisma.trainingPlan.deleteMany({
    where: { id, userId: session.user.id },
  })

  return NextResponse.json({ ok: true })
}
