import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ verified: true })

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { emailVerified: true },
  })

  // Ne pas révéler si l'email existe — renvoyer verified:true si pas trouvé
  return NextResponse.json({ verified: user?.emailVerified ?? true })
}
