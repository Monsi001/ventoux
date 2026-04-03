/**
 * Parseurs de fichiers d'entraînement
 * GPX (Strava, Garmin export) et FIT (Garmin, MyWhoosh)
 */

// ─── GPX Parser ───────────────────────────────────────────────────────────────

export interface ParsedActivity {
  name?: string
  date?: Date
  duration: number        // secondes
  distance: number        // km
  elevation: number       // m D+
  avgSpeed?: number       // km/h
  maxSpeed?: number       // km/h
  avgHr?: number          // bpm
  maxHr?: number
  avgPower?: number       // watts
  maxPower?: number
  normalizedPower?: number
  powerData?: number[]    // données secondes par secondes
  hrData?: number[]
}

export async function parseGPX(gpxContent: string): Promise<ParsedActivity> {
  const { parseString } = await import('xml2js')
  
  return new Promise((resolve, reject) => {
    parseString(gpxContent, { explicitArray: true }, (err, result) => {
      if (err) return reject(new Error('GPX invalide: ' + err.message))

      try {
        const gpx = result.gpx
        const track = gpx?.trk?.[0]
        const name = track?.name?.[0] || gpx?.metadata?.[0]?.name?.[0] || 'Activité'
        const segments = track?.trkseg || []

        let totalDistance = 0
        let totalElevGain = 0
        interface GPXPoint { lat: number; lon: number; ele: number; time: Date | null; hr: number; power: number }
        let allPoints: GPXPoint[] = []
        const hrValues: number[] = []
        const powerValues: number[] = []

        for (const seg of segments) {
          const points = seg.trkpt || []
          
          for (let i = 0; i < points.length; i++) {
            const pt = points[i]
            const lat = parseFloat(pt.$.lat)
            const lon = parseFloat(pt.$.lon)
            const ele = parseFloat(pt.ele?.[0] || '0')
            const time = pt.time?.[0] ? new Date(pt.time[0]) : null

            // HR et puissance (extensions Garmin)
            const ext = pt.extensions?.[0]
            const tpx = ext?.['gpxtpx:TrackPointExtension']?.[0] || ext?.TrackPointExtension?.[0]
            const hr = parseInt(tpx?.['gpxtpx:hr']?.[0] || tpx?.hr?.[0] || '0')
            const power = parseInt(tpx?.['gpxtpx:power']?.[0] || tpx?.power?.[0] || '0')

            if (hr > 0) hrValues.push(hr)
            if (power > 0) powerValues.push(power)

            if (i > 0) {
              const prev = allPoints[allPoints.length - 1]
              const dist = haversine(prev.lat, prev.lon, lat, lon)
              totalDistance += dist

              const eleDiff = ele - prev.ele
              if (eleDiff > 0) totalElevGain += eleDiff
            }

            allPoints.push({ lat, lon, ele, time, hr, power })
          }
        }

        const startTime = allPoints[0]?.time
        const endTime = allPoints[allPoints.length - 1]?.time
        const duration = startTime && endTime
          ? Math.round((endTime.getTime() - startTime.getTime()) / 1000)
          : 0

        const avgSpeed = duration > 0 ? (totalDistance / (duration / 3600)) : undefined

        // Normalised Power
        let np: number | undefined
        if (powerValues.length > 60) {
          np = calculateNPFromArray(powerValues)
        }

        resolve({
          name,
          date: startTime || undefined,
          duration,
          distance: Math.round(totalDistance * 100) / 100,
          elevation: Math.round(totalElevGain),
          avgSpeed: avgSpeed ? Math.round(avgSpeed * 10) / 10 : undefined,
          avgHr: hrValues.length > 0 ? Math.round(avg(hrValues)) : undefined,
          maxHr: hrValues.length > 0 ? Math.max(...hrValues) : undefined,
          avgPower: powerValues.length > 0 ? Math.round(avg(powerValues)) : undefined,
          maxPower: powerValues.length > 0 ? Math.max(...powerValues) : undefined,
          normalizedPower: np,
          powerData: powerValues.length > 0 ? powerValues : undefined,
          hrData: hrValues.length > 0 ? hrValues : undefined,
        })
      } catch (e) {
        reject(new Error('Erreur lors du parsing GPX: ' + (e as Error).message))
      }
    })
  })
}

// ─── FIT Parser ───────────────────────────────────────────────────────────────

export async function parseFIT(buffer: Buffer): Promise<ParsedActivity> {
  // fit-file-parser est un module CommonJS
  const FitParser = require('fit-file-parser').default || require('fit-file-parser')
  
  return new Promise((resolve, reject) => {
    const parser = new FitParser({
      force: true,
      speedUnit: 'm/s',
      lengthUnit: 'm',
      temperatureUnit: 'celsius',
      elapsedRecordField: true,
      mode: 'both',
    })

    parser.parse(buffer, (error: any, data: any) => {
      if (error) return reject(new Error('FIT invalide: ' + error))

      try {
        const session = data.activity?.sessions?.[0] || {}
        const records = data.activity?.sessions?.[0]?.laps?.flatMap((l: any) => l.records || []) || []

        const powerValues = records.map((r: any) => r.power || 0).filter((p: number) => p > 0)
        const hrValues = records.map((r: any) => r.heart_rate || 0).filter((h: number) => h > 0)

        const totalDistance = session.total_distance ? session.total_distance / 1000 : 0
        const totalElevation = session.total_ascent || 0
        const duration = session.total_elapsed_time || session.total_timer_time || 0

        const name = data.activity?.sport || 'Activité'
        const date = data.activity?.timestamp ? new Date(data.activity.timestamp) : undefined

        const np = powerValues.length > 60 ? calculateNPFromArray(powerValues) : undefined

        resolve({
          name: typeof name === 'string' ? capitalizeFirst(name) : 'Activité',
          date,
          duration: Math.round(duration),
          distance: Math.round(totalDistance * 100) / 100,
          elevation: Math.round(totalElevation),
          avgHr: hrValues.length > 0 ? Math.round(avg(hrValues)) : undefined,
          maxHr: hrValues.length > 0 ? Math.max(...hrValues) : undefined,
          avgPower: powerValues.length > 0 ? Math.round(avg(powerValues)) : undefined,
          maxPower: powerValues.length > 0 ? Math.max(...powerValues) : undefined,
          normalizedPower: np,
          avgSpeed: session.avg_speed ? Math.round(session.avg_speed * 3.6 * 10) / 10 : undefined,
          powerData: powerValues,
          hrData: hrValues,
        })
      } catch (e) {
        reject(new Error('Erreur parsing FIT: ' + (e as Error).message))
      }
    })
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function avg(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function calculateNPFromArray(power: number[]): number {
  // Fenêtre 30s
  const smoothed = power.map((_, i) => {
    const start = Math.max(0, i - 29)
    const win = power.slice(start, i + 1)
    return win.reduce((a, b) => a + b, 0) / win.length
  })
  const avg4 = smoothed.reduce((s, p) => s + p ** 4, 0) / smoothed.length
  return Math.round(avg4 ** 0.25)
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}
