'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminSubNav() {
  const pathname = usePathname()
  const [rol, setRol] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return
      supabase.from('perfiles').select('rol').eq('id', data.session.user.id).single()
        .then(({ data: p }) => setRol(p?.rol ?? 'normal'))
    })
  }, [])

  // No mostrar sub-nav en login/registro
  if (pathname === '/admin/login' || pathname === '/admin/registro') return null
  if (!rol) return null

  const tabs = [
    { href: '/admin/cargar',    label: 'Cargar partidas' },
    { href: '/admin/historial', label: 'Historial' },
    ...(rol === 'admin' ? [
      { href: '/admin/usuarios',   label: 'Gestión de usuarios' },
      { href: '/admin/jugadores',  label: 'Jugadores' },
    ] : []),
  ]

  return (
    <div style={{ background: '#1A3F5C', borderBottom: '1px solid #0E3460' }}>
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 h-10 overflow-x-auto">
        {tabs.map(t => (
          <Link
            key={t.href}
            href={t.href}
            className={`px-3 py-1 rounded text-sm font-medium whitespace-nowrap transition-colors ${
              pathname.startsWith(t.href)
                ? 'bg-white/20 text-white'
                : 'text-white/65 hover:text-white hover:bg-white/10'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
