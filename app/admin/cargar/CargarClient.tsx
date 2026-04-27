'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  insertEvento, insertPartida, insertResultados,
  getPartidasDeEvento, getUltimoNumeroPartida, getUltimosEventos,
} from '@/lib/queries'
import { isGrandSlam } from '@/lib/metrics'
import { MIEMBROS_OFICIALES } from '@/lib/colors'

interface Jugador { id: string; nombre: string; es_miembro_oficial: boolean }
interface EventoConConteo { id: number; numero_evento: number; fecha: string; ubicacion: string; partidas_count: number }
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
  ubicaciones: string[]
  conteoJugadores: Record<string, { partidas: number; victorias: number }>
}

function calcTotal(r: ResultadoForm) {
  return r.puntos_tablero + r.puntos_pv + (r.ejercito_mas_grande ? 2 : 0) + (r.camino_mas_largo ? 2 : 0)
}

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

// ─── Tarjeta de evento ─────────────────────────────────────────────────────────
function EventoCard({ evento, onSelect }: { evento: EventoConConteo; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left card p-4 hover:shadow-lg transition-shadow border-2"
      style={{ borderColor: '#AED6F1' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold" style={{ color: '#154E80' }}>Evento #{evento.numero_evento}</span>
          </div>
          <p className="text-xs mb-1" style={{ color: '#5D7A8A' }}>
            {formatFecha(evento.fecha)}
          </p>
          <div className="flex gap-3 text-xs" style={{ color: '#5D7A8A' }}>
            <span>Sede: <strong style={{ color: '#1A2F45' }}>{evento.ubicacion}</strong></span>
            <span>·</span>
            <span><strong style={{ color: '#1A2F45' }}>{evento.partidas_count}</strong> partida{evento.partidas_count !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <span className="text-sm font-semibold shrink-0 mt-1" style={{ color: '#154E80' }}>Seleccionar →</span>
      </div>
    </button>
  )
}

// ─── Formulario de nueva partida ───────────────────────────────────────────────
function PartidaForm({
  tier1, tier2, tier3, onGuardar, onCancelar, numeroPartida,
}: {
  tier1: Jugador[]
  tier2: Jugador[]
  tier3: Jugador[]
  onGuardar: (data: { resultados: ResultadoForm[]; ordenTurno: string[]; ganadorManual: string | null }) => Promise<void>
  onCancelar: () => void
  numeroPartida: number
}) {
  const [jugadoresSeleccionados, setJugadoresSeleccionados] = useState<string[]>([])
  const [resultados, setResultados] = useState<ResultadoForm[]>([])
  const [ordenTurno, setOrdenTurno] = useState<string[]>([])
  const [ganadorManual, setGanadorManual] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const [showResto, setShowResto] = useState(false)
  const [showNuevo, setShowNuevo] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoEsMiembro, setNuevoEsMiembro] = useState(false)
  const [creandoJugador, setCreandoJugador] = useState(false)
  const [tier3Local, setTier3Local] = useState(tier3)

  async function crearJugador() {
    if (!nuevoNombre.trim()) return
    setCreandoJugador(true)
    const { data, error } = await supabase
      .from('jugadores')
      .insert({ nombre: nuevoNombre.trim(), es_miembro_oficial: nuevoEsMiembro, activo: true })
      .select().single()
    if (error) { alert(error.message); setCreandoJugador(false); return }
    const nuevo = data as Jugador
    setTier3Local(prev => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setShowResto(true)
    setNuevoNombre(''); setNuevoEsMiembro(false); setShowNuevo(false); setCreandoJugador(false)
  }

  const allVisible = [...tier1, ...tier2, ...(showResto ? tier3Local : [])]

  function toggleJugador(jId: string, nombreJug: string) {
    const sel = jugadoresSeleccionados.includes(jId)
    let next: string[]
    if (sel) {
      next = jugadoresSeleccionados.filter(id => id !== jId)
    } else {
      if (jugadoresSeleccionados.length >= 6) return
      next = [...jugadoresSeleccionados, jId]
    }
    setJugadoresSeleccionados(next)
    const allJ = [...tier1, ...tier2, ...tier3Local]
    const nuevosRes = next.map(id => {
      const jug = allJ.find(j => j.id === id)!
      return resultados.find(r => r.jugador_id === id) ?? {
        jugador_id: id, nombre: jug.nombre,
        puntos_tablero: 2, puntos_pv: 0,
        ejercito_mas_grande: false, camino_mas_largo: false,
      }
    })
    setResultados(nuevosRes)
    const nombresNext = next.map(id => allJ.find(j => j.id === id)?.nombre ?? '')
    setOrdenTurno(ot => ot.filter(n => nombresNext.includes(n)))
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
  const ranks = calcRanks(resultados, ganadorManual)

  async function handleGuardar() {
    setError('')
    if (resultados.length < 4) { setError('Mínimo 4 jugadores'); return }
    if (hayEmpate && !ganadorManual) { setError('Hay empate en 10 puntos — seleccioná el ganador'); return }
    setGuardando(true)
    try { await onGuardar({ resultados, ordenTurno, ganadorManual }) }
    catch (e: any) { setError(e.message ?? 'Error desconocido') }
    setGuardando(false)
  }

  function PlayerButton({ j }: { j: Jugador }) {
    const sel = jugadoresSeleccionados.includes(j.id)
    return (
      <button type="button" onClick={() => toggleJugador(j.id, j.nombre)}
        className="px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-all"
        style={{
          background: sel ? '#154E80' : '#EBF5FB',
          color: sel ? '#fff' : '#1A2F45',
          borderColor: '#AED6F1',
        }}>
        {j.nombre}
      </button>
    )
  }

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
        <label className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{ color: '#5D7A8A' }}>
          Jugadores (4-6)
        </label>

        {/* Tier 1: 6 oficiales */}
        <div className="flex flex-wrap gap-2 mb-2">
          {tier1.map(j => <PlayerButton key={j.id} j={j} />)}
        </div>

        {/* Tier 2: 3 más frecuentes no-oficiales */}
        {tier2.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {tier2.map(j => <PlayerButton key={j.id} j={j} />)}
          </div>
        )}

        {/* Tier 3: resto de jugadores registrados */}
        {!showResto ? (
          <button type="button" onClick={() => setShowResto(true)}
            className="px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-all"
            style={{ borderColor: '#AED6F1', background: '#EBF5FB', color: '#5D7A8A' }}>
            + Otro jugador ya registrado
          </button>
        ) : (
          <div className="flex flex-wrap gap-2 mb-2">
            {tier3Local.map(j => <PlayerButton key={j.id} j={j} />)}
          </div>
        )}

        {/* Nuevo jugador */}
        <div className="mt-2">
          {!showNuevo ? (
            <button type="button" onClick={() => setShowNuevo(true)}
              className="px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-all"
              style={{ borderColor: '#AED6F1', background: '#EBF5FB', color: '#5D7A8A' }}>
              + Nuevo jugador
            </button>
          ) : (
            <div className="p-3 rounded-lg border flex flex-wrap gap-3 items-end"
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
export default function CargarClient({ jugadores, ubicaciones, conteoJugadores }: Props) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)

  const [ultimosEventos, setUltimosEventos] = useState<EventoConConteo[]>([])
  const [loadingEventos, setLoadingEventos] = useState(true)
  const [eventoActivo, setEventoActivo] = useState<EventoConConteo | null>(null)
  const [partidasDeEvento, setPartidasDeEvento] = useState<PartidaResumen[]>([])
  const [loadingPartidas, setLoadingPartidas] = useState(false)
  const [proximaPartida, setProximaPartida] = useState(1)

  const [showNuevoEvento, setShowNuevoEvento] = useState(false)
  const [showNuevaPartida, setShowNuevaPartida] = useState(false)
  const [mensajeExito, setMensajeExito] = useState('')

  // Nuevo evento form
  const [neNumero, setNeNumero] = useState(1)
  const [neFecha, setNeFecha] = useState(new Date().toISOString().split('T')[0])
  const [neUbicacion, setNeUbicacion] = useState(ubicaciones[0] ?? '')
  const [neNuevaUbic, setNeNuevaUbic] = useState('')
  const [neUseNueva, setNeUseNueva] = useState(false)
  const [creandoEvento, setCreandoEvento] = useState(false)
  const [errorEvento, setErrorEvento] = useState('')

  // Compute player tiers
  const { tier1, tier2, tier3 } = useMemo(() => {
    const oficiales = jugadores.filter(j => MIEMBROS_OFICIALES.includes(j.nombre))
    const t1 = [...oficiales].sort((a, b) => {
      const va = conteoJugadores[a.id]?.victorias ?? 0
      const vb = conteoJugadores[b.id]?.victorias ?? 0
      if (vb !== va) return vb - va
      return (conteoJugadores[b.id]?.partidas ?? 0) - (conteoJugadores[a.id]?.partidas ?? 0)
    })
    const noOficiales = jugadores.filter(j => !MIEMBROS_OFICIALES.includes(j.nombre))
    const t2 = [...noOficiales]
      .sort((a, b) => (conteoJugadores[b.id]?.partidas ?? 0) - (conteoJugadores[a.id]?.partidas ?? 0))
      .slice(0, 3)
    const t2Ids = new Set(t2.map(j => j.id))
    const t3 = noOficiales.filter(j => !t2Ids.has(j.id)).sort((a, b) => a.nombre.localeCompare(b.nombre))
    return { tier1: t1, tier2: t2, tier3: t3 }
  }, [jugadores, conteoJugadores])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setAuthed(true)
      else router.push('/admin/login')
      setChecking(false)
    })
  }, [router])

  // Fetch events and next partida number client-side so data is always fresh
  useEffect(() => {
    if (!authed) return
    setLoadingEventos(true)
    Promise.all([
      getUltimosEventos(4),
      getUltimoNumeroPartida(),
    ]).then(([eventos, lastPartida]) => {
      setUltimosEventos(eventos)
      setProximaPartida(lastPartida + 1)
      setNeNumero((eventos[0]?.numero_evento ?? 0) + 1)
      setLoadingEventos(false)
    })
  }, [authed])

  async function seleccionarEvento(evento: EventoConConteo) {
    setEventoActivo(evento)
    setShowNuevoEvento(false)
    setShowNuevaPartida(false)
    setMensajeExito('')
    setLoadingPartidas(true)
    try {
      const partidas = await getPartidasDeEvento(evento.id)
      setPartidasDeEvento(partidas as unknown as PartidaResumen[])
    } catch (e: any) { alert(e.message) }
    setLoadingPartidas(false)
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
      await seleccionarEvento({ ...ev, partidas_count: 0 } as EventoConConteo)
      setShowNuevoEvento(false)
    } catch (e: any) { setErrorEvento(e.message ?? 'Error al crear evento') }
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

    const updated = await getPartidasDeEvento(eventoActivo.id)
    setPartidasDeEvento(updated as unknown as PartidaResumen[])
    setEventoActivo(prev => prev ? { ...prev, partidas_count: prev.partidas_count + 1 } : prev)
    setProximaPartida(nextNum + 1)
    setShowNuevaPartida(false)
    setMensajeExito(`✅ Partida #${nextNum} guardada`)
    setTimeout(() => setMensajeExito(''), 4000)
  }

  if (checking) return <div className="page-title text-center py-20">Verificando sesión...</div>
  if (!authed) return null

  const ultimoEvento = ultimosEventos[0] ?? null
  const otrosEventos = ultimosEventos.slice(1)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title text-3xl font-bold">Cargar Partida</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/historial"
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: '#EBF5FB', color: '#1A2F45' }}
          >
            Ver historial de eventos
          </Link>
          <button
            type="button"
            onClick={() => { setEventoActivo(null); setShowNuevaPartida(false); setShowNuevoEvento(true) }}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity"
            style={{ background: '#27AE60' }}
          >
            + Nuevo evento
          </button>
        </div>
      </div>

      {/* Formulario de nuevo evento (aparece en cualquier estado) */}
      {showNuevoEvento && (
        <div className="card p-5 border-2 mb-6" style={{ borderColor: '#27AE60' }}>
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
              <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: '#5D7A8A' }}>Sede</label>
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

      {!eventoActivo ? (
        /* ── Pantalla de selección de evento ── */
        <div className="space-y-5">
          {loadingEventos ? (
            <p className="text-sm text-white/70">Cargando eventos...</p>
          ) : ultimoEvento ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-white">
                Último evento registrado
              </p>
              <EventoCard evento={ultimoEvento} onSelect={() => seleccionarEvento(ultimoEvento)} />
            </div>
          ) : null}

          {otrosEventos.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-white">
                Seleccionar otro evento
              </p>
              <div className="space-y-2">
                {otrosEventos.map(ev => (
                  <EventoCard key={ev.id} evento={ev} onSelect={() => seleccionarEvento(ev)} />
                ))}
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
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xl font-bold" style={{ color: '#154E80' }}>Evento #{eventoActivo.numero_evento}</span>
              </div>
              <div className="flex gap-4 text-sm" style={{ color: '#5D7A8A' }}>
                <span>{formatFecha(eventoActivo.fecha)}</span>
                <span>Sede: <strong style={{ color: '#1A2F45' }}>{eventoActivo.ubicacion}</strong></span>
                <span><strong style={{ color: '#1A2F45' }}>{eventoActivo.partidas_count}</strong> partida{eventoActivo.partidas_count !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <button type="button" onClick={() => { setEventoActivo(null); setShowNuevaPartida(false) }}
              className="text-xs shrink-0" style={{ color: '#5D7A8A' }}>
              ← Cambiar evento
            </button>
          </div>

          {mensajeExito && (
            <div className="card p-3 mb-4" style={{ background: '#D5F5E3', borderColor: '#27AE60' }}>
              <p className="text-sm" style={{ color: '#1E8449' }}>{mensajeExito}</p>
            </div>
          )}

          {!showNuevaPartida && (
            <button type="button" onClick={() => setShowNuevaPartida(true)}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white mb-5"
              style={{ background: '#154E80' }}>
              + Nueva partida
            </button>
          )}

          {showNuevaPartida && (
            <div className="mb-5">
              <PartidaForm
                tier1={tier1} tier2={tier2} tier3={tier3}
                numeroPartida={proximaPartida}
                onGuardar={guardarPartida}
                onCancelar={() => setShowNuevaPartida(false)}
              />
            </div>
          )}

          {loadingPartidas ? (
            <p className="text-sm py-4 text-white/70">Cargando partidas...</p>
          ) : partidasDeEvento.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-3 text-white">
                Partidas del evento
              </p>
              <div className="space-y-3">
                {[...partidasDeEvento].reverse().map(p => {
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
            <p className="text-sm text-white/70">Todavía no hay partidas cargadas para este evento.</p>
          )}
        </div>
      )}
    </div>
  )
}
