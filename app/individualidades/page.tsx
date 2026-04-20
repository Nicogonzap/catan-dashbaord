export const dynamic = 'force-dynamic'

import { getEstadisticasJugadores, getResultadosConJugadores } from '@/lib/queries'
import IndividualidadesClient from './IndividualidadesClient'

function resolveYear(param?: string): number | null {
  if (param === 'all') return null
  if (param) return Number(param)
  return new Date().getFullYear()
}

export default async function IndividualidadesPage({ searchParams }: { searchParams: { year?: string } }) {
  const year = resolveYear(searchParams.year)

  const [stats, resultados] = await Promise.all([
    getEstadisticasJugadores(year),
    getResultadosConJugadores(year),
  ])
  return <IndividualidadesClient stats={stats} resultados={resultados} year={year} />
}
