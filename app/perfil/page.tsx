'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getPerfilUsuario } from '@/lib/queries'

export default function PerfilPage() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/admin/login'); return }
      const p = await getPerfilUsuario()
      setPerfil(p)
      setLoading(false)
    })
  }, [router])

  if (loading) return <p className="text-center py-20 text-white/70">Cargando perfil...</p>

  const jugadorNombre = perfil?.jugadores?.nombre ?? null

  const options = [
    {
      href: '/perfil/estadisticas',
      title: 'Mis Estadísticas',
      desc: 'Rendimiento por año, mano a mano, posición favorita y más.',
      icon: '📊',
    },
    {
      href: '/perfil/participacion',
      title: 'Ver Participación',
      desc: 'Eventos en los que participaste, partidas jugadas y resultados.',
      icon: '🗓️',
    },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="page-title text-3xl font-bold mb-1">Mi perfil</h1>
        {jugadorNombre && (
          <p className="text-white/70 text-sm">Jugador vinculado: <span className="font-semibold text-white">{jugadorNombre}</span></p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {options.map(o => (
          <Link key={o.href} href={o.href}>
            <div
              className="card p-6 cursor-pointer transition-all hover:shadow-lg"
              style={{ borderLeft: '4px solid #2471A3' }}
            >
              <div className="text-3xl mb-3">{o.icon}</div>
              <h2 className="text-lg font-bold mb-1" style={{ color: '#1A2F45' }}>{o.title}</h2>
              <p className="text-sm" style={{ color: '#5D7A8A' }}>{o.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
