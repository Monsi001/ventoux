import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendPasswordResetEmail, generateToken } from '@/lib/email'
import { addHours } from 'date-fns'

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    // Toujours répondre OK pour ne pas révéler si l'email existe
    if (!user) {
      return NextResponse.json({ ok: true })
    }

    const resetToken = generateToken()
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry: addHours(new Date(), 1),
      },
    })

    try {
      await sendPasswordResetEmail(user.email, resetToken, user.name)
    } catch (e) {
      console.error('Password reset email error:', e)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Forgot password error:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
