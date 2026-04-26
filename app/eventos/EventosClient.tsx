'use client'
import { useState, useMemo, useEffect } from 'react'
import { playerColor, lightenColor, formatDate, MESES_ES, PLAYER_ORDER } from '@/lib/colors'
import { getEventos, getResultadosConJugadores } from '@/lib/queries'
import KpiCard from '@/components/metrics/KpiCard'
import SectionTitle from '@/components/metrics/SectionTitle'
import ClusterBar from '@/components/charts/ClusterBar'
import PlayerBar from '@/components/charts/PlayerBar'

// ── helpers ──────────────────────────────────────────────────
function sortedPlayers(nombres: string[]): string[] {
  return [...nombres].sort((a, b) => {
    const ia = PLAYER_ORDER.indexOf(a)
    const ib = PLAYER_ORDER.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
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

export default function EventosClient() {
  const [eventos, setEventos] = useState<any[]>([])
  const [resultados, setResultados] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getEventos(), getResultadosConJugadores()]).then(([evs, res]) => {
      setEventos(evs)
      setResultados(res)
      setLoading(false)
    })
  }, [])

  // Default: last event
  const lastEvento = useMemo(
    () => [...eventos].sort((a, b) => b.numero_evento - a.numero_evento)[0] ?? null,
    [eventos]
  )
  const [selectedEventoId, setSelectedEventoId] = useState<number | null>(null)

  const eventoActual = useMemo(() => {
    const id = selectedEventoId ?? lastEvento?.id
    return eventos.find(e => e.id === id) ?? lastEvento
  }, [selectedEventoId, lastEvento, eventos])

  // Resultados del evento seleccionado
  const resEvento = useMemo(() => {
    if (!eventoActual) return []
    return resultados.filter(r => r.partidas?.eventos?.id === eventoActual.id)
  }, [eventoActual, resultados])

  const partidasDelEvento = useMemo(() => {
    const pMap: Record<number, any> = {}
    for (const r of resEvento) {
      const p = r.partidas
      if (p && !pMap[p.id]) pMap[p.id] = p
    }
    return Object.values(pMap).sort((a, b) => a.numero_partida - b.numero_partida)
  }, [resEvento])

  // KPIs
  const jugadoresDistintos = useMemo(
    () => [...new Set(resEvento.map(r => r.jugadores?.nombre).filter(Boolean))],
    [resEvento]
  )

  // Detalle victorias
  const detalleVictorias = useMemo(() =>
    partidasDelEvento.map(p => {
      const resPart = resEvento.filter(r => r.partidas?.id === p.id)
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
    }),
    [partidasDelEvento, resEvento]
  )

  // Cluster bar: puntos por jugador por partida
  const playersEvento = useMemo(() => sortedPlayers(jugadoresDistintos), [jugadoresDistintos])

  const clusterData = useMemo(() =>
    partidasDelEvento.map(p => {
      const row: Record<string, number | string> = { partida: `P${p.numero_partida}` }
      playersEvento.forEach(j => { row[j] = 0 })
      resEvento
        .filter(r => r.partidas?.id === p.id)
        .forEach(r => { row[r.jugadores?.nombre] = r.puntos_totales })
      return row
    }),
    [partidasDelEvento, resEvento, playersEvento]
  )

  // Total puntos por jugador en el evento
  const totalPtsData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of resEvento) {
      const nombre = r.jugadores?.nombre
      if (!nombre) continue
      map[nombre] = (map[nombre] ?? 0) + r.puntos_totales
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([nombre, value]) => ({ nombre, value }))
  }, [resEvento])

  // ── Histórico de eventos ──────────────────────────────────
  const [filtroYears, setFiltroYears] = useState<number[]>([])
  const [filtroMeses, setFiltroMeses] = useState<number[]>([])

  const availableYears = useMemo(() =>
    [...new Set(eventos.map(e => new Date(e.fecha + 'T00:00:00').getFullYear()))].sort((a, b) => b - a),
    [eventos]
  )

  // Resumen por evento para la tabla histórico
  const resumenEventos = useMemo(() => {
    return [...eventos]
      .sort((a, b) => b.numero_evento - a.numero_evento)
      .map(ev => {
        const resEv = resultados.filter(r => r.partidas?.eventos?.id === ev.id)
        const jugadores = [...new Set(resEv.map(r => r.jugadores?.nombre).filter(Boolean))]
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
          fecha: ev.fecha,
          fechaDisplay: formatDate(ev.fecha),
          mes: fecha.getMonth(),
          year: fecha.getFullYear(),
          ubicacion: ev.ubicacion,
          jugadores,
          ganadores,
        }
      })
  }, [eventos, resultados])

  const historicFiltrado = useMemo(() => {
    return resumenEventos.filter(ev => {
      const okYear = filtroYears.length === 0 || filtroYears.includes(ev.year)
      const okMes = filtroMeses.length === 0 || filtroMeses.includes(ev.mes)
      return okYear && okMes
    })
  }, [resumenEventos, filtroYears, filtroMeses])

  function toggleYear(y: number) {
    setFiltroYears(prev => prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y])
  }
  function toggleMes(m: number) {
    setFiltroMeses(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  // ── Render ────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-white/70">Cargando eventos...</p>
    </div>
  )

  return (
    <div>
      <h1 className="page-title text-3xl font-bold mb-2">Eventos</h1>
      {eventoActual && (
        <p className="page-title text-lg font-semibold mb-6 opacity-80">
          Evento {eventoActual.numero_evento} — {formatDate(eventoActual.fecha)} — {eventoActual.ubicacion}
          {eventoActual.es_grand_slam && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ background: '#D4AC0D', color: '#5D3A00' }}>⭐ Grand Slam</span>
          )}
        </p>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard label="Partidas disputadas" value={partidasDelEvento.length} />
        <KpiCard label="Jugadores distintos" value={jugadoresDistintos.length} />
        <KpiCard label="Sede" value={eventoActual?.ubicacion ?? '—'} />
      </div>

      {/* Detalle de victorias */}
      {detalleVictorias.length > 0 && (
        <>
          <SectionTitle>Detalle de Victorias</SectionTitle>
          <div className="card p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#D6EAF8' }}>
                  {['Partida','Ganador','Pts Tablero','PV','Caminos','Ejércitos','Total'].map(h => (
                    <th key={h} className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: '#5D7A8A' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detalleVictorias.map((row, i) => (
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
        </>
      )}

      {/* Cluster bar: puntos por partida por jugador */}
      {clusterData.length > 0 && (
        <>
          <SectionTitle>Puntos por Partida</SectionTitle>
          <div className="card p-4">
            <ClusterBar
              data={clusterData}
              xKey="partida"
              players={playersEvento}
              height={320}
            />
          </div>
        </>
      )}

      {/* Total puntos por jugador en el evento */}
      {totalPtsData.length > 0 && (
        <>
          <SectionTitle>Puntos Totales en el Evento</SectionTitle>
          <div className="card p-4">
            <PlayerBar data={totalPtsData} label="Puntos totales" height={260} />
          </div>
        </>
      )}

      {/* ── HISTÓRICO DE EVENTOS ─────────────────────────── */}
      <SectionTitle>Histórico de Eventos</SectionTitle>

      {/* Filtros año/mes */}
      <div className="card p-4 mb-4">
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#5D7A8A' }}>Año</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setFiltroYears([])}
              className="px-3 py-1 rounded-full text-xs font-semibold border"
              style={{ background: filtroYears.length === 0 ? '#154E80' : '#EBF5FB', color: filtroYears.length === 0 ? '#fff' : '#5D7A8A', borderColor: '#AED6F1' }}>
              Todos
            </button>
            {availableYears.map(y => (
              <button key={y} onClick={() => toggleYear(y)}
                className="px-3 py-1 rounded-full text-xs font-semibold border"
                style={{ background: filtroYears.includes(y) ? '#154E80' : '#EBF5FB', color: filtroYears.includes(y) ? '#fff' : '#5D7A8A', borderColor: '#AED6F1' }}>
                {y}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#5D7A8A' }}>Mes</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setFiltroMeses([])}
              className="px-3 py-1 rounded-full text-xs font-semibold border"
              style={{ background: filtroMeses.length === 0 ? '#154E80' : '#EBF5FB', color: filtroMeses.length === 0 ? '#fff' : '#5D7A8A', borderColor: '#AED6F1' }}>
              Todos
            </button>
            {MESES_ES.map((m, i) => (
              <button key={m} onClick={() => toggleMes(i)}
                className="px-3 py-1 rounded-full text-xs font-semibold border capitalize"
                style={{ background: filtroMeses.includes(i) ? '#154E80' : '#EBF5FB', color: filtroMeses.includes(i) ? '#fff' : '#5D7A8A', borderColor: '#AED6F1' }}>
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#D6EAF8' }}>
              {['Nro','Fecha','Sede','Jugadores','Ganadores'].map(h => (
                <th key={h} className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: '#5D7A8A' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {historicFiltrado.map((ev, i) => (
              <tr
                key={ev.id}
                onClick={() => setSelectedEventoId(ev.id)}
                className="cursor-pointer transition-colors"
                style={{
                  background: ev.id === (selectedEventoId ?? lastEvento?.id)
                    ? '#BFD8F0'
                    : i % 2 === 0 ? '#EBF5FB' : '#D6EAF8',
                }}
              >
                <td className="px-4 py-3 font-bold" style={{ color: '#1A2F45' }}>{ev.numero_evento}</td>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: '#1A2F45' }}>{ev.fechaDisplay}</td>
                <td className="px-4 py-3" style={{ color: '#1A2F45' }}>{ev.ubicacion}</td>
                <td className="px-4 py-3 text-xs" style={{ color: '#5D7A8A' }}>{ev.jugadores.length}</td>
                <td className="px-4 py-3">
                  <GanadoresBadges ganadores={ev.ganadores} />
                </td>
              </tr>
            ))}
            {historicFiltrado.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center" style={{ color: '#5D7A8A' }}>
                  Sin eventos para el filtro seleccionado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
