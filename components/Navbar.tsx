'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/',                 label: 'Ranking' },
  { href: '/historico',        label: 'Ranking Histórico' },
  { href: '/eventos',          label: 'Eventos' },
  { href: '/individualidades', label: 'Individualidades' },
  { href: '/torneos',          label: 'Torneos' },
  { href: '/stats',            label: 'Stats' },
  { href: '/admin/cargar',     label: 'Admin' },
  { href: '/admin/historial',  label: 'Historial' },
  { href: '/admin/usuarios',   label: 'Usuarios' },
]

export default function Navbar() {
  const pathname = usePathname()

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
              pathname === l.href || (l.href !== '/' && pathname.startsWith(l.href))
                ? 'bg-white/20 text-white'
                : 'text-white/75 hover:text-white hover:bg-white/10'
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
