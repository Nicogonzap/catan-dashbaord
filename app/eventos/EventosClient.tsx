'use client'
import { useState, useMemo } from 'react'
import { playerColor, MIEMBROS_OFICIALES } from '@/lib/colors'
import KpiCard from '@/components/metrics/KpiCard'
import SectionTitle from '@/components/metrics/SectionTitle'
import PlayerBar from '@/components/charts/PlayerBar'
import StackedBarByEvent from '@/components/charts/StackedBarByEvent'

interface Props {
  year: number | null
  eventos: any[]
  partidas: any[]
  resultados: any[]
}

export default function EventosClient({ eventos, partidas, resultados, year }: Props) {
  const [eventoSelId, setEventoSelId] = useState<number | null>(null)
  const [partidaSelId, setPartidaSelId] = useState<number | null>(null)

  const eventosSorted = [...eventos].sort((a, b) => b.numero_evento - a.numero_evento)

  const eventoActual = eventoSelId
    ? eventos.find(e => e.id === eventoSelId)
    : null

  const partidasDelEvento = useMemo(() => {
    if (!eventoSelId) return partidas
    return partidas.filter(p => p.evento_id === eventoSelId)
  }, [eventoSelId, partidas])

  const resultadosFiltrados = useMemo(() => {
    const pids = new Set(partidasDelEvento.map(p => p.id))
    return resultados.filter(r => pids.has(r.partida_id))
  }, [partidasDelEvento, resultados])

  const resultadosPartidaSel = useMemo(() => {
    if (!partidaSelId) return resultadosFiltrados
    return resultadosFiltrados.filter(r => r.partida_id === partidaSelId)
  }, [partidaSelId, resultadosFiltrados])

  // KPIs del evento seleccionado
  const partIdsDistintas = new Set(resultadosFiltrados.map(r => r.partida_id))
  const jugDistintos = new Set(resultadosFiltrados.map(r => r.jugadores?.nombre)).size
  const sedes = [...new Set(partidasDelEvento.map(p => p.eventos?.ubicacion).filter(Boolean))]

  // Victorias del evento por jugador
  const victoriasEvento: Record<string, number> = {}
  for (const r of resultadosFiltrados) {
    if (r.rank_en_partida === 1) {
      const n = r.jugadores?.nombre
      victoriasEvento[n] = (victoriasEvento[n] ?? 0) + 1
    }
  }
  const victoriasData = Object.entries(victoriasEvento)
    .map(([nombre, value]) => ({ nombre, value }))
    .sort((a, b) => b.value - a.value)

  // Detalle de victorias (tabla ganadores)
  const ganadoresPartidas = partidasDelEvento.map(p => {
    const resPart = resultados.filter(r => r.partida_id === p.id)
    const ganador = resPart.find(r => r.rank_en_partida === 1)
    return {
      partida: p.numero_partida,
      ganador: ganador?.jugadores?.nombre ?? '—',
      ptsTablero: ganador?.puntos_tablero ?? 0,
      pv: ganador?.puntos_pv ?? 0,
      camino: ganador?.camino_mas_largo ?? false,
      ejercito: ganador?.ejercito_mas_grande ?? false,
      ptsTotal: ganador?.puntos_totales ?? 0,
    }
  })

  // Puntos totales por partida (stacked por jugador)
  const allPlayers = [...new Set(resultadosFiltrados.map(r => r.jugadores?.nombre).filter(Boolean))]
  const ptsPartidaData = partidasDelEvento.map(p => {
    const resPart = resultados.filter(r => r.partida_id === p.id)
    const row: Record<string, number | string> = { partida: `P${p.numero_partida}` }
    allPlayers.forEach(j => { row[j] = 0 })
    resPart.forEach(r => { row[r.jugadores?.nombre] = r.puntos_totales })
    return row
  })

  // Players por partida
  const playersParPartidaData = partidasDelEvento.map(p => ({
    nombre: `P${p.numero_partida}`,
    value: p.total_jugadores,
  }))

  return (
    <div>
      <h1 className="page-title text-3xl font-bold mb-6">
        Eventos
        {year && <span className="ml-3 text-xl font-normal opacity-75">— {year}</span>}
      </h1>

      {/* Filtros */}
      <div className="card p-4 mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#5D7A8A' }}>Evento</label>
          <select
            className="rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: '#AED6F1', color: '#1A2F45', background: '#EBF5FB' }}
            value={eventoSelId ?? ''}
            onChange={e => {
              setEventoSelId(e.target.value ? Number(e.target.value) : null)
              setPartidaSelId(null)
            }}
          >
            <option value="">Todos los eventos</option>
            {eventosSorted.map(ev => (
              <option key={ev.id} value={ev.id}>
                Evento {ev.numero_evento} — {ev.fecha} — {ev.ubicacion}
              </option>
            ))}
          </select>
        </div>

        {eventoSelId && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#5D7A8A' }}>Partida específica</label>
            <select
              className="rounded-lg border px-3 py-1.5 text-sm"
              style={{ borderColor: '#AED6F1', color: '#1A2F45', background: '#EBF5FB' }}
              value={partidaSelId ?? ''}
              onChange={e => setPartidaSelId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Todas las partidas</option>
              {partidasDelEvento.map(p => (
                <option key={p.id} value={p.id}>Partida {p.numero_partida}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <KpiCard label="Partidas disputadas" value={partIdsDistintas.size} />
        <KpiCard label="Jugadores distintos" value={jugDistintos} />
        <KpiCard label="Sede(s)" value={sedes.join(', ') || '—'} />
      </div>

      {/* Victorias del evento */}
      {victoriasData.length > 0 && (
        <>
          <SectionTitle>Victorias del Evento</SectionTitle>
          <div className="card p-4">
            <PlayerBar data={victoriasData} label="Victorias" height={260} />
          </div>
        </>
      )}

      {/* Tabla detalle victorias */}
      <SectionTitle>Detalle de Victorias</SectionTitle>
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#D6EAF8' }}>
              {['Partida','Ganador','Pts Tablero','PV','Caminos','Ejércitos','Total'].map(h => (
                <th key={h} className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: '#5D7A8A' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ganadoresPartidas.map((row, i) => (
              <tr key={row.partida} style={{ background: i % 2 === 0 ? '#EBF5FB' : '#D6EAF8' }}>
                <td className="px-4 py-2.5 font-mono font-semibold" style={{ color: '#1A2F45' }}>#{row.partida}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: playerColor(row.ganador) }} />
                    <span className="font-semibold" style={{ color: '#1A2F45' }}>{row.ganador}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5" style={{ color: '#1A2F45' }}>{row.ptsTablero}</td>
                <td className="px-4 py-2.5" style={{ color: '#1A2F45' }}>{row.pv}</td>
                <td className="px-4 py-2.5">{row.camino ? '✅' : '—'}</td>
                <td className="px-4 py-2.5">{row.ejercito ? '✅' : '—'}</td>
                <td className="px-4 py-2.5 font-bold" style={{ color: '#1A2F45' }}>{row.ptsTotal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tabla detalle jugadores */}
      <SectionTitle>Detalle Jugadores</SectionTitle>
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#D6EAF8' }}>
              {['Jugador','Victorias','Ejército','Caminos','PV'].map(h => (
                <th key={h} className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: '#5D7A8A' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allPlayers.map((nombre, i) => {
              const res = resultadosFiltrados.filter(r => r.jugadores?.nombre === nombre)
              const victorias = res.filter(r => r.rank_en_partida === 1).length
              const ejercito = res.filter(r => r.ejercito_mas_grande).length
              const camino = res.filter(r => r.camino_mas_largo).length
              const pv = res.reduce((s, r) => s + r.puntos_pv, 0)
              return (
                <tr key={nombre} style={{ background: i % 2 === 0 ? '#EBF5FB' : '#D6EAF8' }}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: playerColor(nombre) }} />
                      <span className="font-semibold" style={{ color: '#1A2F45' }}>{nombre}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-bold" style={{ color: '#1A2F45' }}>{victorias}</td>
                  <td className="px-4 py-2.5" style={{ color: '#1A2F45' }}>{ejercito}</td>
                  <td className="px-4 py-2.5" style={{ color: '#1A2F45' }}>{camino}</td>
                  <td className="px-4 py-2.5" style={{ color: '#1A2F45' }}>{pv}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Puntos totales por partida */}
      {ptsPartidaData.length > 0 && (
        <>
          <SectionTitle>Puntos Totales por Partida</SectionTitle>
          <div className="card p-4">
            <StackedBarByEvent data={ptsPartidaData} xKey="partida" players={allPlayers} height={320} />
          </div>
        </>
      )}

      {/* Players por partida */}
      {playersParPartidaData.length > 0 && (
        <>
          <SectionTitle>Jugadores por Partida</SectionTitle>
          <div className="card p-4">
            <PlayerBar data={playersParPartidaData} label="Jugadores" height={220} />
          </div>
        </>
      )}
    </div>
  )
}
