'use client'
import { playerColor } from '@/lib/colors'

interface Stat {
  nombre: string
  victorias: number
  partidas_jugadas: number
  pct_victorias: number
}

interface Props {
  stats: Stat[]
}

export default function RankingTable({ stats }: Props) {
  const sorted = [...stats].sort((a, b) => Number(b.victorias) - Number(a.victorias))

  return (
    <table className="w-full text-sm">
      <thead>
        <tr style={{ background: '#D6EAF8' }}>
          <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: '#5D7A8A' }}>#</th>
          <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: '#5D7A8A' }}>Jugador</th>
          <th className="text-right px-4 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: '#5D7A8A' }}>Victorias</th>
          <th className="text-right px-4 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: '#5D7A8A' }}>Partidas</th>
          <th className="text-right px-4 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: '#5D7A8A' }}>% Victorias</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((s, i) => (
          <tr
            key={s.nombre}
            style={{ background: i % 2 === 0 ? '#EBF5FB' : '#D6EAF8' }}
          >
            <td className="px-4 py-2.5 font-bold" style={{ color: '#5D7A8A' }}>{i + 1}</td>
            <td className="px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full inline-block border"
                  style={{
                    background: playerColor(s.nombre),
                    borderColor: s.nombre === 'Max' ? '#95A5A6' : playerColor(s.nombre),
                  }}
                />
                <span className="font-semibold" style={{ color: '#1A2F45' }}>{s.nombre}</span>
              </div>
            </td>
            <td className="px-4 py-2.5 text-right font-bold" style={{ color: '#1A2F45' }}>{s.victorias}</td>
            <td className="px-4 py-2.5 text-right" style={{ color: '#5D7A8A' }}>{s.partidas_jugadas}</td>
            <td className="px-4 py-2.5 text-right">
              <span
                className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{ background: '#D6EAF8', color: '#1A2F45' }}
              >
                {Number(s.pct_victorias).toFixed(1)}%
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
