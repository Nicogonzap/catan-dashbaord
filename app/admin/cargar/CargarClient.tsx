'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { insertEvento, insertPartida, insertResultados } from '@/lib/queries'
import { isGrandSlam } from '@/lib/metrics'

interface Jugador { id: string; nombre: string; es_miembro_oficial: boolean }

interface ResultadoForm {
  jugador_id: string
  nombre: string
  puntos_tablero: number
  puntos_pv: number
  ejercito_mas_grande: boolean
  camino_mas_largo: boolean
}

interface Props {
  jugadores: Jugador[]
  sugeridoEvento: number
  ultimaPartida: number
  ubicaciones: string[]
}

function calcTotal(r: ResultadoForm) {
  return r.puntos_tablero + r.puntos_pv + (r.ejercito_mas_grande ? 2 : 0) + (r.camino_mas_largo ? 2 : 0)
}

function calcRanks(resultados: ResultadoForm[]): number[] {
  const totals = resultados.map(calcTotal)
  return totals.map(t => totals.filter(x => x > t).length + 1)
}

export default function CargarClient({ jugadores: jugadoresIniciales, sugeridoEvento, ultimaPartida, ubicaciones }: Props) {
  const router = useRouter()
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [jugadoresList, setJugadoresList] = useState<Jugador[]>(jugadoresIniciales)

  // Form state
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [numeroEvento, setNumeroEvento] = useState(sugeridoEvento)
  const [ubicacion, setUbicacion] = useState(ubicaciones[0] ?? '')
  const [nuevaUbicacion, setNuevaUbicacion] = useState('')
  const [useNuevaUbic, setUseNuevaUbic] = useState(false)
  const [ordenTurnos, setOrdenTurnos] = useState<string[][]>([[]])
  const [partidas, setPartidas] = useState<ResultadoForm[][]>([[]])
  const [jugadoresSeleccionados, setJugadoresSeleccionados] = useState<string[][]>([[]])
  const [loading, setLoading] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  // Nuevo jugador inline
  const [showNuevoJugador, setShowNuevoJugador] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoEsMiembro, setNuevoEsMiembro] = useState(false)
  const [creandoJugador, setCreandoJugador] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setAuthed(true)
      else router.push('/admin/login')
      setChecking(false)
    })
  }, [router])

  if (checking) return <div className="page-title text-center py-20">Verificando sesión...</div>
  if (!authed) return null

  const ubicacionFinal = useNuevaUbic ? nuevaUbicacion : ubicacion

  async function crearJugador() {
    if (!nuevoNombre.trim()) return
    setCreandoJugador(true)
    const { data, error } = await supabase
      .from('jugadores')
      .insert({ nombre: nuevoNombre.trim(), es_miembro_oficial: nuevoEsMiembro, activo: true })
      .select().single()
    if (error) { alert(error.message); setCreandoJugador(false); return }
    setJugadoresList(prev => [...prev, data as Jugador].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setNuevoNombre('')
    setNuevoEsMiembro(false)
    setShowNuevoJugador(false)
    setCreandoJugador(false)
  }

  function agregarPartida() {
    setPartidas(prev => [...prev, []])
    setJugadoresSeleccionados(prev => [...prev, []])
    setOrdenTurnos(prev => [...prev, []])
  }

  function setOrdenTurnoPartida(pIdx: number, nombre: string) {
    setOrdenTurnos(prev => prev.map((ot, i) => {
      if (i !== pIdx) return ot
      return ot.includes(nombre) ? ot.filter(n => n !== nombre) : [...ot, nombre]
    }))
  }

  function setJugadoresDePartida(pIdx: number, seleccionados: string[]) {
    const nuevosResultados = seleccionados.map(jId => {
      const jug = jugadoresList.find(j => j.id === jId)!
      const prev = partidas[pIdx]?.find(r => r.jugador_id === jId)
      return prev ?? {
        jugador_id: jId, nombre: jug.nombre,
        puntos_tablero: 2, puntos_pv: 0,
        ejercito_mas_grande: false, camino_mas_largo: false,
      }
    })
    setPartidas(prev => prev.map((p, i) => i === pIdx ? nuevosResultados : p))
    setJugadoresSeleccionados(prev => prev.map((p, i) => i === pIdx ? seleccionados : p))
    // Remove deselected players from orden
    setOrdenTurnos(prev => prev.map((ot, i) => {
      if (i !== pIdx) return ot
      const nombres = seleccionados.map(id => jugadoresList.find(j => j.id === id)?.nombre ?? '')
      return ot.filter(n => nombres.includes(n))
    }))
  }

  function updateResultado(pIdx: number, jId: string, field: keyof ResultadoForm, value: any) {
    setPartidas(prev => prev.map((p, i) => {
      if (i !== pIdx) return p
      return p.map(r => r.jugador_id === jId ? { ...r, [field]: value } : r)
    }))
  }

  function grandSlamDePartida(pIdx: number) {
    return isGrandSlam(partidas[pIdx].map(r => r.nombre))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMensaje('')

    try {
      const { data: existingEvento } = await supabase
        .from('eventos').select('id').eq('numero_evento', numeroEvento).single()

      let eventoId: number
      if (existingEvento) {
        eventoId = existingEvento.id
      } else {
        const ev = await insertEvento({ numero_evento: numeroEvento, fecha, ubicacion: ubicacionFinal })
        eventoId = ev.id
      }

      let nextPartida = ultimaPartida + 1
      for (const [pIdx, resultados] of partidas.entries()) {
        if (resultados.length < 4) throw new Error(`Partida ${pIdx + 1}: mínimo 4 jugadores`)
        const totals = resultados.map(calcTotal)
        const ranks = calcRanks(resultados)

        const sortedTotals = [...totals].sort((a, b) => b - a)
        if (sortedTotals[0] === sortedTotals[1])
          throw new Error(`Partida ${pIdx + 1}: hay empate en el primer lugar. Resolvé manualmente el rank.`)

        const partida = await insertPartida({
          numero_partida: nextPartida++,
          evento_id: eventoId,
          fecha,
          total_jugadores: resultados.length,
          es_grand_slam: grandSlamDePartida(pIdx),
          orden_turno: ordenTurnos[pIdx] ?? [],
        })

        await insertResultados(resultados.map((r, i) => ({
          partida_id: partida.id,
          jugador_id: r.jugador_id,
          puntos_tablero: r.puntos_tablero,
          puntos_pv: r.puntos_pv,
          ejercito_mas_grande: r.ejercito_mas_grande,
          camino_mas_largo: r.camino_mas_largo,
          puntos_totales: totals[i],
          rank_en_partida: ranks[i],
          penalidad: 0,
        })))
      }

      setMensaje(`✅ Evento ${numeroEvento} cargado con ${partidas.length} partida(s)`)
      setPartidas([[]])
      setJugadoresSeleccionados([[]])
      setOrdenTurnos([[]])
    } catch (err: any) {
      setError(err.message ?? 'Error desconocido')
    }
    setLoading(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title text-3xl font-bold">Cargar Partida</h1>
        <div className="flex items-center gap-4">
          <a href="/admin/historial" className="text-sm text-white/70 hover:text-white underline">
            Historial de partidas
          </a>
          <button
            onClick={() => supabase.auth.signOut().then(() => router.push('/admin/login'))}
            className="text-sm text-white/70 hover:text-white underline"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Datos del evento */}
        <div className="card p-6 mb-6">
          <h2 className="text-lg font-bold mb-4" style={{ color: '#1A2F45' }}>Datos del Evento</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: '#5D7A8A' }}>Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} required
                className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#AED6F1', color: '#1A2F45' }} />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: '#5D7A8A' }}>Número de Evento</label>
              <input type="number" value={numeroEvento} onChange={e => setNumeroEvento(Number(e.target.value))} required min={1}
                className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#AED6F1', color: '#1A2F45' }} />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: '#5D7A8A' }}>Ubicación</label>
              {!useNuevaUbic ? (
                <div className="flex gap-2">
                  <select value={ubicacion} onChange={e => setUbicacion(e.target.value)}
                    className="flex-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#AED6F1', color: '#1A2F45' }}>
                    {ubicaciones.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <button type="button" onClick={() => setUseNuevaUbic(true)}
                    className="px-2 py-1 rounded-lg text-xs border" style={{ borderColor: '#AED6F1', color: '#5D7A8A' }}>
                    + Nueva
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input type="text" value={nuevaUbicacion} onChange={e => setNuevaUbicacion(e.target.value)}
                    placeholder="Ej: Gallo, Costa..." required
                    className="flex-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#AED6F1', color: '#1A2F45' }} />
                  <button type="button" onClick={() => setUseNuevaUbic(false)}
                    className="px-2 py-1 rounded-lg text-xs border" style={{ borderColor: '#AED6F1', color: '#5D7A8A' }}>
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Partidas */}
        {partidas.map((resultados, pIdx) => {
          const ordenActual = ordenTurnos[pIdx] ?? []
          const jugadoresEnPartida = resultados.map(r => r.nombre)

          return (
            <div key={pIdx} className="card p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold" style={{ color: '#1A2F45' }}>
                  Partida {pIdx + 1}
                  {grandSlamDePartida(pIdx) && (
                    <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#D4AC0D', color: '#5D3A00' }}>
                      ⭐ Grand Slam
                    </span>
                  )}
                </h2>
              </div>

              {/* Selección jugadores */}
              <div className="mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#5D7A8A' }}>
                    Jugadores (4-6)
                  </label>
                  <button type="button" onClick={() => setShowNuevoJugador(v => !v)}
                    className="px-2 py-0.5 rounded text-xs border" style={{ borderColor: '#AED6F1', color: '#5D7A8A' }}>
                    + Nuevo jugador
                  </button>
                </div>

                {showNuevoJugador && (
                  <div className="mb-3 p-3 rounded-lg border flex flex-wrap gap-3 items-end"
                    style={{ borderColor: '#AED6F1', background: '#EBF5FB' }}>
                    <div>
                      <label className="text-xs font-semibold block mb-1" style={{ color: '#5D7A8A' }}>Nombre</label>
                      <input type="text" value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
                        placeholder="Ej: Rodrigo"
                        className="rounded border px-2 py-1 text-sm" style={{ borderColor: '#AED6F1', color: '#1A2F45' }} />
                    </div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer" style={{ color: '#5D7A8A' }}>
                      <input type="checkbox" checked={nuevoEsMiembro} onChange={e => setNuevoEsMiembro(e.target.checked)} />
                      Miembro oficial
                    </label>
                    <button type="button" onClick={crearJugador}
                      disabled={creandoJugador || !nuevoNombre.trim()}
                      className="px-3 py-1 rounded text-sm font-semibold text-white disabled:opacity-50"
                      style={{ background: '#154E80' }}>
                      {creandoJugador ? 'Creando...' : 'Crear'}
                    </button>
                    <button type="button" onClick={() => setShowNuevoJugador(false)}
                      className="px-2 py-1 rounded text-xs border" style={{ borderColor: '#AED6F1', color: '#5D7A8A' }}>
                      Cancelar
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {jugadoresList.map(j => {
                    const sel = jugadoresSeleccionados[pIdx]?.includes(j.id)
                    return (
                      <button key={j.id} type="button"
                        onClick={() => {
                          const current = jugadoresSeleccionados[pIdx] ?? []
                          if (sel) setJugadoresDePartida(pIdx, current.filter(id => id !== j.id))
                          else if (current.length < 6) setJugadoresDePartida(pIdx, [...current, j.id])
                        }}
                        className="px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-all"
                        style={{
                          background: sel ? '#154E80' : '#EBF5FB',
                          color: sel ? '#fff' : '#1A2F45',
                          borderColor: '#AED6F1',
                        }}>
                        {j.nombre}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Orden de turno (por partida) */}
              {jugadoresEnPartida.length >= 2 && (
                <div className="mb-4">
                  <label className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{ color: '#5D7A8A' }}>
                    Orden de Turno — clickeá en orden (1° = quien empieza)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {jugadoresEnPartida.map(nombre => {
                      const idx = ordenActual.indexOf(nombre)
                      return (
                        <button key={nombre} type="button"
                          onClick={() => setOrdenTurnoPartida(pIdx, nombre)}
                          className="px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-all"
                          style={{
                            background: idx >= 0 ? '#154E80' : '#EBF5FB',
                            color: idx >= 0 ? '#fff' : '#1A2F45',
                            borderColor: '#AED6F1',
                          }}>
                          {idx >= 0 ? `${idx + 1}. ` : ''}{nombre}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Tabla de puntuación */}
              {resultados.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: '#D6EAF8' }}>
                        {['Orden','Jugador','Pts Tablero','PV','Ejército','Camino','Total','Rank'].map(h => (
                          <th key={h} className="px-3 py-2 text-xs font-semibold uppercase text-left" style={{ color: '#5D7A8A' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const ranks = calcRanks(resultados)
                        return resultados.map((r, rIdx) => {
                          const turnoPos = ordenActual.indexOf(r.nombre)
                          return (
                            <tr key={r.jugador_id} style={{ background: rIdx % 2 === 0 ? '#EBF5FB' : '#D6EAF8' }}>
                              <td className="px-3 py-2 text-center">
                                {turnoPos >= 0 ? (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                                    style={{ background: '#AED6F1', color: '#1A2F45' }}>
                                    {turnoPos + 1}
                                  </span>
                                ) : (
                                  <span className="text-xs" style={{ color: '#AED6F1' }}>—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 font-semibold" style={{ color: '#1A2F45' }}>{r.nombre}</td>
                              <td className="px-3 py-2">
                                <input type="number" min={2} max={10} value={r.puntos_tablero}
                                  onChange={e => updateResultado(pIdx, r.jugador_id, 'puntos_tablero', Number(e.target.value))}
                                  className="w-16 text-center rounded border px-2 py-1 text-sm"
                                  style={{ borderColor: '#AED6F1', color: '#1A2F45' }} />
                              </td>
                              <td className="px-3 py-2">
                                <input type="number" min={0} max={5} value={r.puntos_pv}
                                  onChange={e => updateResultado(pIdx, r.jugador_id, 'puntos_pv', Number(e.target.value))}
                                  className="w-16 text-center rounded border px-2 py-1 text-sm"
                                  style={{ borderColor: '#AED6F1', color: '#1A2F45' }} />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input type="checkbox" checked={r.ejercito_mas_grande}
                                  onChange={e => updateResultado(pIdx, r.jugador_id, 'ejercito_mas_grande', e.target.checked)}
                                  className="w-4 h-4" />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input type="checkbox" checked={r.camino_mas_largo}
                                  onChange={e => updateResultado(pIdx, r.jugador_id, 'camino_mas_largo', e.target.checked)}
                                  className="w-4 h-4" />
                              </td>
                              <td className="px-3 py-2 font-bold text-center" style={{ color: '#1A2F45' }}>
                                {calcTotal(r)}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
                                  style={{
                                    background: ranks[rIdx] === 1 ? '#D4AC0D' : '#D6EAF8',
                                    color: ranks[rIdx] === 1 ? '#5D3A00' : '#5D7A8A',
                                  }}>
                                  {ranks[rIdx]}
                                </span>
                              </td>
                            </tr>
                          )
                        })
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}

        <div className="flex gap-3 mb-6">
          <button type="button" onClick={agregarPartida}
            className="px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all"
            style={{ borderColor: '#AED6F1', color: '#1A2F45', background: '#EBF5FB' }}>
            + Agregar Partida
          </button>
        </div>

        {error && (
          <div className="card p-4 mb-4" style={{ background: '#FADBD8', borderColor: '#E74C3C' }}>
            <p className="text-sm" style={{ color: '#922B21' }}>❌ {error}</p>
          </div>
        )}
        {mensaje && (
          <div className="card p-4 mb-4" style={{ background: '#D5F5E3', borderColor: '#27AE60' }}>
            <p className="text-sm" style={{ color: '#1E8449' }}>{mensaje}</p>
          </div>
        )}

        <button type="submit" disabled={loading}
          className="w-full rounded-lg py-3 px-6 font-bold text-white text-lg transition-opacity disabled:opacity-60"
          style={{ background: '#154E80' }}>
          {loading ? 'Guardando...' : 'Guardar Evento'}
        </button>
      </form>
    </div>
  )
}
