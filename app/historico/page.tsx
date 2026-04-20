export const dynamic = 'force-dynamic'

import { getResultadosConJugadores, getAnosDisponibles } from '@/lib/queries'
import HistoricoClient from './HistoricoClient'

export default async function HistoricoPage() {
  const [resultados, years] = await Promise.all([
    getResultadosConJugadores(), // all time
    getAnosDisponibles(),
  ])
  return <HistoricoClient resultados={resultados} years={years} />
}
