'use client'
import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend, LabelList
} from 'recharts'
import { playerColor, MIEMBROS_OFICIALES } from '@/lib/colors'
import {
  calcularRachaActual, calcularRachaMaxima,
  calcularCebollitas, calcularVictoriaTipica
} from '@/lib/metrics'
import SectionTitle from '@/components/metrics/SectionTitle'
import PlayerBar from '@/components/charts/PlayerBar'
import DoubleBar from '@/components/charts/DoubleBar'

interface Props {
  stats: any[]
  resultados: any[]
  year: number | null
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <SectionTitle>{title}</SectionTitle>
      <div className="card p-4">{children}</div>
    </div>
  )
}

export default function IndividualidadesClient({ stats, resultados, year }: Props) {
  const jugadores = useMemo(() =>
    [...new Set(resultados.map(r => r.jugadores?.nombre).filter(Boolean))],
    [resultados]
  )

  const flawlessData = useMemo(() =>
    stats.map(s => ({ nombre: s.nombre, value: Number(s.victorias_flawless) })),
    [stats]
  )

  const diezTableroData = useMemo(() =>
    stats.map(s => ({ nombre: s.nombre, value: Number(s.diez_tablero) })),
    [stats]
  )

  const cebollitasData = useMemo(() =>
    jugadores.map(j => ({
      nombre: j,
      value: calcularCebollitas(resultados as any, j),
    })).sort((a, b) => b.value - a.value),
    [jugadores, resultados]
  )

  const rachaVictoriasData = useMemo(() =>
    jugadores.map(j => ({
      nombre: j,
      actual: calcularRachaActual(resultados as any, j, 'victorias'),
      max: calcularRachaMaxima(resultados as any, j, 'victorias'),
    })),
    [jugadores, resultados]
  )

  const sequiaData = useMemo(() =>
    jugadores.map(j => ({
      nombre: j,
      actual: calcularRachaActual(resultados as any, j, 'sequía'),
      max: calcularRachaMaxima(resultados as any, j, 'sequía'),
    })),
    [jugadores, resultados]
  )

  const victoriaTipicaData = useMemo(() =>
    jugadores.map(j => {
      const vt = calcularVictoriaTipica(resultados as any, j)
      return { nombre: j, ...vt }
    }),
    [jugadores, resultados]
  )

  // Victorias por sede
  const sedesSet = [...new Set(resultados.map(r => r.partidas?.eventos?.ubicacion).filter(Boolean))]
  const estadiosData = useMemo(() => {
    const byJugador: Record<string, Record<string, number>> = {}
    for (const r of resultados) {
      if (r.rank_en_partida !== 1) continue
      const j = r.jugadores?.nombre
      const sede = r.partidas?.eventos?.ubicacion
      if (!j || !sede) continue
      if (!byJugador[j]) byJugador[j] = {}
      byJugador[j][sede] = (byJugador[j][sede] ?? 0) + 1
    }
    return jugadores.map(j => ({ nombre: j, ...byJugador[j] }))
  }, [jugadores, resultados])

  // Partidas con penalidad
  const partidasIdiotas = useMemo(() =>
    resultados
      .filter(r => r.penalidad && r.penalidad !== 0)
      .map(r => ({
        partida: r.partidas?.numero_partida,
        jugador: r.jugadores?.nombre,
        ptsTotal: r.puntos_totales,
        penalidad: r.penalidad,
      })),
    [resultados]
  )

  return (
    <div>
      <h1 className="page-title text-3xl font-bold mb-6">
        Individualidades
        {year && <span className="ml-3 text-xl font-normal opacity-75">— {year}</span>}
      </h1>

      {/* Tabla uso de recursos */}
      <SectionTitle>Uso de Recursos</SectionTitle>
      <div className="card p-0 overflow-hidden mb-2">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#D6EAF8' }}>
              {['Jugador','Victorias','Partidas','Caminos','Ejército','PV','Pts Totales'].map(h => (
                <th key={h} className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: '#5D7A8A' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...stats].sort((a, b) => Number(b.victorias) - Number(a.victorias)).map((s, i) => (
              <tr key={s.nombre} style={{ background: i % 2 === 0 ? '#EBF5FB' : '#D6EAF8' }}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: playerColor(s.nombre) }} />
                    <span className="font-semibold" style={{ color: '#1A2F45' }}>{s.nombre}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 font-bold" style={{ color: '#1A2F45' }}>{s.victorias}</td>
                <td className="px-4 py-2.5" style={{ color: '#5D7A8A' }}>{s.partidas_jugadas}</td>
                <td className="px-4 py-2.5" style={{ color: '#1A2F45' }}>{s.total_caminos}</td>
                <td className="px-4 py-2.5" style={{ color: '#1A2F45' }}>{s.total_ejercitos}</td>
                <td className="px-4 py-2.5" style={{ color: '#1A2F45' }}>{s.total_pv}</td>
                <td className="px-4 py-2.5" style={{ color: '#1A2F45' }}>{Number(s.promedio_puntos).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
        <ChartCard title="Victorias Flawless (11 puntos exactos)">
          <PlayerBar data={flawlessData} label="Flawless" height={260} />
        </ChartCard>

        <ChartCard title="10 de Tablero (10 pts sin PV)">
          <PlayerBar data={diezTableroData} label="10 tablero" height={260} />
        </ChartCard>

        <ChartCard title="Cebollitas (9-10 pts sin ganar)">
          <PlayerBar data={cebollitasData} label="Cebollitas" height={260} />
        </ChartCard>
      </div>

      <ChartCard title="Victoria Típica — Composición de Puntos (%)">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={victoriaTipicaData} layout="vertical" margin={{ left: 60, right: 20, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#AED6F1" />
            <XAxis type="number" domain={[0, 100]} tick={{ fill: '#5D7A8A', fontSize: 12 }} tickFormatter={v => `${v}%`} />
            <YAxis type="category" dataKey="nombre" tick={{ fill: '#1A2F45', fontSize: 12 }} width={55} />
            <Tooltip formatter={(v: any) => `${v}%`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="tablero" name="Tablero" stackId="a" fill="#2471A3" />
            <Bar dataKey="pv" name="PV (cartas)" stackId="a" fill="#D4AC0D" />
            <Bar dataKey="ejercito" name="Ejército" stackId="a" fill="#C0392B" />
            <Bar dataKey="camino" name="Camino" stackId="a" fill="#27AE60" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
        <ChartCard title="Racha de Victorias">
          <DoubleBar
            data={rachaVictoriasData}
            labelActual="Racha actual"
            labelMax="Máximo histórico"
            height={280}
          />
        </ChartCard>

        <ChartCard title="Sequías (partidas sin ganar)">
          <DoubleBar
            data={sequiaData}
            labelActual="Sequía actual"
            labelMax="Máximo histórico"
            height={280}
          />
        </ChartCard>
      </div>

      <ChartCard title="Estadios Conquistados (victorias por sede)">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={estadiosData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#AED6F1" />
            <XAxis dataKey="nombre" tick={{ fill: '#1A2F45', fontSize: 12 }} />
            <YAxis tick={{ fill: '#5D7A8A', fontSize: 12 }} allowDecimals={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {sedesSet.map((sede, i) => (
              <Bar key={sede} dataKey={sede} stackId="a" fill={['#2471A3','#27AE60','#C0392B','#D4AC0D','#8E44AD','#E67E22'][i % 6]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Partidas de idiotas */}
      {partidasIdiotas.length > 0 && (
        <>
          <SectionTitle>Partidas de Idiotas (con penalidad)</SectionTitle>
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#D6EAF8' }}>
                  {['Partida','Jugador','Puntos Totales','Penalidad'].map(h => (
                    <th key={h} className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: '#5D7A8A' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {partidasIdiotas.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#EBF5FB' : '#D6EAF8' }}>
                    <td className="px-4 py-2.5 font-mono" style={{ color: '#1A2F45' }}>#{row.partida}</td>
                    <td className="px-4 py-2.5 font-semibold" style={{ color: '#1A2F45' }}>{row.jugador}</td>
                    <td className="px-4 py-2.5" style={{ color: '#1A2F45' }}>{row.ptsTotal}</td>
                    <td className="px-4 py-2.5 text-red-600 font-bold">{row.penalidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
