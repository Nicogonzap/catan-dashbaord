export const dynamic = 'force-dynamic'

import { getResultadosConJugadores } from '@/lib/queries'
import TorneosClient from './TorneosClient'

export default async function TorneosPage() {
  const resultados = await getResultadosConJugadores()
  return <TorneosClient resultados={resultados} />
}
