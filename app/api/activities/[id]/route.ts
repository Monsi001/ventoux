import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const tss = body.tss !== null && body.tss !== undefined ? Number(body.tss) : null
  if (tss !== null && (isNaN(tss) || tss < 0 || tss > 1000)) {
    return NextResponse.json({ error: 'TSS invalide (0-1000)' }, { status: 400 })
  }

  // Vérifier que l'activité appartient à l'utilisateur
  const existing = await prisma.activity.findFirst({ where: { id, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: 'Activité introuvable' }, { status: 404 })

  const updated = await prisma.activity.update({
    where: { id },
    data: { tss },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params

  await prisma.activity.deleteMany({
    where: { id, userId: session.user.id },
  })

  return NextResponse.json({ ok: true })
}
