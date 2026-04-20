export const dynamic = 'force-dynamic'

import { getJugadores, getUltimoNumeroEvento, getUltimoNumeroPartida, getUbicaciones } from '@/lib/queries'
import CargarClient from './CargarClient'

export default async function CargarPage() {
  const [jugadores, ultimoEvento, ultimaPartida, ubicaciones] = await Promise.all([
    getJugadores(),
    getUltimoNumeroEvento(),
    getUltimoNumeroPartida(),
    getUbicaciones(),
  ])
  return (
    <CargarClient
      jugadores={jugadores}
      sugeridoEvento={ultimoEvento + 1}
      ultimaPartida={ultimaPartida}
      ubicaciones={ubicaciones}
    />
  )
}
