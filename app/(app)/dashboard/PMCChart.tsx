'use client'
import {
  ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine
} from 'recharts'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function PMCChart({ data }: { data: any[] }) {
  // Calculer le domaine serré pour mieux voir les progressions lentes
  const allValues = data.flatMap(d => [d.ctl, d.atl, d.tsb].filter(v => v != null))
  const minVal = Math.min(...allValues)
  const maxVal = Math.max(...allValues)
  const padding = Math.max(2, (maxVal - minVal) * 0.05)
  const yMin = Math.floor(minVal - padding)
  const yMax = Math.ceil(maxVal + padding)

  return (
    <div aria-label="Graphique Performance Management Chart" role="img">
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
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
        <Tooltip
          contentStyle={{ background: '#141312', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }}
          labelFormatter={d => format(new Date(d), 'dd MMM', { locale: fr })}
          formatter={(value: number, name: string) => [Math.round(value), name]}
        />
        <Bar dataKey="tss" yAxisId="right" fill="rgba(255,255,255,0.08)" radius={[2, 2, 0, 0]} name="TSS" />
        <Line dataKey="ctl" yAxisId="left" stroke="#60A5FA" strokeWidth={2} dot={false} name="CTL (fitness)" />
        <Line dataKey="atl" yAxisId="left" stroke="#F87171" strokeWidth={2} dot={false} name="ATL (fatigue)" />
        <Line dataKey="tsb" yAxisId="left" stroke="#FF6B35" strokeWidth={2} dot={false} name="TSB (forme)" />
      </ComposedChart>
    </ResponsiveContainer>
    </div>
  )
}
