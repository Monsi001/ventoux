import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/login?error=missing_token`)
  }

  const user = await prisma.user.findUnique({
    where: { verificationToken: token },
  })

  if (!user) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/login?error=invalid_token`)
  }

  if (user.emailVerified) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/login?verified=already`)
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      verificationToken: null,
    },
  })

  return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/login?verified=true`)
}
