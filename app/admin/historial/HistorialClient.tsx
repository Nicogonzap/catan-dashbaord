'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  getPartidasLista, getResultadosDePartida,
  getAuditDePartida, actualizarResultadosConAudit, revertirEdicion,
} from '@/lib/queries'

type PartidaLista = {
  id: number
  numero_partida: number
  fecha: string
  orden_turno: string[]
  eventos: { id: number; numero_evento: number; ubicacion: string } | null
  resultados: Array<{ id: number; rank_en_partida: number; jugadores: { nombre: string } | null }>
}

type ResultadoEditable = {
  id: number
  jugador_id: string
  jugador_nombre: string
  puntos_tablero: number
  puntos_pv: number
  ejercito_mas_grande: boolean
  camino_mas_largo: boolean
  puntos_totales: number
  rank_en_partida: number
  penalidad: number
}

function calcTotal(r: ResultadoEditable) {
  return r.puntos_tablero + r.puntos_pv + (r.ejercito_mas_grande ? 2 : 0) + (r.camino_mas_largo ? 2 : 0)
}

function calcRanks(rs: ResultadoEditable[]): number[] {
  const totals = rs.map(calcTotal)
  return totals.map(t => totals.filter(x => x > t).length + 1)
}

function formatFecha(fecha: string) {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatAuditDate(dt: string) {
  return new Date(dt).toLocaleString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function HistorialClient() {
  const router = useRouter()
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)

  const [partidas, setPartidas] = useState<PartidaLista[]>([])
  const [loadingPartidas, setLoadingPartidas] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [expandedResultados, setExpandedResultados] = useState<ResultadoEditable[]>([])
  const [editados, setEditados] = useState<ResultadoEditable[]>([])
  const [loadingExpanded, setLoadingExpanded] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensajeGuardado, setMensajeGuardado] = useState('')
  const [errorGuardado, setErrorGuardado] = useState('')

  const [auditTrail, setAuditTrail] = useState<any[]>([])
  const [showAudit, setShowAudit] = useState(false)
  const [revirtiendo, setRevirtiendo] = useState<number | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setAuthed(true)
        cargarPartidas()
      } else {
        router.push('/admin/login')
      }
      setChecking(false)
    })
  }, [router])

  async function cargarPartidas() {
    setLoadingPartidas(true)
    try {
      const data = await getPartidasLista()
      setPartidas(data as any)
    } catch (e: any) {
      console.error(e)
    }
    setLoadingPartidas(false)
  }

  async function expandirPartida(id: number) {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    setExpandedResultados([])
    setEditados([])
    setAuditTrail([])
    setShowAudit(false)
    setMensajeGuardado('')
    setErrorGuardado('')
    setLoadingExpanded(true)
    try {
      const [res, audit] = await Promise.all([
        getResultadosDePartida(id),
        getAuditDePartida(id),
      ])
      const mapped: ResultadoEditable[] = (res as any[]).map(r => ({
        id: r.id,
        jugador_id: r.jugador_id,
        jugador_nombre: r.jugadores?.nombre ?? '',
        puntos_tablero: r.puntos_tablero,
        puntos_pv: r.puntos_pv,
        ejercito_mas_grande: r.ejercito_mas_grande,
        camino_mas_largo: r.camino_mas_largo,
        puntos_totales: r.puntos_totales,
        rank_en_partida: r.rank_en_partida,
        penalidad: r.penalidad,
      }))
      setExpandedResultados(mapped)
      setEditados(JSON.parse(JSON.stringify(mapped)))
      setAuditTrail(audit)
    } catch (e: any) {
      console.error(e)
    }
    setLoadingExpanded(false)
  }

  function updateEditado(id: number, field: keyof ResultadoEditable, value: any) {
    setEditados(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, [field]: value } : r)
      const ranks = calcRanks(updated)
      return updated.map((r, i) => ({ ...r, puntos_totales: calcTotal(r), rank_en_partida: ranks[i] }))
    })
  }

  async function guardarEdicion() {
    if (!expandedId) return
    setGuardando(true)
    setMensajeGuardado('')
    setErrorGuardado('')
    try {
      const snapshotAnterior = expandedResultados.map(r => ({ ...r }))
      await actualizarResultadosConAudit(expandedId, editados, snapshotAnterior)
      setExpandedResultados(JSON.parse(JSON.stringify(editados)))
      const audit = await getAuditDePartida(expandedId)
      setAuditTrail(audit)
      // Update ganador in partidas list
      setPartidas(prev => prev.map(p => {
        if (p.id !== expandedId) return p
        return {
          ...p,
          resultados: editados.map(r => ({
            id: r.id,
            rank_en_partida: r.rank_en_partida,
            jugadores: { nombre: r.jugador_nombre },
          })),
        }
      }))
      setMensajeGuardado('✅ Cambios guardados correctamente')
    } catch (e: any) {
      setErrorGuardado('❌ ' + (e.message ?? 'Error al guardar'))
    }
    setGuardando(false)
  }

  async function revertir(audit: any, index: number) {
    if (!expandedId) return
    if (!confirm('¿Revertir a este estado? Se creará un nuevo registro de auditoría.')) return
    setRevirtiendo(index)
    try {
      const snapshotActual = expandedResultados.map(r => ({ ...r }))
      await revertirEdicion(audit.snapshot_anterior, expandedId, snapshotActual)
      const mapped: ResultadoEditable[] = audit.snapshot_anterior.map((r: any) => ({ ...r }))
      setExpandedResultados(mapped)
      setEditados(JSON.parse(JSON.stringify(mapped)))
      const newAudit = await getAuditDePartida(expandedId)
      setAuditTrail(newAudit)
      setMensajeGuardado('✅ Revertido correctamente')
    } catch (e: any) {
      setErrorGuardado('❌ ' + (e.message ?? 'Error al revertir'))
    }
    setRevirtiendo(null)
  }

  const partidasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return partidas
    return partidas.filter(p => {
      const ev = (p.eventos as any)
      const jugadores = ((p.resultados ?? []) as any[]).map((r: any) => r.jugadores?.nombre ?? '').join(' ')
      return (
        String(p.numero_partida).includes(q) ||
        String(ev?.numero_evento ?? '').includes(q) ||
        (ev?.ubicacion ?? '').toLowerCase().includes(q) ||
        p.fecha.includes(q) ||
        jugadores.toLowerCase().includes(q)
      )
    })
  }, [partidas, busqueda])

  if (checking) return <div className="text-center py-20 text-white/60">Verificando sesión...</div>
  if (!authed) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title text-3xl font-bold">Historial de Partidas</h1>
        <div className="flex gap-4">
          <a href="/admin/cargar" className="text-sm text-white/70 hover:text-white underline">← Cargar partida</a>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/admin/login'))}
            className="text-sm text-white/70 hover:text-white underline">
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Buscador */}
      <div className="card p-4 mb-4">
        <input
          type="text"
          placeholder="Buscar por jugador, evento, sede, fecha o número de partida..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="w-full rounded-lg border px-4 py-2 text-sm"
          style={{ borderColor: '#AED6F1', color: '#1A2F45' }}
        />
        <p className="text-xs mt-2" style={{ color: '#5D7A8A' }}>
          {loadingPartidas ? 'Cargando...' : `${partidasFiltradas.length} partida(s)`}
        </p>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {partidasFiltradas.map(p => {
          const ev = p.eventos as any
          const resultados = (p.resultados ?? []) as any[]
          const ganador = resultados.find((r: any) => r.rank_en_partida === 1)?.jugadores?.nombre ?? '—'
          const isExpanded = expandedId === p.id

          return (
            <div key={p.id}>
              {/* Fila resumen — clickeable */}
              <button
                onClick={() => expandirPartida(p.id)}
                className="w-full card p-4 text-left transition-all"
                style={{ background: isExpanded ? '#D6EAF8' : undefined }}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm" style={{ color: '#154E80' }}>
                      #{p.numero_partida}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: '#AED6F1', color: '#1A2F45' }}>
                      E{ev?.numero_evento ?? '?'}
                    </span>
                    <span className="text-sm font-medium" style={{ color: '#1A2F45' }}>
                      {formatFecha(p.fecha)}
                    </span>
                    <span className="text-xs" style={{ color: '#5D7A8A' }}>
                      {ev?.ubicacion ?? ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span style={{ color: '#5D7A8A' }}>
                      {resultados.map((r: any) => r.jugadores?.nombre ?? '').join(', ')}
                    </span>
                    <span className="font-bold px-2 py-0.5 rounded" style={{ background: '#D4AC0D', color: '#5D3A00' }}>
                      🏆 {ganador}
                    </span>
                    <span style={{ color: '#AED6F1' }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>
              </button>

              {/* Detalle expandido */}
              {isExpanded && (
                <div className="card p-6 mt-1 border-t-0" style={{ borderTop: 'none', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                  {loadingExpanded ? (
                    <p className="text-sm text-center py-4" style={{ color: '#5D7A8A' }}>Cargando resultados...</p>
                  ) : (
                    <>
                      {/* Tabla editable */}
                      <div className="overflow-x-auto mb-4">
                        <table className="w-full text-sm">
                          <thead>
                            <tr style={{ background: '#D6EAF8' }}>
                              {['Jugador','Pts Tablero','PV','Ejército','Camino','Penalidad','Total','Rank'].map(h => (
                                <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase" style={{ color: '#5D7A8A' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {editados.map((r, i) => {
                              const changed = JSON.stringify(r) !== JSON.stringify(expandedResultados[i])
                              return (
                                <tr key={r.id} style={{
                                  background: changed ? '#FEF9E7' : i % 2 === 0 ? '#EBF5FB' : '#D6EAF8',
                                }}>
                                  <td className="px-3 py-2 font-semibold" style={{ color: '#1A2F45' }}>
                                    {r.jugador_nombre}
                                    {changed && <span className="ml-1 text-xs" style={{ color: '#D4AC0D' }}>●</span>}
                                  </td>
                                  <td className="px-3 py-2">
                                    <input type="number" min={2} max={10} value={r.puntos_tablero}
                                      onChange={e => updateEditado(r.id, 'puntos_tablero', Number(e.target.value))}
                                      className="w-16 text-center rounded border px-2 py-1 text-sm"
                                      style={{ borderColor: '#AED6F1', color: '#1A2F45' }} />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input type="number" min={0} max={5} value={r.puntos_pv}
                                      onChange={e => updateEditado(r.id, 'puntos_pv', Number(e.target.value))}
                                      className="w-16 text-center rounded border px-2 py-1 text-sm"
                                      style={{ borderColor: '#AED6F1', color: '#1A2F45' }} />
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <input type="checkbox" checked={r.ejercito_mas_grande}
                                      onChange={e => updateEditado(r.id, 'ejercito_mas_grande', e.target.checked)}
                                      className="w-4 h-4" />
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <input type="checkbox" checked={r.camino_mas_largo}
                                      onChange={e => updateEditado(r.id, 'camino_mas_largo', e.target.checked)}
                                      className="w-4 h-4" />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input type="number" min={-5} max={0} value={r.penalidad}
                                      onChange={e => updateEditado(r.id, 'penalidad', Number(e.target.value))}
                                      className="w-16 text-center rounded border px-2 py-1 text-sm"
                                      style={{ borderColor: '#AED6F1', color: '#1A2F45' }} />
                                  </td>
                                  <td className="px-3 py-2 font-bold text-center" style={{ color: '#1A2F45' }}>
                                    {r.puntos_totales}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
                                      style={{
                                        background: r.rank_en_partida === 1 ? '#D4AC0D' : '#D6EAF8',
                                        color: r.rank_en_partida === 1 ? '#5D3A00' : '#5D7A8A',
                                      }}>
                                      {r.rank_en_partida}
                                    </span>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Feedback */}
                      {mensajeGuardado && (
                        <p className="text-sm mb-3" style={{ color: '#1E8449' }}>{mensajeGuardado}</p>
                      )}
                      {errorGuardado && (
                        <p className="text-sm mb-3" style={{ color: '#922B21' }}>{errorGuardado}</p>
                      )}

                      {/* Botones acción */}
                      <div className="flex gap-3 flex-wrap">
                        <button onClick={guardarEdicion} disabled={guardando}
                          className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50"
                          style={{ background: '#154E80' }}>
                          {guardando ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                        <button onClick={() => setEditados(JSON.parse(JSON.stringify(expandedResultados)))}
                          className="px-4 py-2 rounded-lg text-sm font-semibold border"
                          style={{ borderColor: '#AED6F1', color: '#5D7A8A' }}>
                          Descartar cambios
                        </button>
                        <button onClick={() => setShowAudit(v => !v)}
                          className="px-4 py-2 rounded-lg text-sm font-semibold border ml-auto"
                          style={{ borderColor: '#AED6F1', color: '#5D7A8A' }}>
                          {showAudit ? 'Ocultar historial' : `Ver historial de cambios (${auditTrail.length})`}
                        </button>
                      </div>

                      {/* Audit trail */}
                      {showAudit && (
                        <div className="mt-4">
                          <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#5D7A8A' }}>
                            Historial de cambios
                          </h3>
                          {auditTrail.length === 0 ? (
                            <p className="text-sm" style={{ color: '#5D7A8A' }}>Sin cambios registrados.</p>
                          ) : (
                            <div className="space-y-3">
                              {auditTrail.map((a, idx) => {
                                const antes = a.snapshot_anterior as any[]
                                const despues = a.snapshot_nuevo as any[]
                                const diffs = despues?.filter((r: any) => {
                                  const ant = antes?.find((x: any) => x.id === r.id)
                                  return ant && JSON.stringify(r) !== JSON.stringify(ant)
                                }) ?? []

                                return (
                                  <div key={a.id} className="rounded-lg border p-3" style={{ borderColor: '#AED6F1', background: '#EBF5FB' }}>
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-semibold" style={{ color: '#5D7A8A' }}>
                                        {formatAuditDate(a.editado_en)}
                                      </span>
                                      <button
                                        onClick={() => revertir(a, idx)}
                                        disabled={revirtiendo === idx}
                                        className="text-xs px-2 py-0.5 rounded border font-semibold disabled:opacity-50"
                                        style={{ borderColor: '#E74C3C', color: '#E74C3C' }}>
                                        {revirtiendo === idx ? 'Revirtiendo...' : 'Revertir a este estado'}
                                      </button>
                                    </div>
                                    {diffs.length > 0 ? (
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr>
                                            <th className="text-left pr-3 pb-1" style={{ color: '#5D7A8A' }}>Jugador</th>
                                            <th className="text-left pr-3 pb-1" style={{ color: '#5D7A8A' }}>Campo</th>
                                            <th className="text-left pr-3 pb-1" style={{ color: '#C0392B' }}>Antes</th>
                                            <th className="text-left pb-1" style={{ color: '#1E8449' }}>Después</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {diffs.flatMap((r: any) => {
                                            const ant = antes?.find((x: any) => x.id === r.id)
                                            if (!ant) return []
                                            const campos = ['puntos_tablero','puntos_pv','ejercito_mas_grande','camino_mas_largo','puntos_totales','rank_en_partida','penalidad'] as const
                                            return campos.filter(c => r[c] !== ant[c]).map(c => (
                                              <tr key={`${r.id}-${c}`}>
                                                <td className="pr-3 py-0.5 font-semibold" style={{ color: '#1A2F45' }}>
                                                  {r.jugador_nombre ?? ant.jugador_nombre}
                                                </td>
                                                <td className="pr-3 py-0.5" style={{ color: '#5D7A8A' }}>{c}</td>
                                                <td className="pr-3 py-0.5 font-mono" style={{ color: '#C0392B' }}>
                                                  {String(ant[c])}
                                                </td>
                                                <td className="py-0.5 font-mono" style={{ color: '#1E8449' }}>
                                                  {String(r[c])}
                                                </td>
                                              </tr>
                                            ))
                                          })}
                                        </tbody>
                                      </table>
                                    ) : (
                                      <p className="text-xs" style={{ color: '#5D7A8A' }}>Revert (sin diferencias detectadas)</p>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {!loadingPartidas && partidasFiltradas.length === 0 && (
          <div className="card p-8 text-center" style={{ color: '#5D7A8A' }}>
            No se encontraron partidas con ese criterio.
          </div>
        )}
      </div>
    </div>
  )
}
