// GPX file generator for Garmin devices
// Generates route files with waypoints — Garmin calculates the road routing

import { SectorRoute } from './sectors'

export function generateGPX(route: SectorRoute, sectorName: string, date?: string): string {
  const timestamp = date ? new Date(date).toISOString() : new Date().toISOString()

  const rtePts = route.waypoints
    .map(([lat, lng], i) => {
      const isStart = i === 0
      const isEnd = i === route.waypoints.length - 1
      const name = isStart ? 'Départ' : isEnd ? 'Arrivée' : `Point ${i}`
      return `      <rtept lat="${lat}" lon="${lng}">
        <name>${name}</name>
        <sym>${isStart ? 'Flag, Green' : isEnd ? 'Flag, Red' : 'Waypoint'}</sym>
      </rtept>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd"
     version="1.1"
     creator="Ventoux Training">
  <metadata>
    <name>${escapeXml(route.name)}</name>
    <desc>${escapeXml(route.description)} — ${sectorName}. ${route.distance}km, ${route.elevation}m D+.</desc>
    <time>${timestamp}</time>
    <author>
      <name>Ventoux Training</name>
    </author>
  </metadata>
  <rte>
    <name>${escapeXml(route.name)}</name>
    <desc>${escapeXml(route.description)}</desc>
    <type>Cycling</type>
${rtePts}
  </rte>
</gpx>`
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
