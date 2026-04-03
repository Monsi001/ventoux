import { getToken } from 'next-auth/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
  // Routes publiques qui n'ont pas besoin d'auth
  const publicPaths = ['/api/auth', '/api/strava/webhook']
  const isPublic = publicPaths.some(p => req.nextUrl.pathname.startsWith(p))
  if (isPublic) return NextResponse.next()

  // Vérifier le token JWT
  const token = await getToken({ req })
  if (!token) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
