export const dynamic = 'force-dynamic'

import { getJugadores, getUbicaciones, getConteoJugadoresAno } from '@/lib/queries'
import CargarClient from './CargarClient'

const CURRENT_YEAR = 2026

export default async function CargarPage() {
  const [jugadores, ubicaciones, conteoJugadores] = await Promise.all([
    getJugadores(),
    getUbicaciones(),
    getConteoJugadoresAno(CURRENT_YEAR),
  ])
  return (
    <CargarClient
      jugadores={jugadores}
      ubicaciones={ubicaciones}
      conteoJugadores={conteoJugadores}
    />
  )
}
