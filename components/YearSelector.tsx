'use client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function YearSelectorInner({ years }: { years: number[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Default to current year when no param is present
  const currentYear = searchParams.get('year') ?? String(new Date().getFullYear())

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    const params = new URLSearchParams(searchParams.toString())
    if (val === 'all') params.delete('year')
    else params.set('year', val)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <select
      value={currentYear}
      onChange={handleChange}
      className="rounded-md px-2 py-1 text-sm font-semibold border"
      style={{
        background: 'rgba(255,255,255,0.15)',
        color: '#fff',
        borderColor: 'rgba(255,255,255,0.3)',
      }}
    >
      <option value="all" style={{ background: '#154E80' }}>Todos los años</option>
      {years.map(y => (
        <option key={y} value={y} style={{ background: '#154E80' }}>{y}</option>
      ))}
    </select>
  )
}

export default function YearSelector({ years }: { years: number[] }) {
  return (
    <Suspense fallback={null}>
      <YearSelectorInner years={years} />
    </Suspense>
  )
}
