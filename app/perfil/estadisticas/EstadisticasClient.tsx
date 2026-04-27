'use client'
import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { playerColor } from '@/lib/colors'
import { getResultadosConJugadores, getEstadisticasJugadores, getPerfilUsuario } from '@/lib/queries'
import SectionTitle from '@/components/metrics/SectionTitle'

const YEARS = [2024, 2025, 2026]
const CURRENT_YEAR = 2026
const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

function StackedBar({ segments }: { segments: { pct: number; color: string; label: string }[] }) {
  return (
    <div>
      <div className="flex rounded-full overflow-hidden h-4 w-full">
        {segments.filter(s => s.pct > 0).map(s => (
          <div key={s.label} style={{ width: `${s.pct}%`, background: s.color }} title={`${s.label}: ${s.pct}%`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
        {segments.filter(s => s.pct > 0).map(s => (
          <span key={s.label} className="text-xs flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: s.color }} />
            <span style={{ color: '#5D7A8A' }}>{s.label}</span>
            <span className="font-bold" style={{ color: '#1A2F45' }}>{s.pct}%</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-left" style={{ color: '#5D7A8A' }}>{children}</th>
}
function Td({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return <td className={`px-4 py-2.5 ${center ? 'text-center' : ''}`} style={{ color: '#1A2F45' }}>{children}</td>
}

export default function EstadisticasClient() {
  const [stats, setStats] = useState<any[]>([])
  const [resultados, setResultados] = useState<any[]>([])
  const [miJugadorNombre, setMiJugadorNombre] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getEstadisticasJugadores(),
      getResultadosConJugadores(),
      getPerfilUsuario(),
    ]).then(([st, res, perfil]) => {
      setStats(st)
      setResultados(res)
      setMiJugadorNombre(perfil?.jugadores?.nombre ?? null)
      setLoading(false)
    })
  }, [])

  // Current year victories for ordering the dropdown
  const vicsPorJugador2026 = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of resultados) {
      const fecha = r.partidas?.fecha
      if (!fecha) continue
      if (new Date(fecha + 'T12:00:00').getFullYear() !== CURRENT_YEAR) continue
      if (r.rank_en_partida === 1) {
        const n = r.jugadores?.nombre
        if (n) map[n] = (map[n] ?? 0) + 1
      }
    }
    return map
  }, [resultados])

  // All players, ordered: logged-in first, then by current year victories DESC
  const jugadores = useMemo(() => {
    const all = [...new Set(resultados.map((r: any) => r.jugadores?.nombre).filter(Boolean))] as string[]
    return all.sort((a, b) => {
      if (a === miJugadorNombre) return -1
      if (b === miJugadorNombre) return 1
      return (vicsPorJugador2026[b] ?? 0) - (vicsPorJugador2026[a] ?? 0)
    })
  }, [resultados, miJugadorNombre, vicsPorJugador2026])

  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)

  // Pre-select logged-in player once loaded
  useEffect(() => {
    if (miJugadorNombre && selectedPlayer === null) {
      setSelectedPlayer(miJugadorNombre)
    }
  }, [miJugadorNombre, selectedPlayer])

  const yearStats = useMemo(() => {
    if (!selectedPlayer) return null
    const totalPartidas: Record<number, Set<number>> = {}
    const statsPorAno: Record<number, { partidas: number; victorias: number }> = {}
    const vicsPorJugadorAno: Record<number, Record<string, number>> = {}

    for (const r of resultados) {
      const fecha = r.partidas?.fecha
      if (!fecha) continue
      const ano = new Date(fecha + 'T12:00:00').getFullYear()
      if (!totalPartidas[ano]) totalPartidas[ano] = new Set()
      totalPartidas[ano].add(r.partida_id)
      const nombre = r.jugadores?.nombre
      if (!nombre) continue
      if (!vicsPorJugadorAno[ano]) vicsPorJugadorAno[ano] = {}
      if (!vicsPorJugadorAno[ano][nombre]) vicsPorJugadorAno[ano][nombre] = 0
      if (r.rank_en_partida === 1) vicsPorJugadorAno[ano][nombre]++
      if (nombre === selectedPlayer) {
        if (!statsPorAno[ano]) statsPorAno[ano] = { partidas: 0, victorias: 0 }
        statsPorAno[ano].partidas++
        if (r.rank_en_partida === 1) statsPorAno[ano].victorias++
      }
    }

    return YEARS.map(ano => {
      const total = totalPartidas[ano]?.size ?? 0
      const s = statsPorAno[ano] ?? { partidas: 0, victorias: 0 }
      const sorted = Object.entries(vicsPorJugadorAno[ano] ?? {}).sort((a, b) => b[1] - a[1])
      const pos = sorted.findIndex(([n]) => n === selectedPlayer) + 1
      return {
        ano, totalPartidas: total, partidas: s.partidas, victorias: s.victorias,
        pctAsistencia: total > 0 ? Math.round(s.partidas / total * 100) : 0,
        pctVictorias: s.partidas > 0 ? Math.round(s.victorias / s.partidas * 100) : 0,
        ranking: pos > 0 && s.partidas > 0 ? pos : null,
      }
    })
  }, [selectedPlayer, resultados])

  const yearTotal = useMemo(() => {
    if (!yearStats) return null
    const partidas = yearStats.reduce((a, b) => a + b.partidas, 0)
    const victorias = yearStats.reduce((a, b) => a + b.victorias, 0)
    const totalP = yearStats.reduce((a, b) => a + b.totalPartidas, 0)
    return {
      partidas, victorias,
      pctAsistencia: totalP > 0 ? Math.round(partidas / totalP * 100) : 0,
      pctVictorias: partidas > 0 ? Math.round(victorias / partidas * 100) : 0,
    }
  }, [yearStats])

  const recursosData = useMemo(() => {
    if (!selectedPlayer) return null
    const compute = (rs: any[]) => {
      const resJ = rs.filter((r: any) => r.jugadores?.nombre === selectedPlayer)
      const cEj = resJ.filter((r: any) => r.ejercito_mas_grande).length
      const vEj = resJ.filter((r: any) => r.ejercito_mas_grande && r.rank_en_partida === 1).length
      const cCa = resJ.filter((r: any) => r.camino_mas_largo).length
      const vCa = resJ.filter((r: any) => r.camino_mas_largo && r.rank_en_partida === 1).length
      return {
        ejercito: { count: cEj, wins: vEj, pct: cEj > 0 ? Math.round(vEj / cEj * 100) : 0 },
        camino: { count: cCa, wins: vCa, pct: cCa > 0 ? Math.round(vCa / cCa * 100) : 0 },
      }
    }
    const byYear = Object.fromEntries(YEARS.map(ano => [
      ano,
      compute(resultados.filter((r: any) => {
        const fecha = r.partidas?.fecha
        return fecha && new Date(fecha + 'T12:00:00').getFullYear() === ano
      })),
    ]))
    return { total: compute(resultados), ...byYear }
  }, [selectedPlayer, resultados])

  const manoAMano = useMemo(() => {
    if (!selectedPlayer) return []
    const porPartida: Record<number, { jugadores: string[]; ganador: string | null }> = {}
    for (const r of resultados) {
      if (!porPartida[r.partida_id]) porPartida[r.partida_id] = { jugadores: [], ganador: null }
      const nombre = r.jugadores?.nombre
      if (nombre) {
        porPartida[r.partida_id].jugadores.push(nombre)
        if (r.rank_en_partida === 1) porPartida[r.partida_id].ganador = nombre
      }
    }
    return jugadores
      .filter(j => j !== selectedPlayer)
      .map(otro => {
        const shared = Object.values(porPartida).filter(p =>
          p.jugadores.includes(selectedPlayer!) && p.jugadores.includes(otro)
        )
        const ganadas = shared.filter(p => p.ganador === selectedPlayer).length
        const ganadoOtro = shared.filter(p => p.ganador === otro).length
        return { jugador: otro, total: shared.length, ganadas, ganadoOtro }
      })
      .sort((a, b) => b.total - a.total)
  }, [selectedPlayer, resultados, jugadores])

  const posicionFavorita = useMemo(() => {
    if (!selectedPlayer) return []
    const por: Record<number, { partidas: number; victorias: number }> = {}
    for (const r of resultados) {
      if (r.jugadores?.nombre !== selectedPlayer) continue
      const ot = r.partidas?.orden_turno
      if (!Array.isArray(ot) || ot.length === 0) continue
      const pos = ot.indexOf(selectedPlayer) + 1
      if (pos === 0) continue
      if (!por[pos]) por[pos] = { partidas: 0, victorias: 0 }
      por[pos].partidas++
      if (r.rank_en_partida === 1) por[pos].victorias++
    }
    return Object.entries(por)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([pos, d]) => ({ posicion: Number(pos), ...d, pct: d.partidas > 0 ? Math.round(d.victorias / d.partidas * 100) : 0 }))
  }, [selectedPlayer, resultados])

  const victoriaTipica = useMemo(() => {
    if (!selectedPlayer) return null
    const wins = resultados.filter((r: any) => r.jugadores?.nombre === selectedPlayer && r.rank_en_partida === 1)
    if (!wins.length) return null
    const totales = wins.reduce(
      (acc: any, r: any) => ({
        tablero: acc.tablero + r.puntos_tablero,
        pv: acc.pv + r.puntos_pv,
        ejercito: acc.ejercito + (r.ejercito_mas_grande ? 2 : 0),
        camino: acc.camino + (r.camino_mas_largo ? 2 : 0),
      }),
      { tablero: 0, pv: 0, ejercito: 0, camino: 0 }
    )
    const total = totales.tablero + totales.pv + totales.ejercito + totales.camino
    const promedio = Math.round(wins.reduce((a: number, r: any) => a + r.puntos_totales, 0) / wins.length * 10) / 10
    if (total === 0) return null
    return {
      tablero: Math.round(totales.tablero / total * 100),
      pv: Math.round(totales.pv / total * 100),
      ejercito: Math.round(totales.ejercito / total * 100),
      camino: Math.round(totales.camino / total * 100),
      promedio, count: wins.length,
    }
  }, [selectedPlayer, resultados])

  if (loading) return <p className="text-center py-20 text-white/70">Cargando...</p>

  const color = selectedPlayer ? playerColor(selectedPlayer) : '#154E80'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/perfil" className="text-white/60 hover:text-white text-sm">← Mi perfil</Link>
          <h1 className="page-title text-3xl font-bold">Mis Estadísticas</h1>
        </div>
        <Link
          href="/perfil/participacion"
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ background: '#EBF5FB', color: '#1A2F45' }}
        >
          Ver participación
        </Link>
      </div>

      {/* Selector de jugador */}
      <div className="card p-4 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#5D7A8A' }}>
          Seleccioná un jugador
        </p>
        <div className="flex flex-wrap gap-2">
          {jugadores.map(j => (
            <button
              key={j}
              onClick={() => setSelectedPlayer(prev => prev === j ? null : j)}
              className="px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all relative"
              style={{
                background: selectedPlayer === j ? playerColor(j) : '#EBF5FB',
                color: selectedPlayer === j ? '#fff' : '#1A2F45',
                borderColor: selectedPlayer === j ? playerColor(j) : '#AED6F1',
              }}
            >
              {j}
              {j === miJugadorNombre && (
                <span className="absolute -top-1.5 -right-1 text-xs px-1 rounded" style={{ background: '#D4AC0D', color: '#5D3A00' }}>yo</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {selectedPlayer && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-4 h-4 rounded-full" style={{ background: color }} />
            <h2 className="text-2xl font-bold" style={{ color: '#EBF5FB' }}>{selectedPlayer}</h2>
          </div>

          <SectionTitle>Rendimiento por Año</SectionTitle>
          <div className="card p-0 overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#D6EAF8' }}>
                  <Th>Año</Th><Th>Posición</Th><Th>Partidas</Th><Th>Victorias</Th><Th>% Asistencia</Th><Th>% Victorias</Th>
                </tr>
              </thead>
              <tbody>
                {yearStats?.map((s, i) => (
                  <tr key={s.ano} style={{ background: i % 2 === 0 ? '#EBF5FB' : '#D6EAF8' }}>
                    <Td><span className="font-bold">{s.ano}</span></Td>
                    <Td center>{s.ranking ? <span className="font-bold">{MEDAL[s.ranking] ?? `#${s.ranking}`}</span> : <span style={{ color: '#AED6F1' }}>—</span>}</Td>
                    <Td center>{s.partidas > 0 ? s.partidas : <span style={{ color: '#AED6F1' }}>—</span>}</Td>
                    <Td center>{s.victorias > 0 ? <span className="font-bold">{s.victorias}</span> : <span style={{ color: '#AED6F1' }}>—</span>}</Td>
                    <Td center>
                      {s.partidas > 0 ? (
                        <span className={s.pctAsistencia >= 50 ? 'font-semibold' : ''} style={{ color: s.pctAsistencia >= 50 ? '#1E8449' : '#C0392B' }}>
                          {s.pctAsistencia}%
                        </span>
                      ) : <span style={{ color: '#AED6F1' }}>—</span>}
                    </Td>
                    <Td center>{s.partidas > 0 ? `${s.pctVictorias}%` : <span style={{ color: '#AED6F1' }}>—</span>}</Td>
                  </tr>
                ))}
                {yearTotal && (
                  <tr style={{ background: '#AED6F1' }}>
                    <Td><span className="font-bold">Total</span></Td>
                    <Td center>—</Td>
                    <Td center><span className="font-bold">{yearTotal.partidas}</span></Td>
                    <Td center><span className="font-bold">{yearTotal.victorias}</span></Td>
                    <Td center><span className="font-bold">{yearTotal.pctAsistencia}%</span></Td>
                    <Td center><span className="font-bold">{yearTotal.pctVictorias}%</span></Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <SectionTitle>Efectividad en el Uso de Recursos</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {(['ejercito', 'camino'] as const).map(recurso => (
              <div key={recurso} className="card p-0 overflow-x-auto">
                <div className="px-4 py-2 font-bold text-sm" style={{ background: recurso === 'ejercito' ? '#C0392B' : '#27AE60', color: '#fff' }}>
                  {recurso === 'ejercito' ? '⚔️ Ejército Más Grande' : '🛤️ Camino Más Largo'}
                </div>
                <table className="w-full text-sm">
                  <thead><tr style={{ background: '#D6EAF8' }}><Th>Período</Th><Th>Veces</Th><Th>Victorias</Th><Th>Efectividad</Th></tr></thead>
                  <tbody>
                    {(['total', ...YEARS] as const).map((key, i) => {
                      const d = (recursosData as any)?.[key]?.[recurso]
                      if (!d) return null
                      return (
                        <tr key={String(key)} style={{ background: i % 2 === 0 ? '#EBF5FB' : '#D6EAF8' }}>
                          <Td><span className={key === 'total' ? 'font-bold' : ''}>{key === 'total' ? 'Total' : key}</span></Td>
                          <Td center>{d.count}</Td>
                          <Td center>{d.wins}</Td>
                          <Td center>
                            <span className="font-bold" style={{ color: d.pct >= 50 ? '#1E8449' : d.pct >= 30 ? '#D4AC0D' : '#C0392B' }}>
                              {d.count > 0 ? `${d.pct}%` : '—'}
                            </span>
                          </Td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          <SectionTitle>Mano a Mano</SectionTitle>
          <div className="card p-0 overflow-hidden mb-6">
            {manoAMano.map((m, i) => {
              const pctSel  = m.total > 0 ? Math.round(m.ganadas / m.total * 100) : 0
              const pctOtro = m.total > 0 ? Math.round(m.ganadoOtro / m.total * 100) : 0
              const pctOtros = Math.max(0, 100 - pctSel - pctOtro)
              return (
                <div key={m.jugador} className="px-4 py-3" style={{ background: i % 2 === 0 ? '#EBF5FB' : '#D6EAF8', borderBottom: '1px solid #AED6F1' }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: playerColor(m.jugador) }} />
                    <span className="font-semibold text-sm" style={{ color: '#1A2F45' }}>{m.jugador}</span>
                    <span className="text-xs ml-auto" style={{ color: '#5D7A8A' }}>{m.total} partidas juntos</span>
                  </div>
                  {m.total > 0 ? (
                    <>
                      <div className="flex rounded-sm overflow-hidden h-4 w-full mb-1">
                        {pctSel > 0 && <div style={{ width: `${pctSel}%`, background: color }} />}
                        {pctOtro > 0 && <div style={{ width: `${pctOtro}%`, background: playerColor(m.jugador) }} />}
                        {pctOtros > 0 && <div style={{ flex: 1, background: '#AED6F1' }} />}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                        <span><span className="font-bold" style={{ color }}>{pctSel}%</span><span style={{ color: '#5D7A8A' }}> {selectedPlayer} ({m.ganadas})</span></span>
                        <span><span className="font-bold" style={{ color: playerColor(m.jugador) }}>{pctOtro}%</span><span style={{ color: '#5D7A8A' }}> {m.jugador} ({m.ganadoOtro})</span></span>
                        {pctOtros > 0 && <span><span className="font-bold" style={{ color: '#5D7A8A' }}>{pctOtros}%</span><span style={{ color: '#5D7A8A' }}> otros</span></span>}
                      </div>
                    </>
                  ) : <p className="text-xs" style={{ color: '#AED6F1' }}>Sin partidas juntos</p>}
                </div>
              )
            })}
          </div>

          <SectionTitle>Posición Favorita</SectionTitle>
          {posicionFavorita.length === 0 ? (
            <div className="card p-4 mb-6"><p className="text-sm" style={{ color: '#5D7A8A' }}>Sin datos de orden de turno disponibles.</p></div>
          ) : (
            <div className="card p-0 overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead><tr style={{ background: '#D6EAF8' }}><Th>Posición de Turno</Th><Th>Partidas</Th><Th>Victorias</Th><Th>% Victorias</Th></tr></thead>
                <tbody>
                  {posicionFavorita.map((p, i) => (
                    <tr key={p.posicion} style={{ background: i % 2 === 0 ? '#EBF5FB' : '#D6EAF8' }}>
                      <Td>
                        <span className="font-bold">{p.posicion}°</span>
                        {p.pct === Math.max(...posicionFavorita.map(x => x.pct)) && posicionFavorita.length > 1 && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: '#D4AC0D', color: '#5D3A00' }}>fav</span>
                        )}
                      </Td>
                      <Td center>{p.partidas}</Td>
                      <Td center>{p.victorias}</Td>
                      <Td center><span className="font-bold" style={{ color: p.pct >= 30 ? '#1E8449' : '#1A2F45' }}>{p.pct}%</span></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {victoriaTipica && (
            <>
              <SectionTitle>Composición de la Victoria Típica</SectionTitle>
              <div className="card p-4 mb-6">
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-xs" style={{ color: '#5D7A8A' }}>Basado en <strong style={{ color: '#1A2F45' }}>{victoriaTipica.count}</strong> victorias</span>
                  <span className="text-xs" style={{ color: '#5D7A8A' }}>Promedio al ganar: <strong style={{ color: '#1A2F45' }}>{victoriaTipica.promedio}</strong></span>
                </div>
                <StackedBar segments={[
                  { pct: victoriaTipica.tablero, color: '#2471A3', label: 'Tablero' },
                  { pct: victoriaTipica.pv, color: '#D4AC0D', label: 'PV' },
                  { pct: victoriaTipica.ejercito, color: '#C0392B', label: 'Ejército' },
                  { pct: victoriaTipica.camino, color: '#27AE60', label: 'Camino' },
                ]} />
              </div>
            </>
          )}
        </div>
      )}

      <SectionTitle>Uso de Recursos — Todos los Jugadores</SectionTitle>
      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#D6EAF8' }}>
              {['Jugador','Victorias','Partidas','Caminos','Ejército','PV','Pts Prom.'].map(h => (
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
    </div>
  )
}
