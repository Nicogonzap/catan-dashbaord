'use client'
import {
  LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { playerColor } from '@/lib/colors'

interface Props {
  data: Array<Record<string, number | string>>
  xKey: string
  players: string[]
  height?: number
}

export default function LineChart({ data, xKey, players, height = 320 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReLineChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#AED6F1" />
        <XAxis dataKey={xKey} tick={{ fill: '#5D7A8A', fontSize: 11 }} />
        <YAxis tick={{ fill: '#5D7A8A', fontSize: 11 }} allowDecimals={false} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {players.map(p => (
          <Line
            key={p}
            type="monotone"
            dataKey={p}
            stroke={p === 'Max' ? '#95A5A6' : playerColor(p)}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </ReLineChart>
    </ResponsiveContainer>
  )
}
