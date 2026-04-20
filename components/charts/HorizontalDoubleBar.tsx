'use client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'

interface Props {
  data: Array<{ nombre: string; ejercito: number; camino: number }>
  height?: number
}

export default function HorizontalDoubleBar({ data, height = 280 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 60, right: 40, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#AED6F1" />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fill: '#5D7A8A', fontSize: 12 }}
          tickFormatter={v => `${v}%`}
        />
        <YAxis type="category" dataKey="nombre" tick={{ fill: '#1A2F45', fontSize: 12 }} width={55} />
        <Tooltip formatter={(v: any) => `${v}%`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="ejercito" name="Ejército %" fill="#C0392B" radius={[0, 4, 4, 0]} />
        <Bar dataKey="camino" name="Camino %" fill="#27AE60" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
