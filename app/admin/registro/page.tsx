'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function RegistroPage() {
  const [jugadores, setJugadores] = useState<{ id: string; nombre: string }[]>([])
  const [jugadorId, setJugadorId] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('jugadores').select('id, nombre').eq('activo', true).order('nombre')
      .then(({ data }) => setJugadores(data ?? []))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    if (!jugadorId) { setError('Seleccioná tu nombre de la lista'); return }

    setLoading(true)
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) { setError(signUpError.message); setLoading(false); return }

    const userId = data.user?.id
    if (userId) {
      await fetch('/api/admin/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, jugadorId }),
      })
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="card p-8 w-full max-w-sm text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: '#1A2F45' }}>¡Cuenta creada!</h2>
          <p className="text-sm mb-6" style={{ color: '#5D7A8A' }}>
            Tu cuenta fue creada con rol <strong>normal</strong>. Un administrador podrá asignarte permisos adicionales.
          </p>
          <Link href="/admin/login"
            className="inline-block rounded-lg py-2 px-6 font-semibold text-white"
            style={{ background: '#154E80' }}>
            Iniciar sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="card p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-1" style={{ color: '#1A2F45' }}>Registrarse</h1>
        <p className="text-sm mb-6" style={{ color: '#5D7A8A' }}>Catán Dashboard</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: '#5D7A8A' }}>
              Tu nombre en el torneo
            </label>
            <select
              value={jugadorId}
              onChange={e => setJugadorId(e.target.value)}
              required
              className="w-full rounded-lg border px-3 py-2 text-sm bg-white"
              style={{ borderColor: '#AED6F1', color: jugadorId ? '#1A2F45' : '#5D7A8A' }}
            >
              <option value="">— Seleccioná tu nombre —</option>
              {jugadores.map(j => (
                <option key={j.id} value={j.id}>{j.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: '#5D7A8A' }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: '#AED6F1', color: '#1A2F45' }}
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: '#5D7A8A' }}>Contraseña</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: '#AED6F1', color: '#1A2F45' }}
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: '#5D7A8A' }}>Repetir contraseña</label>
            <input
              type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{
                borderColor: confirm && confirm !== password ? '#e74c3c' : '#AED6F1',
                color: '#1A2F45',
              }}
            />
            {confirm && confirm !== password && (
              <p className="text-xs mt-1" style={{ color: '#e74c3c' }}>Las contraseñas no coinciden</p>
            )}
          </div>

          {error && <p className="text-sm" style={{ color: '#e74c3c' }}>{error}</p>}

          <button
            type="submit" disabled={loading}
            className="rounded-lg py-2 px-4 font-semibold text-white disabled:opacity-60"
            style={{ background: '#154E80' }}
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>

          <Link href="/admin/login" className="text-center text-sm hover:underline" style={{ color: '#5D7A8A' }}>
            ¿Ya tenés cuenta? Iniciar sesión
          </Link>
        </form>
      </div>
    </div>
  )
}
