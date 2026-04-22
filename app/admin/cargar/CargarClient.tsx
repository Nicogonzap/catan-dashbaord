'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  insertEvento, insertPartida, insertResultados,
  getPartidasDeEvento, getUltimoNumeroPartida,
} from '@/lib/queries'
import { isGrandSlam } from '@/lib/metrics'

interface Jugador { id: string; nombre: string; es_miembro_oficial: boolean }
interface Evento { id: number; numero_evento: number; fecha: string; ubicacion: string }
interface ResultadoForm {
  jugador_id: string; nombre: string
  puntos_tablero: number; puntos_pv: number
  ejercito_mas_grande: boolean; camino_mas_largo: boolean
}
interface PartidaResumen {
  id: number; numero_partida: number; fecha: string
  es_grand_slam: boolean; total_jugadores: number
  resultados: Array<{ rank_en_partida: number; puntos_totales: number; jugadores: { nombre: string } | null }>
}

interface Props {
  jugadores: Jugador[]
  ultimaPartida: number
  ubicaciones: string[]
  eventos: Evento[]
  ultimoEvento: Evento | null
}

function calcTotal(r: ResultadoForm) {
  return r.puntos_tablero + r.puntos_pv + (r.ejercito_mas_grande ? 2 : 0) + (r.camino_mas_largo ? 2 : 0)
}

// Tie only matters when 2+ players reach the 10-point winning threshold
function hasTiePrimero(resultados: ResultadoForm[]): boolean {
  const totals = resultados.map(calcTotal)
  if (totals.length === 0) return false
  const max = Math.max(...totals)
  if (max !== 10) return false
  return totals.filter(t => t === max).length > 1
}

function calcRanks(resultados: ResultadoForm[], ganadorManualId: string | null): number[] {
  const totals = resultados.map(calcTotal)
  if (totals.length === 0) return []
  const max = Math.max(...totals)
  const tie = totals.filter(t => t === max).length > 1

  return resultados.map((r, i) => {
    if (tie && ganadorManualId) {
      if (r.jugador_id === ganadorManualId) return 1
      if (totals[i] === max) return 2
    }
    return totals.filter(t => t > totals[i]).length + 1
  })
}

function formatFecha(f: string) {
  return new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

// ─── Formulario de nueva partida ──────────────────────────────────────────────
function PartidaForm({
  jugadoresList, onGuardar, onCancelar, numeroPartida,
}: {
  jugadoresList: Jugador[]
  onGuardar: (data: {
    resultados: ResultadoForm[]; ordenTurno: string[]; ganadorManual: string | null
  }) => Promise<void>
  onCancelar: () => void
  numeroPartida: number
}) {
  const [jugadoresSeleccionados, setJugadoresSeleccionados] = useState<string[]>([])
  const [resultados, setResultados] = useState<ResultadoForm[]>([])
  const [ordenTurno, setOrdenTurno] = useState<string[]>([])
  const [ganadorManual, setGanadorManual] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // Nuevo jugador inline
  const [showNuevo, setShowNuevo] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoEsMiembro, setNuevoEsMiembro] = useState(false)
  const [creandoJugador, setCreandoJugador] = useState(false)
  const [listaLocal, setListaLocal] = useState(jugadoresList)

  async function crearJugador() {
    if (!nuevoNombre.trim()) return
    setCreandoJugador(true)
    const { data, error } = await supabase
      .from('jugadores')
      .insert({ nombre: nuevoNombre.trim(), es_miembro_oficial: nuevoEsMiembro, activo: true })
      .select().single()
    if (error) { alert(error.message); setCreandoJugador(false); return }
    setListaLocal(prev => [...prev, data as Jugador].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setNuevoNombre(''); setNuevoEsMiembro(false); setShowNuevo(false); setCreandoJugador(false)
  }

  function toggleJugador(jId: string) {
    const sel = jugadoresSeleccionados.includes(jId)
    let next: string[]
    if (sel) {
      next = jugadoresSeleccionados.filter(id => id !== jId)
    } else {
      if (jugadoresSeleccionados.length >= 6) return
      next = [...jugadoresSeleccionados, jId]
    }
    setJugadoresSeleccionados(next)
    const nuevosRes = next.map(id => {
      const jug = listaLocal.find(j => j.id === id)!
      return resultados.find(r => r.jugador_id === id) ?? {
        jugador_id: id, nombre: jug.nombre,
        puntos_tablero: 2, puntos_pv: 0,
        ejercito_mas_grande: false, camino_mas_largo: false,
      }
    })
    setResultados(nuevosRes)
    const nombres = next.map(id => listaLocal.find(j => j.id === id)?.nombre ?? '')
    setOrdenTurno(ot => ot.filter(n => nombres.includes(n)))
    if (ganadorManual && !next.includes(ganadorManual)) setGanadorManual(null)
  }

  function toggleOrden(nombre: string) {
    setOrdenTurno(ot => ot.includes(nombre) ? ot.filter(n => n !== nombre) : [...ot, nombre])
  }

  function updateResultado(jId: string, field: keyof ResultadoForm, value: any) {
    setResultados(prev => prev.map(r => r.jugador_id === jId ? { ...r, [field]: value } : r))
  }

  const grandSlam = isGrandSlam(resultados.map(r => r.nombre))
  const hayEmpate = hasTiePrimero(resultados)

  async function handleGuardar() {
    setError('')
    if (resultados.length < 4) { setError('Mínimo 4 jugadores'); return }
    if (hayEmpate && !ganadorManual) { setError('Hay empate en 10 puntos — seleccioná el ganador'); return }
    setGuardando(true)
    try {
      await onGuardar({ resultados, ordenTurno, ganadorManual })
    } catch (e: any) {
      setError(e.message ?? 'Error desconocido')
    }
    setGuardando(false)
  }

  const ranks = calcRanks(resultados, ganadorManual)

  return (
    <div className="card p-5 border-2" style={{ borderColor: '#2E86C1' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-base" style={{ color: '#1A2F45' }}>
          Nueva Partida #{numeroPartida}
          {grandSlam && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#D4AC0D', color: '#5D3A00' }}>
              ⭐ Grand Slam
            </span>
          )}
        </h3>
        <button type="button" onClick={onCancelar} className="text-xs" style={{ color: '#5D7A8A' }}>✕ Cancelar</button>
      </div>

      {/* Selector de jugadores */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#5D7A8A' }}>Jugadores (4-6)</label>
          <button type="button" onClick={() => setShowNuevo(v => !v)}
            className="px-2 py-0.5 rounded text-xs border" style={{ borderColor: '#AED6F1', color: '#5D7A8A' }}>
            + Nuevo jugador
          </button>
        </div>

        {showNuevo && (
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
            <button type="button" onClick={crearJugador} disabled={creandoJugador || !nuevoNombre.trim()}
              className="px-3 py-1 rounded text-sm font-semibold text-white disabled:opacity-50" style={{ background: '#154E80' }}>
              {creandoJugador ? 'Creando...' : 'Crear'}
            </button>
            <button type="button" onClick={() => setShowNuevo(false)}
              className="px-2 py-1 rounded text-xs border" style={{ borderColor: '#AED6F1', color: '#5D7A8A' }}>
              Cancelar
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {listaLocal.map(j => {
            const sel = jugadoresSeleccionados.includes(j.id)
            return (
              <button key={j.id} type="button" onClick={() => toggleJugador(j.id)}
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

      {/* Orden de turno */}
      {resultados.length >= 2 && (
        <div className="mb-4">
          <label className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{ color: '#5D7A8A' }}>
            Orden de Turno — clickeá en orden (1° = quien empieza)
          </label>
          <div className="flex flex-wrap gap-2">
            {resultados.map(r => {
              const idx = ordenTurno.indexOf(r.nombre)
              return (
                <button key={r.jugador_id} type="button" onClick={() => toggleOrden(r.nombre)}
                  className="px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-all"
                  style={{
                    background: idx >= 0 ? '#154E80' : '#EBF5FB',
                    color: idx >= 0 ? '#fff' : '#1A2F45',
                    borderColor: '#AED6F1',
                  }}>
                  {idx >= 0 ? `${idx + 1}. ` : ''}{r.nombre}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Empate en 10 */}
      {hayEmpate && (() => {
        const totals = resultados.map(calcTotal)
        const empatados = resultados.filter((_, i) => totals[i] === 10)
        return (
          <div className="mb-4 p-3 rounded-lg border" style={{ borderColor: '#D4AC0D', background: '#FEF9E7' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: '#5D3A00' }}>
              ⚡ Empate en 10 puntos — seleccioná el ganador:
            </p>
            <div className="flex flex-wrap gap-2">
              {empatados.map(r => (
                <button key={r.jugador_id} type="button"
                  onClick={() => setGanadorManual(prev => prev === r.jugador_id ? null : r.jugador_id)}
                  className="px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-all"
                  style={{
                    background: ganadorManual === r.jugador_id ? '#D4AC0D' : '#EBF5FB',
                    color: ganadorManual === r.jugador_id ? '#5D3A00' : '#1A2F45',
                    borderColor: '#D4AC0D',
                  }}>
                  {ganadorManual === r.jugador_id ? '🏆 ' : ''}{r.nombre}
                </button>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Tabla de puntuación */}
      {resultados.length > 0 && (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#D6EAF8' }}>
                {['Orden', 'Jugador', 'Pts Tablero', 'PV', 'Ejército', 'Camino', 'Total', 'Rank'].map(h => (
                  <th key={h} className="px-3 py-2 text-xs font-semibold uppercase text-left" style={{ color: '#5D7A8A' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resultados.map((r, rIdx) => {
                const turnoPos = ordenTurno.indexOf(r.nombre)
                return (
                  <tr key={r.jugador_id} style={{ background: rIdx % 2 === 0 ? '#EBF5FB' : '#D6EAF8' }}>
                    <td className="px-3 py-2 text-center">
                      {turnoPos >= 0
                        ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold" style={{ background: '#AED6F1', color: '#1A2F45' }}>{turnoPos + 1}</span>
                        : <span className="text-xs" style={{ color: '#AED6F1' }}>—</span>}
                    </td>
                    <td className="px-3 py-2 font-semibold" style={{ color: '#1A2F45' }}>{r.nombre}</td>
                    <td className="px-3 py-2">
                      <input type="number" min={2} max={10} value={r.puntos_tablero}
                        onChange={e => updateResultado(r.jugador_id, 'puntos_tablero', Number(e.target.value))}
                        className="w-16 text-center rounded border px-2 py-1 text-sm" style={{ borderColor: '#AED6F1', color: '#1A2F45' }} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min={0} max={5} value={r.puntos_pv}
                        onChange={e => updateResultado(r.jugador_id, 'puntos_pv', Number(e.target.value))}
                        className="w-16 text-center rounded border px-2 py-1 text-sm" style={{ borderColor: '#AED6F1', color: '#1A2F45' }} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={r.ejercito_mas_grande}
                        onChange={e => updateResultado(r.jugador_id, 'ejercito_mas_grande', e.target.checked)} className="w-4 h-4" />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={r.camino_mas_largo}
                        onChange={e => updateResultado(r.jugador_id, 'camino_mas_largo', e.target.checked)} className="w-4 h-4" />
                    </td>
                    <td className="px-3 py-2 font-bold text-center" style={{ color: '#1A2F45' }}>{calcTotal(r)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
                        style={{ background: ranks[rIdx] === 1 ? '#D4AC0D' : '#D6EAF8', color: ranks[rIdx] === 1 ? '#5D3A00' : '#5D7A8A' }}>
                        {ranks[rIdx]}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {error && <p className="text-sm mb-3" style={{ color: '#e74c3c' }}>❌ {error}</p>}

      <button type="button" onClick={handleGuardar} disabled={guardando || resultados.length < 4}
        className="w-full rounded-lg py-2.5 px-6 font-bold text-white disabled:opacity-50 transition-opacity"
        style={{ background: '#154E80' }}>
        {guardando ? 'Guardando...' : 'Guardar partida'}
      </button>
    </div>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function CargarClient({ jugadores, ultimaPartida: ultimaPartidaInicial, ubicaciones, eventos, ultimoEvento }: Props) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)

  const [eventoActivo, setEventoActivo] = useState<Evento | null>(null)
  const [partidasDeEvento, setPartidasDeEvento] = useState<PartidaResumen[]>([])
  const [loadingPartidas, setLoadingPartidas] = useState(false)
  const [proximaPartida, setProximaPartida] = useState(ultimaPartidaInicial + 1)

  const [showNuevoEvento, setShowNuevoEvento] = useState(false)
  const [showNuevaPartida, setShowNuevaPartida] = useState(false)
  const [mensajeExito, setMensajeExito] = useState('')

  // Nuevo evento form
  const [neNumero, setNeNumero] = useState((eventos[0]?.numero_evento ?? 0) + 1)
  const [neFecha, setNeFecha] = useState(new Date().toISOString().split('T')[0])
  const [neUbicacion, setNeUbicacion] = useState(ubicaciones[0] ?? '')
  const [neNuevaUbic, setNeNuevaUbic] = useState('')
  const [neUseNueva, setNeUseNueva] = useState(false)
  const [creandoEvento, setCreandoEvento] = useState(false)
  const [errorEvento, setErrorEvento] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setAuthed(true)
      else router.push('/admin/login')
      setChecking(false)
    })
  }, [router])

  async function seleccionarEvento(evento: Evento) {
    setEventoActivo(evento)
    setShowNuevoEvento(false)
    setShowNuevaPartida(false)
    setMensajeExito('')
    setLoadingPartidas(true)
    try {
      const partidas = await getPartidasDeEvento(evento.id)
      setPartidasDeEvento(partidas as unknown as PartidaResumen[])
    } catch (e: any) {
      alert(e.message)
    }
    setLoadingPartidas(false)
    // Re-fetch latest partida number
    const last = await getUltimoNumeroPartida()
    setProximaPartida(last + 1)
  }

  async function crearEvento() {
    setErrorEvento('')
    setCreandoEvento(true)
    try {
      const ev = await insertEvento({
        numero_evento: neNumero,
        fecha: neFecha,
        ubicacion: neUseNueva ? neNuevaUbic.trim() : neUbicacion,
      })
      await seleccionarEvento(ev as Evento)
      setShowNuevoEvento(false)
    } catch (e: any) {
      setErrorEvento(e.message ?? 'Error al crear evento')
    }
    setCreandoEvento(false)
  }

  async function guardarPartida({ resultados, ordenTurno, ganadorManual }: {
    resultados: ResultadoForm[]; ordenTurno: string[]; ganadorManual: string | null
  }) {
    if (!eventoActivo) return
    const totals = resultados.map(calcTotal)
    const ranks = calcRanks(resultados, ganadorManual)
    const grandSlam = isGrandSlam(resultados.map(r => r.nombre))

    const lastNum = await getUltimoNumeroPartida()
    const nextNum = lastNum + 1

    const partida = await insertPartida({
      numero_partida: nextNum,
      evento_id: eventoActivo.id,
      fecha: eventoActivo.fecha,
      total_jugadores: resultados.length,
      es_grand_slam: grandSlam,
      orden_turno: ordenTurno,
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

    // Refresh partidas list
    const updated = await getPartidasDeEvento(eventoActivo.id)
    setPartidasDeEvento(updated as unknown as PartidaResumen[])
    setProximaPartida(nextNum + 1)
    setShowNuevaPartida(false)
    setMensajeExito(`✅ Partida #${nextNum} guardada`)
    setTimeout(() => setMensajeExito(''), 4000)
  }

  if (checking) return <div className="page-title text-center py-20">Verificando sesión...</div>
  if (!authed) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title text-3xl font-bold">Cargar Partida</h1>
        <button onClick={() => supabase.auth.signOut().then(() => router.push('/admin/login'))}
          className="text-sm text-white/70 hover:text-white underline">
          Cerrar sesión
        </button>
      </div>

      {/* ── Sección de evento ── */}
      {!eventoActivo ? (
        <div className="space-y-4">
          {/* Último evento */}
          {ultimoEvento && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#5D7A8A' }}>
                Último evento registrado
              </p>
              <button
                type="button"
                onClick={() => seleccionarEvento(ultimoEvento)}
                className="w-full text-left card p-5 hover:shadow-md transition-shadow border-2"
                style={{ borderColor: '#AED6F1' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xl font-bold" style={{ color: '#154E80' }}>Evento #{ultimoEvento.numero_evento}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: '#EBF5FB', color: '#154E80' }}>
                        {ultimoEvento.ubicacion}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: '#5D7A8A' }}>{formatFecha(ultimoEvento.fecha)}</p>
                  </div>
                  <span className="text-sm font-semibold shrink-0" style={{ color: '#154E80' }}>Seleccionar →</span>
                </div>
              </button>
            </div>
          )}

          {/* Otros eventos */}
          {eventos.length > 1 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#5D7A8A' }}>
                Seleccionar otro evento
              </p>
              <div className="flex flex-wrap gap-2">
                {eventos.slice(1).map(ev => (
                  <button key={ev.id} type="button" onClick={() => seleccionarEvento(ev)}
                    className="px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-all"
                    style={{ borderColor: '#AED6F1', background: '#EBF5FB', color: '#1A2F45' }}>
                    #{ev.numero_evento} — {ev.ubicacion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Crear nuevo evento */}
          {!showNuevoEvento ? (
            <button type="button" onClick={() => setShowNuevoEvento(true)}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold border-2 transition-all"
              style={{ borderColor: '#AED6F1', background: '#EBF5FB', color: '#154E80' }}>
              + Crear nuevo evento
            </button>
          ) : (
            <div className="card p-5 border-2" style={{ borderColor: '#2E86C1' }}>
              <h3 className="font-bold mb-4" style={{ color: '#1A2F45' }}>Nuevo Evento</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: '#5D7A8A' }}>Número de evento</label>
                  <input type="number" value={neNumero} onChange={e => setNeNumero(Number(e.target.value))} min={1}
                    className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#AED6F1', color: '#1A2F45' }} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: '#5D7A8A' }}>Fecha</label>
                  <input type="date" value={neFecha} onChange={e => setNeFecha(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#AED6F1', color: '#1A2F45' }} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: '#5D7A8A' }}>Ubicación</label>
                  {!neUseNueva ? (
                    <div className="flex gap-2">
                      <select value={neUbicacion} onChange={e => setNeUbicacion(e.target.value)}
                        className="flex-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#AED6F1', color: '#1A2F45' }}>
                        {ubicaciones.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <button type="button" onClick={() => setNeUseNueva(true)}
                        className="px-2 py-1 rounded text-xs border" style={{ borderColor: '#AED6F1', color: '#5D7A8A' }}>+ Nueva</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input type="text" value={neNuevaUbic} onChange={e => setNeNuevaUbic(e.target.value)}
                        placeholder="Ej: Gallo, Costa..." required
                        className="flex-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#AED6F1', color: '#1A2F45' }} />
                      <button type="button" onClick={() => setNeUseNueva(false)}
                        className="px-2 py-1 rounded text-xs border" style={{ borderColor: '#AED6F1', color: '#5D7A8A' }}>✕</button>
                    </div>
                  )}
                </div>
              </div>
              {errorEvento && <p className="text-sm mb-3" style={{ color: '#e74c3c' }}>❌ {errorEvento}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={crearEvento} disabled={creandoEvento}
                  className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: '#154E80' }}>
                  {creandoEvento ? 'Creando...' : 'Crear evento'}
                </button>
                <button type="button" onClick={() => setShowNuevoEvento(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: '#EBF5FB', color: '#5D7A8A' }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Evento activo ── */
        <div>
          {/* Header del evento */}
          <div className="card p-4 mb-5 flex items-start justify-between gap-4" style={{ borderLeft: '4px solid #154E80' }}>
            <div>
              <div className="flex items-center gap-3 mb-0.5">
                <span className="text-xl font-bold" style={{ color: '#154E80' }}>Evento #{eventoActivo.numero_evento}</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: '#EBF5FB', color: '#154E80' }}>
                  {eventoActivo.ubicacion}
                </span>
              </div>
              <p className="text-sm" style={{ color: '#5D7A8A' }}>
                {formatFecha(eventoActivo.fecha)} · {partidasDeEvento.length} partida{partidasDeEvento.length !== 1 ? 's' : ''} registrada{partidasDeEvento.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button type="button" onClick={() => { setEventoActivo(null); setShowNuevaPartida(false) }}
              className="text-xs shrink-0" style={{ color: '#5D7A8A' }}>
              ← Cambiar evento
            </button>
          </div>

          {/* Mensaje de éxito */}
          {mensajeExito && (
            <div className="card p-3 mb-4" style={{ background: '#D5F5E3', borderColor: '#27AE60' }}>
              <p className="text-sm" style={{ color: '#1E8449' }}>{mensajeExito}</p>
            </div>
          )}

          {/* Botón nueva partida */}
          {!showNuevaPartida && (
            <button type="button" onClick={() => setShowNuevaPartida(true)}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white mb-5 transition-opacity"
              style={{ background: '#154E80' }}>
              + Nueva partida
            </button>
          )}

          {/* Formulario de nueva partida */}
          {showNuevaPartida && (
            <div className="mb-5">
              <PartidaForm
                jugadoresList={jugadores}
                numeroPartida={proximaPartida}
                onGuardar={guardarPartida}
                onCancelar={() => setShowNuevaPartida(false)}
              />
            </div>
          )}

          {/* Partidas ya registradas */}
          {loadingPartidas ? (
            <p className="text-sm py-4" style={{ color: '#5D7A8A' }}>Cargando partidas...</p>
          ) : partidasDeEvento.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#5D7A8A' }}>
                Partidas del evento
              </p>
              <div className="space-y-3">
                {[...partidasDeEvento].reverse().map(p => {
                  const ganador = p.resultados.find(r => r.rank_en_partida === 1)
                  const sorted = [...p.resultados].sort((a, b) => a.rank_en_partida - b.rank_en_partida)
                  return (
                    <div key={p.id} className="card p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-sm" style={{ color: '#1A2F45' }}>Partida #{p.numero_partida}</span>
                        {p.es_grand_slam && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#D4AC0D', color: '#5D3A00' }}>⭐ GS</span>
                        )}
                        <span className="text-xs" style={{ color: '#5D7A8A' }}>{p.total_jugadores} jugadores</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {sorted.map(r => (
                          <span key={r.jugadores?.nombre} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                            style={{
                              background: r.rank_en_partida === 1 ? '#FEF9E7' : '#EBF5FB',
                              color: r.rank_en_partida === 1 ? '#5D3A00' : '#1A2F45',
                            }}>
                            {MEDAL[r.rank_en_partida] ?? `#${r.rank_en_partida}`} {r.jugadores?.nombre} ({r.puntos_totales}pts)
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm" style={{ color: '#5D7A8A' }}>Todavía no hay partidas cargadas para este evento.</p>
          )}
        </div>
      )}
    </div>
  )
}
