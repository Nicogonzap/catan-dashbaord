'use client'
import PlayerBar from './PlayerBar'
import StackedBarByEvent from './StackedBarByEvent'
import LineChart from './LineChart'
import HorizontalDoubleBar from './HorizontalDoubleBar'
import SectionTitle from '../metrics/SectionTitle'

interface Props {
  stats: any[]
  acumData: any[]
  sedeData: any[]
  eventosData: any[]
  players: string[]
}

export default function DashboardCharts({ stats, acumData, sedeData, eventosData, players }: Props) {
  const promData = stats.map(s => ({ nombre: s.nombre, value: Number(s.promedio_puntos) }))
  const pctData = stats.map(s => ({ nombre: s.nombre, value: Number(s.pct_victorias) }))

  const recursosData = stats.map(s => {
    const total = Number(s.partidas_jugadas)
    const victorias = Number(s.victorias)
    return {
      nombre: s.nombre,
      ejercito: victorias > 0 ? Math.round((Number(s.total_ejercitos) / victorias) * 100) : 0,
      camino: victorias > 0 ? Math.round((Number(s.total_caminos) / victorias) * 100) : 0,
    }
  })

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
        <div>
          <SectionTitle>Puntos Promedio por Partida</SectionTitle>
          <div className="card p-4">
            <PlayerBar data={promData} label="Promedio" formatter={v => v.toFixed(2)} />
          </div>
        </div>

        <div>
          <SectionTitle>% de Victorias</SectionTitle>
          <div className="card p-4">
            <PlayerBar data={pctData} label="% Victorias" formatter={v => `${v.toFixed(1)}%`} />
          </div>
        </div>
      </div>

      <SectionTitle>Efectividad en Recursos (% victorias con recurso)</SectionTitle>
      <div className="card p-4">
        <HorizontalDoubleBar data={recursosData} height={300} />
      </div>

      <SectionTitle>Victorias por Sede</SectionTitle>
      <div className="card p-4">
        <StackedBarByEvent data={sedeData} xKey="sede" players={players} height={300} />
      </div>

      <SectionTitle>Victorias por Evento</SectionTitle>
      <div className="card p-4">
        <StackedBarByEvent data={eventosData} xKey="evento" players={players} height={300} xLabel="Evento" />
      </div>

      <SectionTitle>Victorias Acumuladas en el Tiempo</SectionTitle>
      <div className="card p-4">
        <LineChart data={acumData} xKey="partida" players={players} height={320} />
      </div>
    </div>
  )
}
