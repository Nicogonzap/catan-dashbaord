'use client'
import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import { playerColor } from '@/lib/colors'
import SectionTitle from '@/components/metrics/SectionTitle'

interface Props {
  resultados: any[]
  year: number | null
}

export default function StatsClient({ resultados, year }: Props) {
  const jugadores = useMemo(() =>
    [...new Set(resultados.map(r => r.jugadores?.nombre).filter(Boolean))].sort(),
    [resultados]
  )

  // ── Efectividad en uso de recursos ──────────────────────────
  // Numerador: partidas donde rank=1 Y tuvo el recurso
  // Denominador: partidas donde tuvo el recurso (cualquier rank)
  const efectividadData = useMemo(() =>
    jugadores
      .map(j => {
        const resJ = resultados.filter(r => r.jugadores?.nombre === j)
        const partConEjercito = resJ.filter(r => r.ejercito_mas_grande).length
        const vicConEjercito  = resJ.filter(r => r.ejercito_mas_grande && r.rank_en_partida === 1).length
        const partConCamino   = resJ.filter(r => r.camino_mas_largo).length
        const vicConCamino    = resJ.filter(r => r.camino_mas_largo && r.rank_en_partida === 1).length
        return {
          nombre: j,
          ejercito: partConEjercito > 0 ? Math.round(vicConEjercito / partConEjercito * 100) : 0,
          camino:   partConCamino   > 0 ? Math.round(vicConCamino   / partConCamino   * 100) : 0,
        }
      })
      .filter(d => d.ejercito > 0 || d.camino > 0),
    [jugadores, resultados]
  )

  // ── Victorias por sede ───────────────────────────────────────
  // Sedes en eje X, ordenadas por total de partidas (desc)
  // Barras apiladas por jugador
  const { sedeData, sedesOrdenadas } = useMemo(() => {
    const partidasPorSede: Record<string, Set<number>> = {}
    const victoriasPorSede: Record<string, Record<string, number>> = {}

    for (const r of resultados) {
      const sede = r.partidas?.eventos?.ubicacion
      if (!sede) continue

      if (!partidasPorSede[sede]) partidasPorSede[sede] = new Set()
      partidasPorSede[sede].add(r.partida_id)

      if (!victoriasPorSede[sede]) {
        victoriasPorSede[sede] = {}
        jugadores.forEach(j => { victoriasPorSede[sede][j] = 0 })
      }

      if (r.rank_en_partida === 1) {
        const nombre = r.jugadores?.nombre
        if (nombre) victoriasPorSede[sede][nombre] = (victoriasPorSede[sede][nombre] ?? 0) + 1
      }
    }

    const sedesOrdenadas = Object.entries(partidasPorSede)
      .sort((a, b) => b[1].size - a[1].size)
      .map(([sede]) => sede)

    const sedeData = sedesOrdenadas.map(sede => ({
      sede,
      _total: partidasPorSede[sede].size,
      ...victoriasPorSede[sede],
    }))

    return { sedeData, sedesOrdenadas }
  }, [jugadores, resultados])

  return (
    <div>
      <h1 className="page-title text-3xl font-bold mb-6">
        Stats
        {year && <span className="ml-3 text-xl font-normal opacity-75">— {year}</span>}
      </h1>

      {/* Efectividad en uso de recursos */}
      <SectionTitle>Efectividad en el Uso de Recursos</SectionTitle>
      <p className="text-sm mb-3" style={{ color: 'rgba(255,255,255,0.75)' }}>
        Victorias con el recurso / Partidas en que tuvo el recurso
      </p>
      <div className="card p-4">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={efectividadData} layout="vertical" margin={{ left: 60, right: 50, top: 8, bottom: 8 }}>
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
            <Bar dataKey="ejercito" name="Ejército más grande" fill="#C0392B" radius={[0, 4, 4, 0]} />
            <Bar dataKey="camino"   name="Camino más largo"    fill="#27AE60" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Victorias por sede */}
      <SectionTitle>Victorias por Sede</SectionTitle>
      <p className="text-sm mb-3" style={{ color: 'rgba(255,255,255,0.75)' }}>
        Ordenadas de mayor a menor por partidas jugadas en esa sede
      </p>
      <div className="card p-4">
        <ResponsiveContainer width="100%" height={Math.max(320, sedesOrdenadas.length * 60)}>
          <BarChart data={sedeData} margin={{ left: 8, right: 24, top: 8, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#AED6F1" />
            <XAxis
              dataKey="sede"
              tick={{ fill: '#1A2F45', fontSize: 12 }}
              label={{ value: 'Sede', position: 'insideBottom', offset: -28, fill: '#5D7A8A', fontSize: 12 }}
            />
            <YAxis tick={{ fill: '#5D7A8A', fontSize: 12 }} allowDecimals={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {jugadores.map(j => (
              <Bar
                key={j}
                dataKey={j}
                stackId="a"
                fill={playerColor(j)}
                stroke={j === 'Max' ? '#95A5A6' : undefined}
                strokeWidth={j === 'Max' ? 1 : 0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
