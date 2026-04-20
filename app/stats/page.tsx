export const dynamic = 'force-dynamic'

import { getResultadosConJugadores, getAnosDisponibles } from '@/lib/queries'
import StatsClient from './StatsClient'

export default async function StatsPage() {
  const [resultados, years] = await Promise.all([
    getResultadosConJugadores(),
    getAnosDisponibles(),
  ])
  return <StatsClient resultados={resultados} years={years} />
}
