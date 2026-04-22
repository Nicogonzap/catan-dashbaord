export const dynamic = 'force-dynamic'

import { getJugadores, getUltimoNumeroPartida, getUbicaciones, getEventos, getUltimoEvento } from '@/lib/queries'
import CargarClient from './CargarClient'

export default async function CargarPage() {
  const [jugadores, ultimaPartida, ubicaciones, eventos, ultimoEvento] = await Promise.all([
    getJugadores(),
    getUltimoNumeroPartida(),
    getUbicaciones(),
    getEventos(),
    getUltimoEvento(),
  ])
  return (
    <CargarClient
      jugadores={jugadores}
      ultimaPartida={ultimaPartida}
      ubicaciones={ubicaciones}
      eventos={eventos}
      ultimoEvento={ultimoEvento}
    />
  )
}
