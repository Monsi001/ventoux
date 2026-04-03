import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseGPX, parseFIT } from '@/lib/parsers'
import { calculateTSS, calculateIF } from '@/lib/training'
import { ActivitySource, ActivityType } from '@prisma/client'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { ftp: true },
  })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const source = (formData.get('source') as string) || 'MANUAL'
  const activityType = (formData.get('type') as string) || 'RIDE'

  if (!file) {
    return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
  }

  const fileName = file.name.toLowerCase()
  const buffer = Buffer.from(await file.arrayBuffer())

  let parsed
  try {
    if (fileName.endsWith('.gpx')) {
      parsed = await parseGPX(buffer.toString('utf-8'))
    } else if (fileName.endsWith('.fit')) {
      parsed = await parseFIT(buffer)
    } else {
      return NextResponse.json({ error: 'Format non supporté (GPX ou FIT uniquement)' }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: 'Fichier invalide: ' + (e as Error).message }, { status: 400 })
  }

  // Calcul TSS
  let tss: number | null = null
  if (parsed.normalizedPower && user?.ftp) {
    tss = calculateTSS(parsed.duration, parsed.normalizedPower, user.ftp)
  } else if (parsed.avgPower && user?.ftp) {
    tss = calculateTSS(parsed.duration, parsed.avgPower, user.ftp)
  }

  const intensityFactor =
    parsed.normalizedPower && user?.ftp
      ? calculateIF(parsed.normalizedPower, user.ftp)
      : null

  const activity = await prisma.activity.create({
    data: {
      userId: session.user.id,
      source: source as ActivitySource,
      type: activityType as ActivityType,
      name: parsed.name || file.name.replace(/\.(gpx|fit)$/i, ''),
      date: parsed.date || new Date(),
      duration: parsed.duration,
      distance: parsed.distance,
      elevation: parsed.elevation,
      avgPower: parsed.avgPower || null,
      maxPower: parsed.maxPower || null,
      avgHr: parsed.avgHr || null,
      maxHr: parsed.maxHr || null,
      avgSpeed: parsed.avgSpeed || null,
      tss,
      normalizedPower: parsed.normalizedPower || null,
      intensityFactor,
      gpxData: fileName.endsWith('.gpx') ? buffer.toString('utf-8') : null,
      fitData: fileName.endsWith('.fit') ? buffer : null,
    },
  })

  return NextResponse.json(activity)
}
