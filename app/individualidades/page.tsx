export const dynamic = 'force-dynamic'

import { getEstadisticasJugadores, getResultadosConJugadores } from '@/lib/queries'
import IndividualidadesClient from './IndividualidadesClient'

export default async function IndividualidadesPage() {
  const [stats, resultados] = await Promise.all([
    getEstadisticasJugadores(), // all time
    getResultadosConJugadores(),
  ])
  return <IndividualidadesClient stats={stats} resultados={resultados} year={null} />
}
