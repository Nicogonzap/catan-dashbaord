'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  actualizarNombreJugador, getConteoJugadoresAno,
  toggleVisibilidadJugador, unificarJugadores,
} from '@/lib/queries'
import { MIEMBROS_OFICIALES, playerColor, formatDate } from '@/lib/colors'

const CURRENT_YEAR = 2026

type Jugador = {
  id: string
  nombre: string
  es_miembro_oficial: boolean
  activo: boolean
  visible: boolean
}

function sortJugadores(jgs: Jugador[], conteo: Record<string, { partidas: number; victorias: number }>) {
  const oficiales = jgs.filter(j => MIEMBROS_OFICIALES.includes(j.nombre))
    .sort((a, b) => {
      const va = conteo[a.id]?.victorias ?? 0
      const vb = conteo[b.id]?.victorias ?? 0
      if (vb !== va) return vb - va
      return (conteo[b.id]?.partidas ?? 0) - (conteo[a.id]?.partidas ?? 0)
    })
  const noOficiales = jgs.filter(j => !MIEMBROS_OFICIALES.includes(j.nombre))
    .sort((a, b) => (conteo[b.id]?.partidas ?? 0) - (conteo[a.id]?.partidas ?? 0))
  return [...oficiales, ...noOficiales]
}

export default function JugadoresClient() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [jugadores, setJugadores] = useState<Jugador[]>([])
  const [ultimaPartida, setUltimaPartida] = useState<Record<string, string>>({})
  const [editId, setEditId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null)

  // Unificar state
  const [showUnificar, setShowUnificar] = useState(false)
  const [unifMantener, setUnifMantener] = useState('')
  const [unifAbsorber, setUnifAbsorber] = useState('')
  const [unificando, setUnificando] = useState(false)
  const [unifMsg, setUnifMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [unifConfirm, setUnifConfirm] = useState(false)

  async function load() {
    const [conteo, jgsResult, resResult] = await Promise.all([
      getConteoJugadoresAno(CURRENT_YEAR),
      supabase.from('jugadores').select('id, nombre, es_miembro_oficial, activo, visible').order('nombre'),
      supabase.from('resultados').select('jugador_id, partidas(fecha)'),
    ])
    const jgs = (jgsResult.data ?? []).map(j => ({
      ...j,
      visible: (j as any).visible !== false, // default true if column missing
    })) as Jugador[]
    setJugadores(sortJugadores(jgs, conteo))

    // Compute last partida date per jugador
    const ultima: Record<string, string> = {}
    for (const r of (resResult.data ?? []) as any[]) {
      const fecha = r.partidas?.fecha
      if (!fecha) continue
      if (!ultima[r.jugador_id] || fecha > ultima[r.jugador_id]) {
        ultima[r.jugador_id] = fecha
      }
    }
    setUltimaPartida(ultima)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.push('/admin/login'); return }
      const { data: perfil } = await supabase
        .from('perfiles').select('rol').eq('id', data.session.user.id).single()
      if (perfil?.rol !== 'admin') { setChecking(false); return }
      setIsAdmin(true)
      await load()
      setChecking(false)
    })
  }, [router])

  function startEdit(j: Jugador) {
    setEditId(j.id)
    setEditNombre(j.nombre)
    setMsg(null)
  }

  function cancelEdit() {
    setEditId(null)
    setEditNombre('')
  }

  async function saveEdit(j: Jugador) {
    const nombre = editNombre.trim()
    if (!nombre || nombre === j.nombre) { cancelEdit(); return }
    setGuardando(true)
    try {
      await actualizarNombreJugador(j.id, nombre)
      setMsg({ id: j.id, text: '✓ Guardado', ok: true })
      await load()
      setEditId(null)
    } catch (e: any) {
      setMsg({ id: j.id, text: '✗ ' + e.message, ok: false })
    }
    setGuardando(false)
  }

  async function toggleVisible(j: Jugador) {
    setTogglingId(j.id)
    try {
      await toggleVisibilidadJugador(j.id, !j.visible)
      await load()
    } catch (e: any) {
      setMsg({ id: j.id, text: '✗ ' + e.message, ok: false })
    }
    setTogglingId(null)
  }

  async function handleUnificar() {
    if (!unifMantener || !unifAbsorber || unifMantener === unifAbsorber) return
    setUnificando(true)
    setUnifMsg(null)
    try {
      await unificarJugadores(unifAbsorber, unifMantener)
      setUnifMsg({ text: '✓ Jugadores unificados correctamente', ok: true })
      setUnifConfirm(false)
      setUnifMantener(''); setUnifAbsorber('')
      await load()
    } catch (e: any) {
      setUnifMsg({ text: '✗ ' + e.message, ok: false })
      setUnifConfirm(false)
    }
    setUnificando(false)
  }

  const jugadoresActivos = useMemo(() => jugadores.filter(j => j.activo), [jugadores])
  const jugadoresInactivos = useMemo(() => jugadores.filter(j => !j.activo), [jugadores])

  if (checking) return <p className="text-center py-20 text-white/70">Cargando...</p>

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <p className="text-lg font-semibold mb-1" style={{ color: '#1A2F45' }}>Acceso denegado</p>
        <p className="text-sm" style={{ color: '#5D7A8A' }}>Solo los administradores pueden editar jugadores.</p>
      </div>
    )
  }

  function JugadorRow({ j }: { j: Jugador }) {
    const editing = editId === j.id
    const color = playerColor(j.nombre)
    const ultima = ultimaPartida[j.id]
    const rowMsg = msg?.id === j.id ? msg : null

    return (
      <tr style={{ borderTop: '1px solid #D6EAF8' }}>
        {/* Color */}
        <td className="px-3 py-3">
          <span className="w-4 h-4 rounded-full inline-block" style={{ background: color }} />
        </td>

        {/* Nombre */}
        <td className="px-3 py-3">
          {editing ? (
            <input
              autoFocus
              type="text"
              value={editNombre}
              onChange={e => setEditNombre(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') saveEdit(j)
                if (e.key === 'Escape') cancelEdit()
              }}
              className="rounded border px-2 py-1 text-sm w-36"
              style={{ borderColor: '#D4AC0D', color: '#1A2F45', background: '#FEFDF0' }}
            />
          ) : (
            <span className="font-medium text-sm" style={{ color: '#1A2F45' }}>{j.nombre}</span>
          )}
          {rowMsg && (
            <span className="ml-2 text-xs" style={{ color: rowMsg.ok ? '#27AE60' : '#e74c3c' }}>{rowMsg.text}</span>
          )}
        </td>

        {/* Categoría */}
        <td className="px-3 py-3">
          <span
            className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={j.es_miembro_oficial
              ? { background: '#D6EAF8', color: '#154E80' }
              : { background: '#EBF5FB', color: '#5D7A8A' }
            }
          >
            {j.es_miembro_oficial ? 'Oficial' : 'Invitado'}
          </span>
        </td>

        {/* Última partida */}
        <td className="px-3 py-3 text-xs font-mono" style={{ color: '#5D7A8A' }}>
          {ultima ? formatDate(ultima) : '—'}
        </td>

        {/* Visible */}
        <td className="px-3 py-3 text-center">
          <span
            className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={j.visible
              ? { background: '#D5F5E3', color: '#1E8449' }
              : { background: '#FADBD8', color: '#922B21' }
            }
          >
            {j.visible ? 'Visible' : 'Oculto'}
          </span>
        </td>

        {/* Acciones */}
        <td className="px-3 py-3">
          <div className="flex items-center gap-1">
            {editing ? (
              <>
                <button
                  onClick={() => saveEdit(j)}
                  disabled={guardando}
                  className="px-2 py-1 rounded text-xs font-semibold text-white disabled:opacity-50"
                  style={{ background: '#154E80' }}
                >
                  {guardando ? '...' : 'Guardar'}
                </button>
                <button
                  onClick={cancelEdit}
                  className="px-2 py-1 rounded text-xs"
                  style={{ color: '#5D7A8A' }}
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                onClick={() => startEdit(j)}
                className="p-1.5 rounded hover:bg-blue-50 transition-colors"
                title="Editar nombre"
                style={{ color: '#2471A3' }}
              >
                ✏️
              </button>
            )}
            <button
              onClick={() => toggleVisible(j)}
              disabled={togglingId === j.id}
              className="p-1.5 rounded hover:bg-gray-50 transition-colors text-sm disabled:opacity-50"
              title={j.visible ? 'Ocultar jugador del dashboard' : 'Mostrar jugador en el dashboard'}
            >
              {j.visible ? '👁️' : '🚫'}
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/perfil" className="text-white/60 hover:text-white text-sm">← Mi perfil</Link>
          <h1 className="page-title text-3xl font-bold">Jugadores</h1>
        </div>
        <button
          onClick={() => { setShowUnificar(v => !v); setUnifMsg(null) }}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ background: '#EBF5FB', color: '#1A2F45' }}
        >
          {showUnificar ? 'Cerrar ✕' : '🔀 Unificar jugadores'}
        </button>
      </div>

      <p className="text-sm mb-4 text-white">
        Presioná ✏️ para editar el nombre. <kbd className="px-1 py-0.5 rounded text-xs bg-white/20">Enter</kbd> para guardar,{' '}
        <kbd className="px-1 py-0.5 rounded text-xs bg-white/20">Esc</kbd> para cancelar.
        Presioná 👁️/🚫 para cambiar la visibilidad en el dashboard.
      </p>

      {/* Unificar panel */}
      {showUnificar && (
        <div className="card p-5 mb-6 border-2" style={{ borderColor: '#D4AC0D' }}>
          <h3 className="font-bold mb-1" style={{ color: '#1A2F45' }}>Unificar jugadores</h3>
          <p className="text-xs mb-4" style={{ color: '#5D7A8A' }}>
            Todos los resultados del jugador a absorber se moverán al jugador a mantener. El jugador absorbido se eliminará.
            Solo se permite si no jugaron en la misma partida.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: '#5D7A8A' }}>
                Mantener (jugador final)
              </label>
              <select
                value={unifMantener}
                onChange={e => setUnifMantener(e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm"
                style={{ borderColor: '#AED6F1', color: '#1A2F45', background: '#fff' }}
              >
                <option value="">— Seleccioná —</option>
                {jugadores.map(j => (
                  <option key={j.id} value={j.id} disabled={j.id === unifAbsorber}>{j.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: '#5D7A8A' }}>
                Absorber (se elimina)
              </label>
              <select
                value={unifAbsorber}
                onChange={e => setUnifAbsorber(e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm"
                style={{ borderColor: '#AED6F1', color: '#1A2F45', background: '#fff' }}
              >
                <option value="">— Seleccioná —</option>
                {jugadores.map(j => (
                  <option key={j.id} value={j.id} disabled={j.id === unifMantener}>{j.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {unifMsg && (
            <p className="text-sm mb-3 font-medium" style={{ color: unifMsg.ok ? '#27AE60' : '#C0392B' }}>{unifMsg.text}</p>
          )}

          {!unifConfirm ? (
            <button
              onClick={() => setUnifConfirm(true)}
              disabled={!unifMantener || !unifAbsorber || unifMantener === unifAbsorber}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: '#C0392B' }}
            >
              Unificar
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium" style={{ color: '#C0392B' }}>
                ⚠️ Esta acción es irreversible. ¿Confirmar?
              </p>
              <button
                onClick={handleUnificar}
                disabled={unificando}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: '#C0392B' }}
              >
                {unificando ? 'Procesando...' : 'Confirmar'}
              </button>
              <button
                onClick={() => setUnifConfirm(false)}
                className="px-3 py-2 rounded-lg text-sm"
                style={{ color: '#5D7A8A' }}
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tabla jugadores */}
      {[
        { label: 'Activos', lista: jugadoresActivos },
        ...(jugadoresInactivos.length > 0 ? [{ label: 'Inactivos', lista: jugadoresInactivos }] : []),
      ].map(group => (
        <div key={group.label} className="card p-0 overflow-x-auto mb-6">
          <div className="px-4 py-2" style={{ background: '#D6EAF8' }}>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#5D7A8A' }}>
              {group.label} ({group.lista.length})
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#EBF5FB' }}>
                {['Color', 'Nombre', 'Categoría', 'Última partida', 'Visible', 'Acciones'].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: '#5D7A8A' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.lista.map(j => <JugadorRow key={j.id} j={j} />)}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
