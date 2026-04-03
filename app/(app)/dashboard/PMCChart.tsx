'use client'
import { useState } from 'react'
import {
  ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Brush
} from 'recharts'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function PMCChart({ data, raceDate }: { data: any[]; raceDate?: string }) {
  const [range, setRange] = useState<6 | 12>(6)

  const filtered = data.slice(-range * 7)

  // Calculer le domaine serré pour mieux voir les progressions lentes
  const allValues = filtered.flatMap(d => [d.ctl, d.atl, d.tsb].filter(v => v != null))
  const minVal = Math.min(...allValues)
  const maxVal = Math.max(...allValues)
  const padding = Math.max(2, (maxVal - minVal) * 0.05)
  const yMin = Math.floor(minVal - padding)
  const yMax = Math.ceil(maxVal + padding)

  // Vérifier si la date de course est dans la plage affichée
  const raceDateInRange = raceDate && filtered.some(d => d.date === raceDate)

  return (
    <div aria-label="Graphique Performance Management Chart" role="img">
    <div className="flex items-center gap-2 mb-3">
      <button onClick={() => setRange(6)} className={`text-xs px-3 py-1 rounded-lg transition ${range === 6 ? 'bg-ventoux-500/20 text-ventoux-400' : 'text-stone-500 hover:text-stone-300'}`}>6 sem.</button>
      <button onClick={() => setRange(12)} className={`text-xs px-3 py-1 rounded-lg transition ${range === 12 ? 'bg-ventoux-500/20 text-ventoux-400' : 'text-stone-500 hover:text-stone-300'}`}>12 sem.</button>
    </div>
    <ResponsiveContainer width="100%" height={350}>
      <ComposedChart data={filtered} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis
          dataKey="date"
          tickFormatter={d => format(new Date(d), 'dd/MM')}
          tick={{ fill: '#6E6C69', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis yAxisId="left" domain={[yMin, yMax]} tick={{ fill: '#6E6C69', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="right" orientation="right" tick={{ fill: '#6E6C69', fontSize: 10 }} axisLine={false} tickLine={false} hide />
        <ReferenceLine yAxisId="left" y={0} stroke="rgba(255,255,255,0.1)" />
        {raceDateInRange && <ReferenceLine x={raceDate} yAxisId="left" stroke="#FF6B35" strokeDasharray="4 4" label={{ value: '\ud83c\udfc1', position: 'top' }} />}
        <Tooltip
          contentStyle={{ background: '#141312', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }}
          labelFormatter={d => format(new Date(d), 'dd MMM', { locale: fr })}
          formatter={(value: number, name: string) => [Math.round(value), name]}
          itemSorter={(item: any) => {
            const order: Record<string, number> = { 'CTL (fitness)': 0, 'ATL (fatigue)': 1, 'TSB (forme)': 2, 'TSS': 3 }
            return order[item.name] ?? 4
          }}
        />
        <Bar dataKey="tss" yAxisId="right" fill="rgba(255,255,255,0.08)" radius={[2, 2, 0, 0]} name="TSS" />
        <Line dataKey="ctl" yAxisId="left" stroke="#60A5FA" strokeWidth={2} dot={false} name="CTL (fitness)" />
        <Line dataKey="atl" yAxisId="left" stroke="#F87171" strokeWidth={2} dot={false} name="ATL (fatigue)" />
        <Line dataKey="tsb" yAxisId="left" stroke="#FF6B35" strokeWidth={2} dot={false} name="TSB (forme)" />
        <Brush dataKey="date" height={20} stroke="#FF6B35" fill="#141312" tickFormatter={d => format(new Date(d), 'dd/MM')} />
      </ComposedChart>
    </ResponsiveContainer>
    </div>
  )
}
