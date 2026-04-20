export const dynamic = 'force-dynamic'

import { getResultadosConJugadores } from '@/lib/queries'
import StatsClient from './StatsClient'

function resolveYear(param?: string): number | null {
  if (param === 'all') return null
  if (param) return Number(param)
  return new Date().getFullYear()
}

export default async function StatsPage({ searchParams }: { searchParams: { year?: string } }) {
  const year = resolveYear(searchParams.year)
  const resultados = await getResultadosConJugadores(year)
  return <StatsClient resultados={resultados} year={year} />
}
