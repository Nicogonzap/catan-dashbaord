'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import YearSelector from './YearSelector'

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/eventos', label: 'Eventos' },
  { href: '/individualidades', label: 'Individualidades' },
  { href: '/admin/cargar', label: 'Admin' },
]

interface Props {
  years: number[]
}

export default function Navbar({ years }: Props) {
  const pathname = usePathname()
  const isAdmin = pathname.startsWith('/admin')

  return (
    <nav style={{ background: '#154E80', borderBottom: '1px solid #2E86C1' }} className="sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 h-14">
        <Link href="/" className="mr-4 flex items-center gap-2 font-bold text-white text-lg">
          <span>🎲</span>
          <span>Catán</span>
        </Link>
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              pathname === l.href || (l.href !== '/' && pathname.startsWith(l.href))
                ? 'bg-white/20 text-white'
                : 'text-white/75 hover:text-white hover:bg-white/10'
            }`}
          >
            {l.label}
          </Link>
        ))}
        {!isAdmin && years.length > 0 && (
          <div className="ml-auto">
            <YearSelector years={years} />
          </div>
        )}
      </div>
    </nav>
  )
}
