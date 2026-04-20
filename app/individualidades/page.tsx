export const dynamic = 'force-dynamic'

import { getEstadisticasJugadores, getResultadosConJugadores } from '@/lib/queries'
import IndividualidadesClient from './IndividualidadesClient'

export default async function IndividualidadesPage({ searchParams }: { searchParams: { year?: string } }) {
  const year = searchParams.year ? Number(searchParams.year) : null

  const [stats, resultados] = await Promise.all([
    getEstadisticasJugadores(year),
    getResultadosConJugadores(year),
  ])
  return <IndividualidadesClient stats={stats} resultados={resultados} year={year} />
}
