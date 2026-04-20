export const dynamic = 'force-dynamic'

import { getEventos, getResultadosConJugadores } from '@/lib/queries'
import EventosClient from './EventosClient'

export default async function EventosPage() {
  const [eventos, resultados] = await Promise.all([
    getEventos(),      // all time — for histórico table
    getResultadosConJugadores(), // all time
  ])
  return <EventosClient eventos={eventos} resultados={resultados} />
}
