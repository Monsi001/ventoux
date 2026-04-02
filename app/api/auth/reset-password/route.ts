import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json()

    if (!token || !password) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Mot de passe trop court (8 caractères min.)' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { resetToken: token },
    })

    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      return NextResponse.json({ error: 'Lien expiré ou invalide' }, { status: 400 })
    }

    const hashed = await bcrypt.hash(password, 12)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        resetToken: null,
        resetTokenExpiry: null,
        emailVerified: true, // Si l'utilisateur reset via email, on considère l'email vérifié
      },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Reset password error:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
