'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { playerColor, lightenColor, formatDate } from '@/lib/colors'
import { getResultadosConJugadores, getEventos } from '@/lib/queries'
import { victoriasAcumuladas } from '@/lib/metrics'
import { MIEMBROS_OFICIALES } from '@/lib/colors'
import SectionTitle from '@/components/metrics/SectionTitle'
import RankingTable from '@/components/tables/RankingTable'
import RankingCharts from '@/components/charts/RankingCharts'

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

function GanadoresBadges({ ganadores }: { ganadores: { nombre: string; victorias: number }[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {ganadores.map(g => {
        const color = playerColor(g.nombre)
        return (
          <span
            key={g.nombre}
            className="px-2 py-0.5 rounded-full text-xs font-semibold border"
            style={{ borderColor: color, color, background: lightenColor(color, 0.15) }}
          >
            {g.nombre}: {g.victorias}
          </span>
        )
      })}
    </div>
  )
}

export default function EventosAnoClient({ ano }: { ano: number }) {
  const [resultados, setResultados] = useState<any[]>([])
  const [eventos, setEventos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getResultadosConJugadores(ano),
      getEventos(ano),
    ]).then(([res, evs]) => {
      setResultados(res)
      setEventos(evs)
      setLoading(false)
    })
  }, [ano])

  const stats = useMemo(() => computeStats(resultados), [resultados])
  const totalPartidas = useMemo(
    () => new Set(resultados.map(r => r.partida_id)).size,
    [resultados]
  )

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

  // Resumen de eventos del año
  const resumenEventos = useMemo(() => {
    return [...eventos]
      .sort((a, b) => b.numero_evento - a.numero_evento)
      .map(ev => {
        const resEv = resultados.filter(r => r.partidas?.eventos?.id === ev.id)
        const jugadores = [...new Set(resEv.map((r: any) => r.jugadores?.nombre).filter(Boolean))]
        const victoriasMap: Record<string, number> = {}
        for (const r of resEv) {
          if (r.rank_en_partida !== 1) continue
          const n = r.jugadores?.nombre
          if (n) victoriasMap[n] = (victoriasMap[n] ?? 0) + 1
        }
        const ganadores = Object.entries(victoriasMap)
          .sort((a, b) => b[1] - a[1])
          .map(([nombre, victorias]) => ({ nombre, victorias }))
        const partidasSet = new Set(resEv.map((r: any) => r.partida_id))
        return {
          id: ev.id,
          numero_evento: ev.numero_evento,
          fechaDisplay: formatDate(ev.fecha),
          ubicacion: ev.ubicacion,
          jugadores: jugadores.length,
          partidas: partidasSet.size,
          ganadores,
        }
      })
  }, [eventos, resultados])

  if (loading) return <p className="text-center py-20 text-white/70">Cargando...</p>

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/torneos" className="text-white/60 hover:text-white text-sm">← Torneos</Link>
        <h1 className="page-title text-3xl font-bold">Torneo {ano}</h1>
      </div>

      {/* Ranking */}
      <SectionTitle>Ranking {ano}</SectionTitle>
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

      {/* Eventos del año */}
      <SectionTitle>Eventos {ano}</SectionTitle>
      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#D6EAF8' }}>
              {['Nro', 'Fecha', 'Sede', 'Partidas', 'Jugadores', 'Ganadores'].map(h => (
                <th key={h} className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: '#5D7A8A' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resumenEventos.map((ev, i) => (
              <tr key={ev.id} style={{ background: i % 2 === 0 ? '#EBF5FB' : '#D6EAF8' }}>
                <td className="px-4 py-3 font-bold" style={{ color: '#1A2F45' }}>{ev.numero_evento}</td>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: '#1A2F45' }}>{ev.fechaDisplay}</td>
                <td className="px-4 py-3" style={{ color: '#1A2F45' }}>{ev.ubicacion}</td>
                <td className="px-4 py-3 text-xs" style={{ color: '#5D7A8A' }}>{ev.partidas}</td>
                <td className="px-4 py-3 text-xs" style={{ color: '#5D7A8A' }}>{ev.jugadores}</td>
                <td className="px-4 py-3">
                  <GanadoresBadges ganadores={ev.ganadores} />
                </td>
              </tr>
            ))}
            {resumenEventos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center" style={{ color: '#5D7A8A' }}>
                  Sin eventos registrados para {ano}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
