'use client'
import { useState, useMemo } from 'react'
import { MIEMBROS_OFICIALES } from '@/lib/colors'
import { victoriasAcumuladas } from '@/lib/metrics'
import SectionTitle from '@/components/metrics/SectionTitle'
import KpiCard from '@/components/metrics/KpiCard'
import RankingTable from '@/components/tables/RankingTable'
import RankingCharts from '@/components/charts/RankingCharts'

interface Props {
  resultados: any[]
  years: number[]
}

function computeStats(resultados: any[]) {
  const map: Record<string, any> = {}
  for (const r of resultados) {
    const j = r.jugadores
    if (!j) continue
    if (!map[j.id]) {
      map[j.id] = {
        id: j.id, nombre: j.nombre,
        partidas_jugadas: 0, victorias: 0, _sum_pts: 0,
        total_ejercitos: 0, total_caminos: 0, total_pv: 0,
        victorias_flawless: 0, diez_tablero: 0,
      }
    }
    const s = map[j.id]
    s.partidas_jugadas++
    s._sum_pts += r.puntos_totales
    if (r.rank_en_partida === 1) {
      s.victorias++
      if (r.puntos_totales === 11) s.victorias_flawless++
      if (r.puntos_tablero === 10) s.diez_tablero++
    }
    if (r.ejercito_mas_grande) s.total_ejercitos++
    if (r.camino_mas_largo) s.total_caminos++
    s.total_pv += r.puntos_pv
  }
  return Object.values(map).map(s => ({
    ...s,
    pct_victorias: s.partidas_jugadas > 0 ? Math.round(s.victorias / s.partidas_jugadas * 1000) / 10 : 0,
    promedio_puntos: s.partidas_jugadas > 0 ? Math.round(s._sum_pts / s.partidas_jugadas * 100) / 100 : 0,
  })).sort((a: any, b: any) => b.victorias - a.victorias)
}

export default function HistoricoClient({ resultados, years }: Props) {
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

  const stats = useMemo(() => computeStats(filtered), [filtered])

  const totalPartidas = useMemo(
    () => new Set(filtered.map((r: any) => r.partida_id)).size,
    [filtered]
  )
  const totalEventos = useMemo(
    () => new Set(filtered.map((r: any) => r.partidas?.eventos?.id).filter(Boolean)).size,
    [filtered]
  )
  const promPorEvento = totalEventos > 0 ? (totalPartidas / totalEventos).toFixed(1) : '0'

  const acumData = useMemo(
    () => victoriasAcumuladas(filtered as any, MIEMBROS_OFICIALES),
    [filtered]
  )

  const eventosData = useMemo(() => {
    const map: Record<number, Record<string, number>> = {}
    for (const r of filtered as any[]) {
      if (r.rank_en_partida !== 1) continue
      const eventoId = r.partidas?.eventos?.id
      if (!eventoId) continue
      if (!map[eventoId]) {
        map[eventoId] = {}
        MIEMBROS_OFICIALES.forEach(j => { map[eventoId][j] = 0 })
      }
      const nombre = r.jugadores?.nombre
      if (MIEMBROS_OFICIALES.includes(nombre)) {
        map[eventoId][nombre] = (map[eventoId][nombre] ?? 0) + 1
      }
    }
    return Object.entries(map).map(([evId, vals]) => ({ evento: `E${evId}`, ...vals }))
  }, [filtered])

  const label = selectedYears.length === 0
    ? 'Todos los años'
    : selectedYears.sort().join(', ')

  return (
    <div>
      <h1 className="page-title text-3xl font-bold mb-4">Ranking Histórico 📊</h1>

      {/* Selector de años */}
      <div className="card p-4 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#5D7A8A' }}>
          Filtrar por año (selección múltiple)
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

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <KpiCard label="Total Eventos" value={totalEventos} />
        <KpiCard label="Total Partidas" value={totalPartidas} />
        <KpiCard label="Prom. por Evento" value={promPorEvento} />
      </div>

      <SectionTitle>Ranking — {label}</SectionTitle>
      <div className="card p-0 overflow-hidden mb-2">
        <RankingTable stats={stats} totalPartidas={totalPartidas} />
      </div>

      <RankingCharts
        stats={stats}
        acumData={acumData}
        eventosData={eventosData}
        players={MIEMBROS_OFICIALES}
        totalPartidas={totalPartidas}
      />
    </div>
  )
}
