'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { actualizarNombreJugador } from '@/lib/queries'

type Jugador = { id: string; nombre: string; es_miembro_oficial: boolean; activo: boolean }

export default function JugadoresClient() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [jugadores, setJugadores] = useState<Jugador[]>([])
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState<string | null>(null)
  const [mensajes, setMensajes] = useState<Record<string, string>>({})

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.push('/admin/login'); return }
      const { data: perfil } = await supabase
        .from('perfiles').select('rol').eq('id', data.session.user.id).single()
      if (perfil?.rol !== 'admin') { setChecking(false); return }
      setIsAdmin(true)
      const { data: jgs } = await supabase
        .from('jugadores').select('id, nombre, es_miembro_oficial, activo').order('nombre')
      setJugadores(jgs ?? [])
      setChecking(false)
    })
  }, [router])

  function handleEdit(id: string, value: string) {
    setEdits(prev => ({ ...prev, [id]: value }))
    setMensajes(prev => ({ ...prev, [id]: '' }))
  }

  async function handleGuardar(j: Jugador) {
    const nuevoNombre = (edits[j.id] ?? j.nombre).trim()
    if (!nuevoNombre || nuevoNombre === j.nombre) return
    setGuardando(j.id)
    try {
      await actualizarNombreJugador(j.id, nuevoNombre)
      setJugadores(prev => prev.map(jg => jg.id === j.id ? { ...jg, nombre: nuevoNombre } : jg))
      setEdits(prev => { const n = { ...prev }; delete n[j.id]; return n })
      setMensajes(prev => ({ ...prev, [j.id]: '✓ Guardado' }))
    } catch (e: any) {
      setMensajes(prev => ({ ...prev, [j.id]: '✗ ' + e.message }))
    }
    setGuardando(null)
  }

  function handleKeyDown(e: React.KeyboardEvent, j: Jugador) {
    if (e.key === 'Enter') handleGuardar(j)
    if (e.key === 'Escape') {
      setEdits(prev => { const n = { ...prev }; delete n[j.id]; return n })
    }
  }

  if (checking) return <p className="p-8 text-center" style={{ color: '#5D7A8A' }}>Cargando...</p>

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <p className="text-lg font-semibold mb-1" style={{ color: '#1A2F45' }}>Acceso denegado</p>
        <p className="text-sm" style={{ color: '#5D7A8A' }}>Solo los administradores pueden editar jugadores.</p>
      </div>
    )
  }

  const activos = jugadores.filter(j => j.activo)
  const inactivos = jugadores.filter(j => !j.activo)

  function JugadorRow({ j }: { j: Jugador }) {
    const valor = edits[j.id] ?? j.nombre
    const modificado = edits[j.id] !== undefined && edits[j.id] !== j.nombre
    const msg = mensajes[j.id] ?? ''
    return (
      <tr style={{ borderTop: '1px solid #EBF5FB' }}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {j.es_miembro_oficial && (
              <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ background: '#D6EAF8', color: '#154E80' }}>
                Oficial
              </span>
            )}
            <input
              type="text"
              value={valor}
              onChange={e => handleEdit(j.id, e.target.value)}
              onKeyDown={e => handleKeyDown(e, j)}
              className="rounded border px-2 py-1 text-sm w-40"
              style={{
                borderColor: modificado ? '#D4AC0D' : '#AED6F1',
                color: '#1A2F45',
                background: modificado ? '#FEFDF0' : '#fff',
              }}
            />
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {modificado && (
              <>
                <button
                  onClick={() => handleGuardar(j)}
                  disabled={guardando === j.id}
                  className="px-3 py-1 rounded text-xs font-semibold text-white disabled:opacity-60"
                  style={{ background: '#154E80' }}
                >
                  {guardando === j.id ? '...' : 'Guardar'}
                </button>
                <button
                  onClick={() => setEdits(prev => { const n = { ...prev }; delete n[j.id]; return n })}
                  className="px-2 py-1 rounded text-xs font-semibold"
                  style={{ background: '#EBF5FB', color: '#5D7A8A' }}
                >
                  Cancelar
                </button>
              </>
            )}
            {msg && (
              <span className="text-xs" style={{ color: msg.startsWith('✓') ? '#27AE60' : '#e74c3c' }}>{msg}</span>
            )}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div>
      <h1 className="page-title text-3xl font-bold mb-6">Jugadores</h1>
      <p className="text-sm mb-4" style={{ color: '#5D7A8A' }}>
        Editá el nombre de un jugador y presioná <strong>Guardar</strong> o <kbd>Enter</kbd>. Presioná <kbd>Esc</kbd> para cancelar.
      </p>

      <div className="card p-0 overflow-x-auto mb-6">
        <div className="px-4 py-2" style={{ background: '#D6EAF8' }}>
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#5D7A8A' }}>Jugadores activos ({activos.length})</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#EBF5FB' }}>
              <th className="text-left px-4 py-2 font-semibold" style={{ color: '#5D7A8A' }}>Nombre</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {activos.map(j => <JugadorRow key={j.id} j={j} />)}
          </tbody>
        </table>
      </div>

      {inactivos.length > 0 && (
        <div className="card p-0 overflow-x-auto">
          <div className="px-4 py-2" style={{ background: '#D6EAF8' }}>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#5D7A8A' }}>Jugadores inactivos ({inactivos.length})</span>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {inactivos.map(j => <JugadorRow key={j.id} j={j} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
