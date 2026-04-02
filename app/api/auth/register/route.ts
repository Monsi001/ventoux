import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { sendVerificationEmail, generateToken } from '@/lib/email'

export async function POST(req: Request) {
  try {
    const { name, email, password, height, weight, ftp } = await req.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Mot de passe trop court (8 caractères min.)' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existing) {
      return NextResponse.json({ error: 'Email déjà utilisé' }, { status: 409 })
    }

    const hashed = await bcrypt.hash(password, 12)
    const verificationToken = generateToken()

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashed,
        verificationToken,
        height: height ? parseFloat(height) : null,
        weight: weight ? parseFloat(weight) : null,
        ftp: ftp ? parseInt(ftp) : null,
      },
    })

    // Envoyer l'email de vérification
    try {
      await sendVerificationEmail(user.email, verificationToken, user.name)
    } catch (e) {
      console.error('Email verification send error:', e)
      // Le compte est créé, on ne bloque pas si l'email échoue
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      needsVerification: true,
    })
  } catch (e) {
    console.error('Register error:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
