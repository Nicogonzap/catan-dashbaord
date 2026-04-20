'use client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import { playerColor } from '@/lib/colors'

interface Props {
  data: Array<Record<string, number | string>>
  xKey: string
  players: string[]   // in the order to show
  height?: number
}

export default function ClusterBar({ data, xKey, players, height = 320 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#AED6F1" />
        <XAxis dataKey={xKey} tick={{ fill: '#1A2F45', fontSize: 12 }} />
        <YAxis tick={{ fill: '#5D7A8A', fontSize: 12 }} allowDecimals={false} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {players.map(p => (
          <Bar
            key={p}
            dataKey={p}
            name={p}
            fill={playerColor(p)}
            stroke={p === 'Max' ? '#95A5A6' : undefined}
            strokeWidth={p === 'Max' ? 1 : 0}
            radius={[3, 3, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
