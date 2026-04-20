export const dynamic = 'force-dynamic'

import { getResultadosConJugadores } from '@/lib/queries'
import StatsClient from './StatsClient'

export default async function StatsPage() {
  const resultados = await getResultadosConJugadores()
  return <StatsClient resultados={resultados} year={null} />
}
