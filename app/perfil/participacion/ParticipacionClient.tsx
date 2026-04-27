'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { playerColor, lightenColor, formatDate } from '@/lib/colors'
import { getResultadosConJugadores, getEventos, getPerfilUsuario } from '@/lib/queries'

const YEARS = [2024, 2025, 2026]

function GanadoresBadges({ ganadores }: { ganadores: { nombre: string; victorias: number }[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {ganadores.map(g => {
        const color = playerColor(g.nombre)
        return (
          <span key={g.nombre} className="px-2 py-0.5 rounded-full text-xs font-semibold border"
            style={{ borderColor: color, color, background: lightenColor(color, 0.15) }}>
            {g.nombre}: {g.victorias}
          </span>
        )
      })}
    </div>
  )
}

export default function ParticipacionClient() {
  const [resultados, setResultados] = useState<any[]>([])
  const [eventos, setEventos] = useState<any[]>([])
  const [miJugadorNombre, setMiJugadorNombre] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [filtroYear, setFiltroYear] = useState<number | null>(null)
  const [soloMisEventos, setSoloMisEventos] = useState(false)

  useEffect(() => {
    Promise.all([
      getResultadosConJugadores(),
      getEventos(),
      getPerfilUsuario(),
    ]).then(([res, evs, perfil]) => {
      setResultados(res)
      setEventos(evs)
      setMiJugadorNombre(perfil?.jugadores?.nombre ?? null)
      setLoading(false)
    })
  }, [])

  const resumenEventos = useMemo(() => {
    return [...eventos]
      .sort((a, b) => b.numero_evento - a.numero_evento)
      .map(ev => {
        const resEv = resultados.filter(r => r.partidas?.eventos?.id === ev.id)
        const totalPartidas = new Set(resEv.map((r: any) => r.partida_id)).size
        const jugadoresDist = [...new Set(resEv.map((r: any) => r.jugadores?.nombre).filter(Boolean))]

        // Player's partidas in this event
        const misResEv = miJugadorNombre
          ? resEv.filter((r: any) => r.jugadores?.nombre === miJugadorNombre)
          : []
        const misPartidas = new Set(misResEv.map((r: any) => r.partida_id)).size
        const participe = misPartidas > 0

        const victoriasMap: Record<string, number> = {}
        for (const r of resEv) {
          if (r.rank_en_partida !== 1) continue
          const n = r.jugadores?.nombre
          if (n) victoriasMap[n] = (victoriasMap[n] ?? 0) + 1
        }
        const ganadores = Object.entries(victoriasMap)
          .sort((a, b) => b[1] - a[1])
          .map(([nombre, victorias]) => ({ nombre, victorias }))

        const fecha = new Date(ev.fecha + 'T00:00:00')
        return {
          id: ev.id,
          numero_evento: ev.numero_evento,
          fechaDisplay: formatDate(ev.fecha),
          year: fecha.getFullYear(),
          ubicacion: ev.ubicacion,
          totalPartidas,
          misPartidas,
          jugadores: jugadoresDist.length,
          ganadores,
          participe,
        }
      })
  }, [eventos, resultados, miJugadorNombre])

  const filtrado = useMemo(() => {
    return resumenEventos.filter(ev => {
      if (filtroYear !== null && ev.year !== filtroYear) return false
      if (soloMisEventos && !ev.participe) return false
      return true
    })
  }, [resumenEventos, filtroYear, soloMisEventos])

  if (loading) return <p className="text-center py-20 text-white/70">Cargando...</p>

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/perfil/estadisticas" className="text-white/60 hover:text-white text-sm">← Mis Estadísticas</Link>
        <h1 className="page-title text-3xl font-bold">
          Ver Participación
          {miJugadorNombre && <span className="text-lg font-normal ml-2 opacity-70">— {miJugadorNombre}</span>}
        </h1>
      </div>

      {/* Filtros */}
      <div className="card p-4 mb-4">
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#5D7A8A' }}>Torneo</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFiltroYear(null)}
              className="px-3 py-1 rounded-full text-xs font-semibold border"
              style={{ background: filtroYear === null ? '#154E80' : '#EBF5FB', color: filtroYear === null ? '#fff' : '#5D7A8A', borderColor: '#AED6F1' }}
            >
              Todos
            </button>
            {YEARS.slice().reverse().map(y => (
              <button key={y} onClick={() => setFiltroYear(prev => prev === y ? null : y)}
                className="px-3 py-1 rounded-full text-xs font-semibold border"
                style={{ background: filtroYear === y ? '#154E80' : '#EBF5FB', color: filtroYear === y ? '#fff' : '#5D7A8A', borderColor: '#AED6F1' }}>
                {y}
              </button>
            ))}
          </div>
        </div>
        {miJugadorNombre && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={soloMisEventos}
              onChange={e => setSoloMisEventos(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm font-medium" style={{ color: '#1A2F45' }}>
              Solo eventos donde participé
            </span>
          </label>
        )}
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#D6EAF8' }}>
              {['Nro', 'Fecha', 'Sede', miJugadorNombre ? 'Mis partidas / Total' : 'Partidas', 'Jugadores', 'Ganadores'].map(h => (
                <th key={h} className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: '#5D7A8A' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrado.map((ev, i) => (
              <tr key={ev.id}
                style={{ background: ev.participe && miJugadorNombre ? (i % 2 === 0 ? '#D6EAF8' : '#BFD8F0') : (i % 2 === 0 ? '#EBF5FB' : '#D6EAF8') }}
              >
                <td className="px-4 py-3 font-bold" style={{ color: '#1A2F45' }}>{ev.numero_evento}</td>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: '#1A2F45' }}>{ev.fechaDisplay}</td>
                <td className="px-4 py-3" style={{ color: '#1A2F45' }}>{ev.ubicacion}</td>
                <td className="px-4 py-3 text-xs font-medium" style={{ color: '#1A2F45' }}>
                  {miJugadorNombre ? (
                    <span>
                      <span className="font-bold" style={{ color: ev.participe ? '#1E8449' : '#5D7A8A' }}>{ev.misPartidas}</span>
                      <span style={{ color: '#5D7A8A' }}> / {ev.totalPartidas}</span>
                    </span>
                  ) : ev.totalPartidas}
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: '#5D7A8A' }}>{ev.jugadores}</td>
                <td className="px-4 py-3">
                  <GanadoresBadges ganadores={ev.ganadores} />
                </td>
              </tr>
            ))}
            {filtrado.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center" style={{ color: '#5D7A8A' }}>Sin eventos para el filtro seleccionado</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
