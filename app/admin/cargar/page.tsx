export const dynamic = 'force-dynamic'

import { getJugadores, getUltimoNumeroPartida, getUbicaciones, getUltimosEventos, getConteoJugadoresAno } from '@/lib/queries'
import CargarClient from './CargarClient'

const CURRENT_YEAR = 2026

export default async function CargarPage() {
  const [jugadores, ultimaPartida, ubicaciones, ultimosEventos, conteoJugadores] = await Promise.all([
    getJugadores(),
    getUltimoNumeroPartida(),
    getUbicaciones(),
    getUltimosEventos(4),
    getConteoJugadoresAno(CURRENT_YEAR),
  ])
  return (
    <CargarClient
      jugadores={jugadores}
      ultimaPartida={ultimaPartida}
      ubicaciones={ubicaciones}
      ultimosEventos={ultimosEventos}
      conteoJugadores={conteoJugadores}
    />
  )
}
