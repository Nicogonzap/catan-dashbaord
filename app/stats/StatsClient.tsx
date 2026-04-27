'use client'
import { useState, useMemo, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { playerColor } from '@/lib/colors'
import {
  calcularRachaActual, calcularRachaMaxima,
  calcularMaxVictoriasEnEvento, calcularCebollitas,
} from '@/lib/metrics'
import { getResultadosConJugadores, getAnosDisponibles } from '@/lib/queries'
import SectionTitle from '@/components/metrics/SectionTitle'
import PlayerBar from '@/components/charts/PlayerBar'
import DoubleBar from '@/components/charts/DoubleBar'

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <SectionTitle>{title}</SectionTitle>
      <div className="card p-4">{children}</div>
    </div>
  )
}

export default function StatsClient() {
  const [resultados, setResultados] = useState<any[]>([])
  const [years, setYears] = useState<number[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getResultadosConJugadores(), getAnosDisponibles()]).then(([res, yrs]) => {
      setResultados(res); setYears(yrs); setLoading(false)
    })
  }, [])

  if (loading) return <p className="text-center py-20 text-white/70">Cargando stats...</p>
  const [selectedYears, setSelectedYears] = useState<number[]>([])

  function toggleYear(y: number) {
    setSelectedYears(prev => prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y])
  }

  const filtered = useMemo(() => {
    if (selectedYears.length === 0) return resultados
    return resultados.filter(r => {
      const fecha = r.partidas?.fecha
      return fecha ? selectedYears.includes(new Date(fecha).getFullYear()) : false
    })
  }, [resultados, selectedYears])

  const jugadores = useMemo(() =>
    [...new Set(filtered.map((r: any) => r.jugadores?.nombre).filter(Boolean))],
    [filtered]
  )

  // ── Victorias por sede ───────────────────────────────────────
  const { sedeData, sedesOrdenadas } = useMemo(() => {
    const partidasPorSede: Record<string, Set<number>> = {}
    const victoriasPorSede: Record<string, Record<string, number>> = {}

    for (const r of filtered) {
      const sede = r.partidas?.eventos?.ubicacion
      if (!sede) continue
      if (!partidasPorSede[sede]) partidasPorSede[sede] = new Set()
      partidasPorSede[sede].add(r.partida_id)
      if (!victoriasPorSede[sede]) {
        victoriasPorSede[sede] = {}
        jugadores.forEach((j: string) => { victoriasPorSede[sede][j] = 0 })
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
  }, [jugadores, filtered])

  // ── Per-player stats from filtered resultados ────────────────
  const playerStats = useMemo(() => {
    const map: Record<string, { victorias_flawless: number; diez_tablero: number }> = {}
    for (const r of filtered) {
      const nombre = r.jugadores?.nombre
      if (!nombre) continue
      if (!map[nombre]) map[nombre] = { victorias_flawless: 0, diez_tablero: 0 }
      if (r.rank_en_partida === 1) {
        if (r.puntos_totales === 11) map[nombre].victorias_flawless++
        if (r.puntos_tablero === 10) map[nombre].diez_tablero++
      }
    }
    return map
  }, [filtered])

  const flawlessData = useMemo(() =>
    jugadores.map((j: string) => ({ nombre: j, value: playerStats[j]?.victorias_flawless ?? 0 }))
      .sort((a: any, b: any) => b.value - a.value),
    [jugadores, playerStats]
  )

  const diezTableroData = useMemo(() =>
    jugadores.map((j: string) => ({ nombre: j, value: playerStats[j]?.diez_tablero ?? 0 }))
      .sort((a: any, b: any) => b.value - a.value),
    [jugadores, playerStats]
  )

  const cebollitasData = useMemo(() =>
    jugadores.map((j: string) => ({
      nombre: j,
      value: calcularCebollitas(filtered as any, j),
    })).sort((a: any, b: any) => b.value - a.value),
    [jugadores, filtered]
  )

  // Racha: max en un evento vs max consecutivas
  const rachaVictoriasData = useMemo(() =>
    jugadores.map((j: string) => ({
      nombre: j,
      actual: calcularMaxVictoriasEnEvento(filtered as any, j),
      max: calcularRachaMaxima(filtered as any, j, 'victorias'),
    })),
    [jugadores, filtered]
  )

  // Sequías: actual (racha actual sin ganar) + max histórico
  const sequiaData = useMemo(() =>
    jugadores.map((j: string) => ({
      nombre: j,
      actual: calcularRachaActual(filtered as any, j, 'sequía'),
      max: calcularRachaMaxima(filtered as any, j, 'sequía'),
    })),
    [jugadores, filtered]
  )

  // ── Efectividad en uso de recursos ──────────────────────────
  const efectividadData = useMemo(() =>
    jugadores
      .map((j: string) => {
        const resJ = filtered.filter((r: any) => r.jugadores?.nombre === j)
        const partConEjercito = resJ.filter((r: any) => r.ejercito_mas_grande).length
        const vicConEjercito  = resJ.filter((r: any) => r.ejercito_mas_grande && r.rank_en_partida === 1).length
        const partConCamino   = resJ.filter((r: any) => r.camino_mas_largo).length
        const vicConCamino    = resJ.filter((r: any) => r.camino_mas_largo && r.rank_en_partida === 1).length
        return {
          nombre: j,
          ejercito: partConEjercito > 0 ? Math.round(vicConEjercito / partConEjercito * 100) : 0,
          camino:   partConCamino   > 0 ? Math.round(vicConCamino   / partConCamino   * 100) : 0,
        }
      })
      .filter((d: any) => d.ejercito > 0 || d.camino > 0),
    [jugadores, filtered]
  )

  const label = selectedYears.length === 0
    ? 'Todos los años'
    : selectedYears.sort().join(', ')

  return (
    <div>
      <h1 className="page-title text-3xl font-bold mb-4">Stats</h1>

      {/* Selector de años */}
      <div className="card p-4 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#5D7A8A' }}>
          Filtrar por año — {label}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedYears([])}
            className="px-3 py-1.5 rounded-full text-sm font-semibold border transition-all"
            style={{
              background: selectedYears.length === 0 ? '#154E80' : '#EBF5FB',
              color: selectedYears.length === 0 ? '#fff' : '#5D7A8A',
              borderColor: '#AED6F1',
            }}
          >
            Todos
          </button>
          {years.map(y => (
            <button
              key={y}
              onClick={() => toggleYear(y)}
              className="px-3 py-1.5 rounded-full text-sm font-semibold border transition-all"
              style={{
                background: selectedYears.includes(y) ? '#154E80' : '#EBF5FB',
                color: selectedYears.includes(y) ? '#fff' : '#5D7A8A',
                borderColor: '#AED6F1',
              }}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* 1. Victorias por sede */}
      <SectionTitle>Victorias por Sede</SectionTitle>
      <p className="text-sm mb-3" style={{ color: 'rgba(255,255,255,0.75)' }}>
        Ordenadas de mayor a menor por partidas jugadas en esa sede
      </p>
      <div className="card p-4">
        <ResponsiveContainer width="100%" height={Math.max(300, sedesOrdenadas.length * 60)}>
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
            {jugadores.map((j: string) => (
              <Bar key={j} dataKey={j} stackId="a" fill={playerColor(j)}
                stroke={j === 'Max' ? '#95A5A6' : undefined}
                strokeWidth={j === 'Max' ? 1 : 0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 2 & 3. Flawless + 10 de tablero */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
        <ChartCard title="Victorias Flawless (11 puntos exactos)">
          <PlayerBar data={flawlessData} label="Flawless" height={260} />
        </ChartCard>
        <ChartCard title="10 de Tablero (10 pts sin PV)">
          <PlayerBar data={diezTableroData} label="10 tablero" height={260} />
        </ChartCard>
      </div>

      {/* 4. Cebollitas */}
      <ChartCard title="Cebollitas (9-10 pts sin ganar)">
        <PlayerBar data={cebollitasData} label="Cebollitas" height={260} />
      </ChartCard>

      {/* 5. Racha de victorias */}
      <ChartCard title="Racha de Victorias">
        <DoubleBar
          data={rachaVictoriasData}
          labelActual="Máx. en un evento"
          labelMax="Máx. consecutivas"
          height={280}
        />
      </ChartCard>

      {/* 6. Sequías */}
      <ChartCard title="Sequías (partidas sin ganar)">
        <DoubleBar
          data={sequiaData}
          labelActual="Sequía actual"
          labelMax="Máximo histórico"
          height={280}
        />
      </ChartCard>

      {/* 7. Efectividad recursos */}
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
    </div>
  )
}
