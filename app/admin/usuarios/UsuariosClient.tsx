'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const ROL_COLORS: Record<string, string> = {
  admin: '#D4AC0D',
  recurrente: '#2E86C1',
  normal: '#5D7A8A',
}
const ROL_BG: Record<string, string> = {
  admin: '#FEF9E7',
  recurrente: '#EBF5FB',
  normal: '#F4F6F7',
}
const ROL_LABEL: Record<string, string> = {
  admin: '👑 Admin',
  recurrente: '🎮 Recurrente',
  normal: '👤 Normal',
}

type UsuarioRow = {
  id: string
  email: string
  created_at: string
  perfil: { rol: string; jugador_id: string | null; jugadores: { nombre: string } | null } | null
}
type Jugador = { id: string; nombre: string }
type EditState = { rol: string; jugador_id: string }

function formatFecha(dt: string) {
  return new Date(dt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

export default function UsuariosClient() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [token, setToken] = useState<string | null>(null)

  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([])
  const [jugadores, setJugadores] = useState<Jugador[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Per-row edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState>({ rol: '', jugador_id: '' })
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const fetchUsuarios = useCallback(async (tk: string) => {
    setLoading(true)
    setError('')
    const res = await fetch('/api/admin/usuarios', { headers: { Authorization: `Bearer ${tk}` } })
    if (!res.ok) {
      const body = await res.json()
      setError(body.error ?? 'Error al cargar usuarios')
    } else {
      setUsuarios(await res.json())
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.push('/admin/login'); return }
      const tk = data.session.access_token
      setToken(tk)
      const { data: perfil } = await supabase
        .from('perfiles').select('rol').eq('id', data.session.user.id).single()
      if (perfil?.rol !== 'admin') { setChecking(false); return }
      setIsAdmin(true)
      setChecking(false)
      fetchUsuarios(tk)
      supabase.from('jugadores').select('id, nombre').eq('activo', true).order('nombre')
        .then(({ data: jgs }) => setJugadores(jgs ?? []))
    })
  }, [router, fetchUsuarios])

  function startEdit(u: UsuarioRow) {
    setEditingId(u.id)
    setEditState({
      rol: u.perfil?.rol ?? 'normal',
      jugador_id: u.perfil?.jugador_id ?? '',
    })
    setConfirmDelete(false)
  }

  function cancelEdit() {
    setEditingId(null)
    setConfirmDelete(false)
  }

  async function handleGuardar(userId: string) {
    if (!token) return
    setGuardando(true)
    const res = await fetch('/api/admin/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId, rol: editState.rol, jugador_id: editState.jugador_id || null }),
    })
    if (res.ok) {
      const jugadorObj = jugadores.find(j => j.id === editState.jugador_id) ?? null
      setUsuarios(prev => prev.map(u => u.id === userId ? {
        ...u,
        perfil: {
          rol: editState.rol,
          jugador_id: editState.jugador_id || null,
          jugadores: jugadorObj ? { nombre: jugadorObj.nombre } : null,
        },
      } : u))
      setEditingId(null)
    } else {
      const body = await res.json()
      alert('Error: ' + body.error)
    }
    setGuardando(false)
  }

  async function handleEliminar(userId: string) {
    if (!token) return
    setEliminando(true)
    const res = await fetch('/api/admin/usuarios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId }),
    })
    if (res.ok) {
      setUsuarios(prev => prev.filter(u => u.id !== userId))
      setEditingId(null)
    } else {
      const body = await res.json()
      alert('Error: ' + body.error)
    }
    setEliminando(false)
    setConfirmDelete(false)
  }

  if (checking) return <p className="p-8 text-center" style={{ color: '#5D7A8A' }}>Verificando permisos...</p>

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <p className="text-lg font-semibold mb-1" style={{ color: '#1A2F45' }}>Acceso denegado</p>
        <p className="text-sm" style={{ color: '#5D7A8A' }}>Solo los administradores pueden ver esta página.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="page-title text-3xl font-bold mb-6">Gestión de Usuarios</h1>

      {error && (
        <div className="card p-4 mb-4 border-l-4" style={{ borderColor: '#e74c3c' }}>
          <p className="text-sm" style={{ color: '#e74c3c' }}>{error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-center py-8" style={{ color: '#5D7A8A' }}>Cargando usuarios...</p>
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#EBF5FB' }}>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: '#5D7A8A' }}>Jugador</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: '#5D7A8A' }}>Email</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: '#5D7A8A' }}>Registrado</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: '#5D7A8A' }}>Rol</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u, i) => {
                const isEditing = editingId === u.id
                const rol = u.perfil?.rol ?? 'normal'
                const jugadorNombre = u.perfil?.jugadores?.nombre ?? '—'

                return (
                  <tr
                    key={u.id}
                    style={{
                      borderTop: i === 0 ? 'none' : '1px solid #EBF5FB',
                      background: isEditing ? '#F8FCFF' : 'white',
                    }}
                  >
                    {/* Jugador */}
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          value={editState.jugador_id}
                          onChange={e => setEditState(s => ({ ...s, jugador_id: e.target.value }))}
                          className="rounded border px-2 py-1 text-sm bg-white w-36"
                          style={{ borderColor: '#AED6F1', color: editState.jugador_id ? '#1A2F45' : '#5D7A8A' }}
                        >
                          <option value="">— Sin asignar —</option>
                          {jugadores.map(j => (
                            <option key={j.id} value={j.id}>{j.nombre}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-medium" style={{ color: '#1A2F45' }}>{jugadorNombre}</span>
                      )}
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3" style={{ color: '#5D7A8A' }}>{u.email}</td>

                    {/* Registrado */}
                    <td className="px-4 py-3" style={{ color: '#5D7A8A' }}>{formatFecha(u.created_at)}</td>

                    {/* Rol */}
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          value={editState.rol}
                          onChange={e => setEditState(s => ({ ...s, rol: e.target.value }))}
                          className="rounded border px-2 py-1 text-xs font-semibold bg-white"
                          style={{ borderColor: '#AED6F1', color: ROL_COLORS[editState.rol] ?? '#5D7A8A' }}
                        >
                          <option value="admin">👑 Admin</option>
                          <option value="recurrente">🎮 Recurrente</option>
                          <option value="normal">👤 Normal</option>
                        </select>
                      ) : (
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: ROL_BG[rol], color: ROL_COLORS[rol] ?? '#5D7A8A' }}
                        >
                          {ROL_LABEL[rol] ?? rol}
                        </span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex items-center gap-2 justify-end flex-wrap">
                          {/* Confirmar eliminación */}
                          {confirmDelete ? (
                            <>
                              <span className="text-xs" style={{ color: '#5D7A8A' }}>¿Eliminar cuenta?</span>
                              <button
                                onClick={() => handleEliminar(u.id)}
                                disabled={eliminando}
                                className="px-2 py-1 rounded text-xs font-semibold text-white disabled:opacity-60"
                                style={{ background: '#e74c3c' }}
                              >
                                {eliminando ? '...' : 'Confirmar'}
                              </button>
                              <button
                                onClick={() => setConfirmDelete(false)}
                                className="px-2 py-1 rounded text-xs font-semibold"
                                style={{ background: '#EBF5FB', color: '#5D7A8A' }}
                              >
                                No
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleGuardar(u.id)}
                                disabled={guardando}
                                className="px-3 py-1 rounded text-xs font-semibold text-white disabled:opacity-60"
                                style={{ background: '#154E80' }}
                              >
                                {guardando ? '...' : 'Guardar'}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="px-2 py-1 rounded text-xs font-semibold"
                                style={{ background: '#EBF5FB', color: '#5D7A8A' }}
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => setConfirmDelete(true)}
                                className="px-2 py-1 rounded text-xs font-semibold"
                                style={{ background: '#FDECEA', color: '#e74c3c' }}
                              >
                                Eliminar
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(u)}
                          className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                          style={{ color: '#5D7A8A' }}
                          title="Editar"
                        >
                          <PencilIcon />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {usuarios.length === 0 && (
            <p className="text-center py-8 text-sm" style={{ color: '#5D7A8A' }}>No hay usuarios registrados.</p>
          )}
        </div>
      )}

      <div className="mt-4 text-right">
        <button
          onClick={() => token && fetchUsuarios(token)}
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: '#EBF5FB', color: '#154E80' }}
        >
          ↺ Recargar
        </button>
      </div>
    </div>
  )
}
