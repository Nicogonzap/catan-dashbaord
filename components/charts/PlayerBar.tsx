'use client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList
} from 'recharts'
import { playerColor } from '@/lib/colors'

interface Props {
  data: Array<{ nombre: string; value: number }>
  label?: string
  formatter?: (v: number) => string
  horizontal?: boolean
  height?: number
}

export default function PlayerBar({ data, label, formatter, horizontal = false, height = 280 }: Props) {
  const fmt = formatter ?? ((v: number) => String(v))

  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ left: 60, right: 40, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#AED6F1" />
          <XAxis type="number" tick={{ fill: '#5D7A8A', fontSize: 12 }} tickFormatter={fmt} />
          <YAxis type="category" dataKey="nombre" tick={{ fill: '#1A2F45', fontSize: 12 }} width={55} />
          <Tooltip formatter={(v: any) => [fmt(v), label ?? '']} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map(d => (
              <Cell
                key={d.nombre}
                fill={playerColor(d.nombre)}
                stroke={d.nombre === 'Max' ? '#95A5A6' : undefined}
                strokeWidth={d.nombre === 'Max' ? 1.5 : 0}
              />
            ))}
            <LabelList dataKey="value" position="right" formatter={(v: any) => fmt(v)} style={{ fontSize: 11, fill: '#1A2F45' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: 8, right: 8, top: 16, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#AED6F1" />
        <XAxis dataKey="nombre" tick={{ fill: '#1A2F45', fontSize: 12 }} />
        <YAxis tick={{ fill: '#5D7A8A', fontSize: 12 }} tickFormatter={fmt} />
        <Tooltip formatter={(v: any) => [fmt(v), label ?? '']} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map(d => (
            <Cell
              key={d.nombre}
              fill={playerColor(d.nombre)}
              stroke={d.nombre === 'Max' ? '#95A5A6' : undefined}
              strokeWidth={d.nombre === 'Max' ? 1.5 : 0}
            />
          ))}
          <LabelList dataKey="value" position="top" formatter={(v: any) => fmt(v)} style={{ fontSize: 11, fill: '#1A2F45' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
