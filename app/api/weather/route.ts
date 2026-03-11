import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getWeatherForecast, TRAINING_LOCATIONS } from '@/lib/weather'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const location = searchParams.get('location') || 'ventoux_bedoin'
  const lat = searchParams.get('lat')
  const lon = searchParams.get('lon')

  let coords: { lat: number; lon: number; label: string }

  if (lat && lon) {
    coords = { lat: parseFloat(lat), lon: parseFloat(lon), label: 'Position personnalisée' }
  } else if (TRAINING_LOCATIONS[location]) {
    coords = TRAINING_LOCATIONS[location]
  } else {
    coords = TRAINING_LOCATIONS['ventoux_bedoin']
  }

  const forecast = await getWeatherForecast(coords.lat, coords.lon, coords.label)
  return NextResponse.json({ forecast, location: coords.label })
}
