'use client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'

interface Props {
  data: Array<{ nombre: string; actual: number; max: number }>
  labelActual?: string
  labelMax?: string
  height?: number
  formatter?: (v: number) => string
}

export default function DoubleBar({
  data,
  labelActual = 'Actual',
  labelMax = 'Máximo histórico',
  height = 280,
  formatter,
}: Props) {
  const fmt = formatter ?? String
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#AED6F1" />
        <XAxis dataKey="nombre" tick={{ fill: '#1A2F45', fontSize: 12 }} />
        <YAxis tick={{ fill: '#5D7A8A', fontSize: 12 }} tickFormatter={fmt} allowDecimals={false} />
        <Tooltip formatter={(v: any) => fmt(v)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="actual" name={labelActual} fill="#2471A3" radius={[4, 4, 0, 0]} />
        <Bar dataKey="max" name={labelMax} fill="#AED6F1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
