export const dynamic = 'force-dynamic'

import { getEstadisticasJugadores, getEventos, getPartidas, getResultadosConJugadores } from '@/lib/queries'
import { victoriasAcumuladas, victoriasporSede } from '@/lib/metrics'
import { MIEMBROS_OFICIALES } from '@/lib/colors'
import KpiCard from '@/components/metrics/KpiCard'
import SectionTitle from '@/components/metrics/SectionTitle'
import RankingTable from '@/components/tables/RankingTable'
import DashboardCharts from '@/components/charts/DashboardCharts'

function resolveYear(param?: string): number | null {
  if (param === 'all') return null
  if (param) return Number(param)
  return new Date().getFullYear()
}

export default async function Home({ searchParams }: { searchParams: { year?: string } }) {
  const year = resolveYear(searchParams.year)

  const [stats, eventos, partidas, resultados] = await Promise.all([
    getEstadisticasJugadores(year),
    getEventos(year),
    getPartidas(year),
    getResultadosConJugadores(year),
  ])

  const totalPartidas = partidas.length
  const totalEventos = eventos.length
  const promPorEvento = totalEventos > 0 ? (totalPartidas / totalEventos).toFixed(1) : '0'
  const totalJugadoresActivos = stats.filter(s => Number(s.partidas_jugadas) > 0).length

  const acumData = victoriasAcumuladas(resultados as any, MIEMBROS_OFICIALES)
  const sedeData = victoriasporSede(resultados as any, MIEMBROS_OFICIALES)

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
    evento: `E${evId}`,
    ...vals,
  }))

  return (
    <div>
      <h1 className="page-title text-3xl font-bold mb-6">
        Dashboard Catán 🎲
        {year && <span className="ml-3 text-xl font-normal opacity-75">— {year}</span>}
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total Eventos" value={totalEventos} />
        <KpiCard label="Total Partidas" value={totalPartidas} />
        <KpiCard label="Prom. por Evento" value={promPorEvento} />
        <KpiCard label="Jugadores Activos" value={totalJugadoresActivos} />
      </div>

      <SectionTitle>Ranking General</SectionTitle>
      <div className="card p-0 overflow-hidden">
        <RankingTable stats={stats} totalPartidas={totalPartidas} />
      </div>

      <DashboardCharts
        stats={stats}
        acumData={acumData}
        sedeData={sedeData}
        eventosData={eventosData}
        players={MIEMBROS_OFICIALES}
        totalPartidas={totalPartidas}
      />
    </div>
  )
}
