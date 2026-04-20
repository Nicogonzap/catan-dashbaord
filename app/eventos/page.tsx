export const dynamic = 'force-dynamic'

import { getEventos, getPartidas, getResultadosConJugadores } from '@/lib/queries'
import EventosClient from './EventosClient'

export default async function EventosPage({ searchParams }: { searchParams: { year?: string } }) {
  const year = searchParams.year ? Number(searchParams.year) : null

  const [eventos, partidas, resultados] = await Promise.all([
    getEventos(year),
    getPartidas(year),
    getResultadosConJugadores(year),
  ])

  return <EventosClient eventos={eventos} partidas={partidas} resultados={resultados} year={year} />
}
