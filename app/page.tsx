export const dynamic = 'force-dynamic'

import { getEstadisticasJugadores, getPartidas, getResultadosConJugadores } from '@/lib/queries'
import { victoriasAcumuladas } from '@/lib/metrics'
import { MIEMBROS_OFICIALES } from '@/lib/colors'
import KpiCard from '@/components/metrics/KpiCard'
import SectionTitle from '@/components/metrics/SectionTitle'
import RankingTable from '@/components/tables/RankingTable'
import RankingCharts from '@/components/charts/RankingCharts'

export default async function RankingPage() {
  const year = new Date().getFullYear()

  const [stats, partidas, resultados] = await Promise.all([
    getEstadisticasJugadores(year),
    getPartidas(year),
    getResultadosConJugadores(year),
  ])

  const totalPartidas = partidas.length

  const acumData = victoriasAcumuladas(resultados as any, MIEMBROS_OFICIALES)

  const victoriasEventoMap: Record<number, Record<string, number>> = {}
  for (const r of resultados as any[]) {
    if (r.rank_en_partida !== 1) continue
    const eventoId = r.partidas?.eventos?.id
    if (!eventoId) continue
    if (!victoriasEventoMap[eventoId]) {
      victoriasEventoMap[eventoId] = {}
      MIEMBROS_OFICIALES.forEach(j => { victoriasEventoMap[eventoId][j] = 0 })
    }
    const nombre = r.jugadores?.nombre
    if (MIEMBROS_OFICIALES.includes(nombre)) {
      victoriasEventoMap[eventoId][nombre] = (victoriasEventoMap[eventoId][nombre] ?? 0) + 1
    }
  }
  const eventosData = Object.entries(victoriasEventoMap).map(([evId, vals]) => ({
    evento: `E${evId}`, ...vals,
  }))

  return (
    <div>
      <h1 className="page-title text-3xl font-bold mb-6">
        Ranking {year} 🏆
      </h1>

      <SectionTitle>Ranking General</SectionTitle>
      <div className="card p-0 overflow-hidden mb-2">
        <RankingTable stats={stats} totalPartidas={totalPartidas} />
      </div>

      <RankingCharts
        stats={stats}
        acumData={acumData}
        eventosData={eventosData}
        players={MIEMBROS_OFICIALES}
        totalPartidas={totalPartidas}
      />
    </div>
  )
}
