import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SECTORS, findBestRoute, Sector, SectorRoute } from '@/lib/sectors'
import { getWeatherForecast, scoreCyclingWeather } from '@/lib/weather'
import { generateGPX } from '@/lib/gpx'

interface SectorSuggestion {
  sector: Sector
  route: SectorRoute
  weather: {
    temp: number
    windSpeed: number
    description: string
    icon: string
    score: number
    label: string
    reasons: string[]
  }
  gpx?: string
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const sessionType = searchParams.get('type') || 'ENDURANCE'
  const duration = parseInt(searchParams.get('duration') || '120')
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const withGpx = searchParams.get('gpx') === '1'

  // Find suitable sectors for this session type
  const suitableSectors = SECTORS.filter(sector =>
    sector.routes.some(r => r.suitable.includes(sessionType))
  )

  if (suitableSectors.length === 0) {
    return NextResponse.json({ suggestions: [], message: 'Aucun secteur adapté' })
  }

  // Get weather for each sector (in parallel, max 5 to avoid rate limits)
  const sectorsToCheck = suitableSectors.slice(0, 5)
  const weatherPromises = sectorsToCheck.map(sector =>
    getWeatherForecast(sector.lat, sector.lng, sector.name)
      .catch(() => [])
  )

  const weatherResults = await Promise.all(weatherPromises)

  // Score each sector
  const suggestions: SectorSuggestion[] = []

  for (let i = 0; i < sectorsToCheck.length; i++) {
    const sector = sectorsToCheck[i]
    const forecasts = weatherResults[i]
    const dayForecast = forecasts.find(f => f.date === date) || forecasts[0]

    if (!dayForecast) continue

    const route = findBestRoute(sector, sessionType, duration)
    if (!route) continue

    const weatherScore = scoreCyclingWeather(dayForecast, sector.windExposure)

    suggestions.push({
      sector,
      route,
      weather: {
        temp: dayForecast.temp,
        windSpeed: dayForecast.windSpeed,
        description: dayForecast.description,
        icon: dayForecast.icon,
        score: weatherScore.score,
        label: weatherScore.label,
        reasons: weatherScore.reasons,
      },
    })
  }

  // Sort by weather score
  suggestions.sort((a, b) => b.weather.score - a.weather.score)

  // Add GPX to top suggestion if requested
  if (withGpx && suggestions.length > 0) {
    suggestions[0].gpx = generateGPX(suggestions[0].route, suggestions[0].sector.name, date)
  }

  return NextResponse.json({
    suggestions,
    date,
    sessionType,
  })
}

// Generate GPX for a specific sector/route
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { sectorId, routeIndex, date } = await req.json()

  const sector = SECTORS.find(s => s.id === sectorId)
  if (!sector) return NextResponse.json({ error: 'Secteur non trouvé' }, { status: 404 })

  const route = sector.routes[routeIndex || 0]
  if (!route) return NextResponse.json({ error: 'Route non trouvée' }, { status: 404 })

  const gpx = generateGPX(route, sector.name, date)

  return new NextResponse(gpx, {
    headers: {
      'Content-Type': 'application/gpx+xml',
      'Content-Disposition': `attachment; filename="${route.name.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüÿç\s-]/g, '')}.gpx"`,
    },
  })
}
