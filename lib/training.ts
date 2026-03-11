/**
 * Calculs de charge d'entraînement cyclisme
 * TSS, NP, IF, CTL (fitness), ATL (fatigue), TSB (forme)
 */

// ─── Zones de puissance (% FTP) ───────────────────────────────────────────────

export const POWER_ZONES = {
  1: { name: 'Récupération active', min: 0,   max: 55,  label: 'Z1' },
  2: { name: 'Endurance',           min: 55,  max: 75,  label: 'Z2' },
  3: { name: 'Tempo',               min: 75,  max: 90,  label: 'Z3' },
  4: { name: 'Seuil lactique',      min: 90,  max: 105, label: 'Z4' },
  5: { name: 'VO2Max',              min: 105, max: 120, label: 'Z5' },
  6: { name: 'Anaérobique',         min: 120, max: 150, label: 'Z6' },
  7: { name: 'Neuromusculaire',     min: 150, max: 999, label: 'Z7' },
} as const

export function getPowerZone(watts: number, ftp: number): number {
  const pct = (watts / ftp) * 100
  for (const [zone, { min, max }] of Object.entries(POWER_ZONES)) {
    if (pct >= min && pct < max) return Number(zone)
  }
  return 7
}

export function getPowerZoneBounds(zone: number, ftp: number) {
  const z = POWER_ZONES[zone as keyof typeof POWER_ZONES]
  return {
    min: Math.round((z.min / 100) * ftp),
    max: z.max === 999 ? null : Math.round((z.max / 100) * ftp),
    label: z.name,
  }
}

// ─── Normalized Power (NP) ───────────────────────────────────────────────────

export function calculateNP(powerData: number[], intervalSeconds = 1): number {
  if (powerData.length === 0) return 0

  // 1. Lissage 30 secondes
  const windowSize = 30 / intervalSeconds
  const smoothed: number[] = []

  for (let i = 0; i < powerData.length; i++) {
    const start = Math.max(0, i - windowSize + 1)
    const window = powerData.slice(start, i + 1)
    smoothed.push(window.reduce((a, b) => a + b, 0) / window.length)
  }

  // 2. Élever à la 4e puissance, moyenner, racine 4e
  const fourthPowerAvg = smoothed.reduce((sum, p) => sum + Math.pow(p, 4), 0) / smoothed.length
  return Math.round(Math.pow(fourthPowerAvg, 0.25))
}

// ─── Intensity Factor (IF) ───────────────────────────────────────────────────

export function calculateIF(np: number, ftp: number): number {
  return Math.round((np / ftp) * 100) / 100
}

// ─── Training Stress Score (TSS) ─────────────────────────────────────────────

export function calculateTSS(
  durationSeconds: number,
  np: number,
  ftp: number
): number {
  const if_ = calculateIF(np, ftp)
  const tss = ((durationSeconds * np * if_) / (ftp * 3600)) * 100
  return Math.round(tss)
}

/**
 * Calcul TSS depuis fréquence cardiaque (si pas de puissance)
 * Utilise la méthode Banister TRIMP simplifiée
 */
export function calculateHRTSS(
  durationSeconds: number,
  avgHr: number,
  restingHr: number,
  maxHr: number
): number {
  const hrReserve = (avgHr - restingHr) / (maxHr - restingHr)
  const trimp = (durationSeconds / 3600) * hrReserve * 0.64 * Math.exp(1.92 * hrReserve)
  // Normaliser par rapport à 100 TSS/h à seuil (~hrR 0.77)
  return Math.round(trimp * 100 / 0.35)
}

// ─── CTL / ATL / TSB (PMC - Performance Management Chart) ───────────────────

const CTL_DECAY = Math.exp(-1 / 42) // constante 42 jours
const ATL_DECAY = Math.exp(-1 / 7)  // constante 7 jours

export interface PMCPoint {
  date: string
  tss: number
  ctl: number   // Chronic Training Load = fitness
  atl: number   // Acute Training Load = fatigue
  tsb: number   // Training Stress Balance = forme (CTL - ATL)
}

export function calculatePMC(
  activities: Array<{ date: string; tss: number }>,
  days = 90
): PMCPoint[] {
  // Créer une map TSS par date
  const tssMap: Record<string, number> = {}
  for (const a of activities) {
    const day = a.date.split('T')[0]
    tssMap[day] = (tssMap[day] || 0) + a.tss
  }

  const result: PMCPoint[] = []
  let ctl = 0
  let atl = 0

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  for (let i = 0; i <= days; i++) {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    const tss = tssMap[dateStr] || 0

    ctl = ctl * CTL_DECAY + tss * (1 - CTL_DECAY)
    atl = atl * ATL_DECAY + tss * (1 - ATL_DECAY)
    const tsb = ctl - atl

    result.push({
      date: dateStr,
      tss,
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round(tsb * 10) / 10,
    })
  }

  return result
}

// ─── Estimations W/kg et vitesse Ventoux ─────────────────────────────────────

/**
 * Estimation du temps sur le Mont Ventoux depuis Bédoin (21.4km, 1617m D+)
 * Basé sur la formule de puissance cyclisme
 */
export function estimateVentouxTime(weightKg: number, ftp: number): {
  timeMinutes: number
  wPerKg: number
  category: string
} {
  const wPerKg = ftp / weightKg
  
  // Facteur réaliste : ~75% FTP sur 90+ minutes (sweet spot en course)
  const raceWatts = ftp * 0.78
  const totalWeightKg = weightKg + 8 // vélo ~8kg

  // Puissance nécessaire sur Ventoux (approx)
  // P = (m * g * v * sin(θ)) + résistances
  // θ moyen = atan(1617 / 21400) ≈ 4.3°
  const g = 9.81
  const gradient = 1617 / 21400
  const Cr = 0.004  // résistance roulement
  const Cd = 0.9    // traînée aéro (position route)
  const rho = 0.9   // densité air à ~1000m alt moy
  const A = 0.45    // surface frontale

  // Résoudre v depuis P = m*g*Cr*v + m*g*gradient*v + 0.5*Cd*A*rho*v³
  // Itération numérique
  let v = 5 // m/s initial
  for (let iter = 0; iter < 1000; iter++) {
    const pCalc =
      totalWeightKg * g * Cr * v +
      totalWeightKg * g * gradient * v +
      0.5 * Cd * A * rho * v * v * v
    const diff = raceWatts - pCalc
    v += diff * 0.001
    if (Math.abs(diff) < 0.01) break
  }

  const distanceM = 21400
  const timeSeconds = distanceM / v
  const timeMinutes = Math.round(timeSeconds / 60)

  let category = 'Randonneur'
  if (wPerKg >= 5.0) category = 'Élite'
  else if (wPerKg >= 4.2) category = 'Expert'
  else if (wPerKg >= 3.5) category = 'Confirmé'
  else if (wPerKg >= 2.8) category = 'Intermédiaire'

  return { timeMinutes, wPerKg: Math.round(wPerKg * 100) / 100, category }
}

// ─── Helpers formatage ────────────────────────────────────────────────────────

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h > 0 && m > 0) return `${h}h${m.toString().padStart(2, '0')}`
  if (h > 0) return `${h}h00`
  return `${m}min`
}
