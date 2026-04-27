'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'

const PUBLIC_LINKS = [
  { href: '/',        label: 'Ranking' },
  { href: '/torneos', label: 'Torneos' },
  { href: '/stats',   label: 'Stats' },
]

const PRIVATE_LINKS = [
  { href: '/perfil',       label: 'Mi perfil' },
  { href: '/admin/cargar', label: 'Cargar Partida' },
  { href: '/reglamento',   label: 'Reglamento' },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  const links = [...PUBLIC_LINKS, ...(session ? PRIVATE_LINKS : [])]

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    if (href === '/admin/cargar') return pathname.startsWith('/admin')
    if (href === '/perfil') return pathname.startsWith('/perfil')
    if (href === '/reglamento') return pathname.startsWith('/reglamento')
    return pathname.startsWith(href)
  }

  return (
    <nav style={{ background: '#154E80', borderBottom: '1px solid #2E86C1' }} className="sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-0.5 h-14 overflow-x-auto">
        <Link href="/" className="mr-4 flex items-center gap-2 font-bold text-white text-lg shrink-0">
          <span>🎲</span>
          <span>Catán</span>
        </Link>

        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              isActive(l.href)
                ? 'bg-white/20 text-white'
                : 'text-white/75 hover:text-white hover:bg-white/10'
            }`}
          >
            {l.label}
          </Link>
        ))}

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {session ? (
            <button
              onClick={() => supabase.auth.signOut().then(() => router.push('/'))}
              className="px-3 py-1.5 rounded-md text-sm font-medium text-white/75 hover:text-white hover:bg-white/10 transition-colors"
            >
              Salir
            </button>
          ) : (
            <Link
              href="/admin/login"
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                pathname === '/admin/login'
                  ? 'bg-white/20 text-white'
                  : 'text-white/75 hover:text-white hover:bg-white/10'
              }`}
            >
              Iniciar sesión
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
