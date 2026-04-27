'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const RULES_PDF = 'https://www.catan.com/sites/default/files/2025-03/CN3081%20CATAN%E2%80%93The%20Game%20Rulebook%20secure%20%281%29.pdf'
const RULES_56_PDF = 'https://www.catan.com/sites/default/files/2025-03/CN3082%20CATAN%20%E2%80%93%205-6%20Rulebook%202025%20reduced.pdf'

export default function ReglamentoPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/admin/login')
      else setChecking(false)
    })
  }, [router])

  if (checking) return <p className="text-center py-20 text-white/70">Cargando...</p>

  const options = [
    {
      href: RULES_PDF,
      external: true,
      title: 'Ver Reglas',
      desc: 'Reglamento oficial de Catan (Inglés, 2025)',
      icon: '📖',
      color: '#2471A3',
    },
    {
      href: RULES_56_PDF,
      external: true,
      title: 'Ver Reglas 5-6 Jugadores',
      desc: 'Expansión oficial para 5-6 jugadores (Inglés, 2025)',
      icon: '📚',
      color: '#27AE60',
    },
    {
      href: '/reglamento/custom',
      external: false,
      title: 'Reglas Custom',
      desc: 'Reglas creadas por el grupo, con ejemplos y sistema de votación.',
      icon: '⚙️',
      color: '#8E44AD',
    },
  ]

  return (
    <div>
      <h1 className="page-title text-3xl font-bold mb-8">Reglamento</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {options.map(o => {
          const inner = (
            <div className="card p-6 cursor-pointer transition-all hover:shadow-lg h-full"
              style={{ borderLeft: `4px solid ${o.color}` }}>
              <div className="text-3xl mb-3">{o.icon}</div>
              <h2 className="text-lg font-bold mb-1" style={{ color: '#1A2F45' }}>{o.title}</h2>
              <p className="text-sm" style={{ color: '#5D7A8A' }}>{o.desc}</p>
              {o.external && (
                <p className="text-xs mt-2" style={{ color: '#AED6F1' }}>Abre en nueva pestaña</p>
              )}
            </div>
          )

          return o.external ? (
            <a key={o.href} href={o.href} target="_blank" rel="noopener noreferrer">{inner}</a>
          ) : (
            <Link key={o.href} href={o.href}>{inner}</Link>
          )
        })}
      </div>
    </div>
  )
}
