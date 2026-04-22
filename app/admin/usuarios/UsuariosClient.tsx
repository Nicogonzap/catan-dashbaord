'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const ROL_LABELS: Record<string, string> = {
  admin: '👑 Admin',
  recurrente: '🎮 Recurrente',
  normal: '👤 Normal',
}

const ROL_COLORS: Record<string, string> = {
  admin: '#D4AC0D',
  recurrente: '#2E86C1',
  normal: '#5D7A8A',
}

type UsuarioRow = {
  id: string
  email: string
  created_at: string
  perfil: {
    rol: string
    jugador_id: string | null
    jugadores: { nombre: string } | null
  } | null
}

function formatFecha(dt: string) {
  return new Date(dt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function UsuariosClient() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [token, setToken] = useState<string | null>(null)

  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [cambiandoRol, setCambiandoRol] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const fetchUsuarios = useCallback(async (tk: string) => {
    setLoading(true)
    setError('')
    const res = await fetch('/api/admin/usuarios', {
      headers: { Authorization: `Bearer ${tk}` },
    })
    if (!res.ok) {
      const body = await res.json()
      setError(body.error ?? 'Error al cargar usuarios')
    } else {
      const data = await res.json()
      setUsuarios(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.push('/admin/login'); return }
      const tk = data.session.access_token
      setToken(tk)

      // Check if current user is admin via perfiles
      const { data: perfil } = await supabase
        .from('perfiles').select('rol').eq('id', data.session.user.id).single()

      if (perfil?.rol !== 'admin') {
        setIsAdmin(false)
        setChecking(false)
        return
      }
      setIsAdmin(true)
      setChecking(false)
      fetchUsuarios(tk)
    })
  }, [router, fetchUsuarios])

  async function handleRolChange(userId: string, nuevoRol: string) {
    if (!token) return
    setCambiandoRol(userId)
    const res = await fetch('/api/admin/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId, rol: nuevoRol }),
    })
    if (res.ok) {
      setUsuarios(prev => prev.map(u =>
        u.id === userId
          ? { ...u, perfil: { ...(u.perfil ?? { jugador_id: null, jugadores: null }), rol: nuevoRol } }
          : u
      ))
    } else {
      const body = await res.json()
      alert('Error: ' + body.error)
    }
    setCambiandoRol(null)
  }

  async function handleDelete(userId: string) {
    if (!token) return
    setEliminando(userId)
    const res = await fetch('/api/admin/usuarios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId }),
    })
    if (res.ok) {
      setUsuarios(prev => prev.filter(u => u.id !== userId))
    } else {
      const body = await res.json()
      alert('Error: ' + body.error)
    }
    setEliminando(null)
    setConfirmDelete(null)
  }

  if (checking) {
    return <p className="p-8 text-center" style={{ color: '#5D7A8A' }}>Verificando permisos...</p>
  }

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <p className="text-lg font-semibold mb-2" style={{ color: '#1A2F45' }}>Acceso denegado</p>
        <p className="text-sm" style={{ color: '#5D7A8A' }}>Solo los administradores pueden ver esta página.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="page-title text-3xl font-bold mb-6">Gestión de Usuarios</h1>

      {/* Leyenda de roles */}
      <div className="card p-4 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#5D7A8A' }}>Roles disponibles</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <span className="font-bold" style={{ color: '#D4AC0D' }}>👑 Admin</span>
            <span className="ml-2" style={{ color: '#5D7A8A' }}>— Acceso total: cargar, historial, usuarios</span>
          </div>
          <div>
            <span className="font-bold" style={{ color: '#2E86C1' }}>🎮 Recurrente</span>
            <span className="ml-2" style={{ color: '#5D7A8A' }}>— Puede cargar partidas y ver historial</span>
          </div>
          <div>
            <span className="font-bold" style={{ color: '#5D7A8A' }}>👤 Normal</span>
            <span className="ml-2" style={{ color: '#5D7A8A' }}>— Solo visualización pública</span>
          </div>
        </div>
      </div>

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
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u, i) => {
                const rol = u.perfil?.rol ?? 'sin perfil'
                const jugadorNombre = u.perfil?.jugadores?.nombre ?? '—'
                const isDeleting = confirmDelete === u.id
                return (
                  <tr key={u.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #EBF5FB' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: '#1A2F45' }}>{jugadorNombre}</td>
                    <td className="px-4 py-3" style={{ color: '#5D7A8A' }}>{u.email}</td>
                    <td className="px-4 py-3" style={{ color: '#5D7A8A' }}>{formatFecha(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <select
                        value={rol}
                        onChange={e => handleRolChange(u.id, e.target.value)}
                        disabled={cambiandoRol === u.id}
                        className="rounded-lg border px-2 py-1 text-xs font-semibold bg-white disabled:opacity-60"
                        style={{
                          borderColor: '#AED6F1',
                          color: ROL_COLORS[rol] ?? '#5D7A8A',
                        }}
                      >
                        <option value="admin">👑 Admin</option>
                        <option value="recurrente">🎮 Recurrente</option>
                        <option value="normal">👤 Normal</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isDeleting ? (
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-xs" style={{ color: '#5D7A8A' }}>¿Confirmar?</span>
                          <button
                            onClick={() => handleDelete(u.id)}
                            disabled={eliminando === u.id}
                            className="px-2 py-1 rounded text-xs font-semibold text-white disabled:opacity-60"
                            style={{ background: '#e74c3c' }}
                          >
                            {eliminando === u.id ? '...' : 'Sí, eliminar'}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="px-2 py-1 rounded text-xs font-semibold"
                            style={{ background: '#EBF5FB', color: '#5D7A8A' }}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(u.id)}
                          className="px-2 py-1 rounded text-xs font-semibold hover:opacity-80"
                          style={{ background: '#FDECEA', color: '#e74c3c' }}
                        >
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {usuarios.length === 0 && !loading && (
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
