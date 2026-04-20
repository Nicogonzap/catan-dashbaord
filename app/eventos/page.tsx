export const dynamic = 'force-dynamic'

import { getEventos, getPartidas, getResultadosConJugadores } from '@/lib/queries'
import EventosClient from './EventosClient'

function resolveYear(param?: string): number | null {
  if (param === 'all') return null
  if (param) return Number(param)
  return new Date().getFullYear()
}

export default async function EventosPage({ searchParams }: { searchParams: { year?: string } }) {
  const year = resolveYear(searchParams.year)

  const [eventos, partidas, resultados] = await Promise.all([
    getEventos(year),
    getPartidas(year),
    getResultadosConJugadores(year),
  ])

  return <EventosClient eventos={eventos} partidas={partidas} resultados={resultados} year={year} />
}
