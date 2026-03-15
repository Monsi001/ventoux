import { WeatherForecast } from '@/types'

const OWM_BASE = 'https://api.openweathermap.org/data/2.5'

interface OWMForecastItem {
  dt: number
  main: { temp: number; feels_like: number }
  weather: Array<{ description: string; icon: string }>
  wind: { speed: number; gust?: number }
  pop: number   // probabilité précipitations 0-1
  rain?: { '3h': number }
}

export async function getWeatherForecast(
  lat: number,
  lon: number,
  locationName: string
): Promise<WeatherForecast[]> {
  const apiKey = process.env.OPENWEATHER_API_KEY
  if (!apiKey) {
    console.warn('OpenWeather API key manquante')
    return []
  }

  const res = await fetch(
    `${OWM_BASE}/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=fr&cnt=40`
  )

  if (!res.ok) {
    console.error('OpenWeather error:', res.status)
    return []
  }

  const data = await res.json()

  // Agréger par jour (prendre la valeur 12h si dispo, sinon première)
  const byDay: Record<string, OWMForecastItem> = {}

  for (const item of data.list as OWMForecastItem[]) {
    const date = new Date(item.dt * 1000)
    const dayKey = date.toISOString().split('T')[0]
    const hour = date.getHours()

    if (!byDay[dayKey] || (hour >= 10 && hour <= 14)) {
      byDay[dayKey] = item
    }
  }

  return Object.entries(byDay)
    .slice(0, 7) // 7 jours max
    .map(([date, item]) => ({
      date,
      location: locationName,
      temp: Math.round(item.main.temp),
      feelsLike: Math.round(item.main.feels_like),
      windSpeed: Math.round(item.wind.speed * 3.6), // m/s → km/h
      windGust: Math.round((item.wind.gust || item.wind.speed) * 3.6),
      precipitation: item.rain?.['3h'] || 0,
      description: item.weather[0]?.description || '',
      icon: item.weather[0]?.icon || '01d',
      suitable: isWeatherSuitableForRide(item),
    }))
}

function isWeatherSuitableForRide(item: OWMForecastItem): boolean {
  const windKmh = item.wind.speed * 3.6
  const rain = item.rain?.['3h'] || 0
  const temp = item.main.temp

  return (
    windKmh < 40 &&       // vent < 40 km/h
    rain < 2 &&           // pluie < 2mm/3h
    temp > 5 &&           // > 5°C
    item.pop < 0.7        // < 70% proba pluie
  )
}

// Coordonnées préconfigurées pour zones d'entraînement communes
export const TRAINING_LOCATIONS: Record<string, { lat: number; lon: number; label: string }> = {
  ventoux_bedoin: { lat: 44.123, lon: 5.278, label: 'Bédoin (Ventoux)' },
  ventoux_malaucene: { lat: 44.172, lon: 5.134, label: 'Malaucène (Ventoux)' },
  ventoux_sault: { lat: 44.091, lon: 5.412, label: 'Sault (Ventoux)' },
  paris: { lat: 48.866, lon: 2.333, label: 'Paris' },
  lyon: { lat: 45.748, lon: 4.847, label: 'Lyon' },
}

// ─── Scoring météo pour le cyclisme ──────────────────────────────────────────

export interface CyclingWeatherScore {
  score: number       // 0-100
  label: string       // Excellent / Bon / Moyen / Mauvais
  reasons: string[]
}

export function scoreCyclingWeather(
  forecast: WeatherForecast,
  windExposure: 'low' | 'medium' | 'high' = 'medium'
): CyclingWeatherScore {
  let score = 100
  const reasons: string[] = []

  // Pluie
  const rain = forecast.precipitation || 0
  if (rain > 5) { score -= 50; reasons.push(`Pluie forte (${rain}mm)`) }
  else if (rain > 1) { score -= 25; reasons.push(`Pluie légère (${rain}mm)`) }
  else if (rain > 0) { score -= 10; reasons.push('Risque de bruine') }

  // Vent (ajusté par exposition du secteur)
  const windMult = windExposure === 'high' ? 1.5 : windExposure === 'low' ? 0.6 : 1.0
  const effectiveWind = forecast.windSpeed * windMult
  if (effectiveWind > 50) { score -= 40; reasons.push(`Vent très fort (${forecast.windSpeed}km/h)`) }
  else if (effectiveWind > 35) { score -= 20; reasons.push(`Vent fort (${forecast.windSpeed}km/h)`) }
  else if (effectiveWind > 25) { score -= 10; reasons.push(`Vent modéré (${forecast.windSpeed}km/h)`) }

  // Température
  if (forecast.temp < 2) { score -= 30; reasons.push(`Très froid (${forecast.temp}°C)`) }
  else if (forecast.temp < 8) { score -= 15; reasons.push(`Froid (${forecast.temp}°C)`) }
  else if (forecast.temp > 38) { score -= 25; reasons.push(`Canicule (${forecast.temp}°C)`) }
  else if (forecast.temp > 33) { score -= 10; reasons.push(`Chaud (${forecast.temp}°C)`) }
  else if (forecast.temp >= 15 && forecast.temp <= 25) { reasons.push(`${forecast.temp}°C — idéal`) }

  score = Math.max(0, Math.min(100, score))
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Bon' : score >= 40 ? 'Moyen' : 'Mauvais'

  return { score, label, reasons }
}
