'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { getResultadosConJugadores, getPartidas } from '@/lib/queries'
import { victoriasAcumuladas } from '@/lib/metrics'
import { MIEMBROS_OFICIALES } from '@/lib/colors'
import SectionTitle from '@/components/metrics/SectionTitle'
import RankingTable from '@/components/tables/RankingTable'
import RankingCharts from '@/components/charts/RankingCharts'

const YEAR = new Date().getFullYear()

function computeStats(resultados: any[]) {
  const map: Record<string, any> = {}
  for (const r of resultados) {
    const j = r.jugadores
    if (!j) continue
    if (!map[j.id]) {
      map[j.id] = {
        id: j.id, nombre: j.nombre, es_miembro_oficial: j.es_miembro_oficial,
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
  })).sort((a, b) => b.victorias - a.victorias)
}

export default function RankingClient() {
  const [resultados, setResultados] = useState<any[]>([])
  const [totalPartidas, setTotalPartidas] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getResultadosConJugadores(YEAR),
      getPartidas(YEAR),
    ]).then(([res, partidas]) => {
      setResultados(res)
      setTotalPartidas(partidas.length)
      setLoading(false)
    })
  }, [])

  const stats = useMemo(() => computeStats(resultados), [resultados])

  const acumData = useMemo(() => victoriasAcumuladas(resultados as any, MIEMBROS_OFICIALES), [resultados])

  const eventosData = useMemo(() => {
    const map: Record<number, Record<string, number>> = {}
    for (const r of resultados) {
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
  }, [resultados])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-white/70">Cargando ranking...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title text-3xl font-bold">Ranking {YEAR} 🏆</h1>
        <div className="flex gap-2">
          <Link
            href={`/eventos/${YEAR}`}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-80"
            style={{ background: '#2471A3' }}
          >
            Ver eventos
          </Link>
          <Link
            href="/historico"
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: '#EBF5FB', color: '#1A2F45' }}
          >
            Ver histórico
          </Link>
        </div>
      </div>

      <SectionTitle>Ranking General</SectionTitle>
      <div className="card p-0 overflow-x-auto mb-2">
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
