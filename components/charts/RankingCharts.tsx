'use client'
import { useState } from 'react'
import PlayerBar from './PlayerBar'
import StackedBarByEvent from './StackedBarByEvent'
import LineChart from './LineChart'
import SectionTitle from '../metrics/SectionTitle'

interface Props {
  stats: any[]
  acumData: any[]
  eventosData: any[]
  players: string[]
  totalPartidas: number
}

type Filtro = 'todos' | 'asistencia50'

export default function RankingCharts({ stats, acumData, eventosData, players, totalPartidas }: Props) {
  const [filtro, setFiltro] = useState<Filtro>('todos')

  const statsFiltradas = filtro === 'asistencia50'
    ? stats.filter(s => totalPartidas > 0 && (Number(s.partidas_jugadas) / totalPartidas * 100) >= 50)
    : stats

  const promData = [...statsFiltradas]
    .sort((a, b) => Number(b.promedio_puntos) - Number(a.promedio_puntos))
    .map(s => ({ nombre: s.nombre, value: Number(s.promedio_puntos) }))

  const pctData = [...statsFiltradas]
    .sort((a, b) => Number(b.pct_victorias) - Number(a.pct_victorias))
    .map(s => ({ nombre: s.nombre, value: Number(s.pct_victorias) }))

  const FilterToggle = () => (
    <div className="flex gap-1 mb-3">
      {(['todos', 'asistencia50'] as Filtro[]).map(f => (
        <button key={f} onClick={() => setFiltro(f)}
          className="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
          style={{
            background: filtro === f ? '#154E80' : '#EBF5FB',
            color: filtro === f ? '#fff' : '#5D7A8A',
            borderColor: '#AED6F1',
          }}>
          {f === 'todos' ? 'Todos' : '+50% asistencia'}
        </button>
      ))}
    </div>
  )

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
        <div>
          <SectionTitle>Puntos Promedio por Partida</SectionTitle>
          <div className="card p-4">
            <FilterToggle />
            <PlayerBar data={promData} label="Promedio" formatter={v => v.toFixed(2)} />
          </div>
        </div>
        <div>
          <SectionTitle>% de Victorias</SectionTitle>
          <div className="card p-4">
            <FilterToggle />
            <PlayerBar data={pctData} label="% Victorias" formatter={v => `${v.toFixed(1)}%`} />
          </div>
        </div>
      </div>

      <SectionTitle>Victorias Acumuladas en el Tiempo</SectionTitle>
      <div className="card p-4">
        <LineChart data={acumData} xKey="partida" players={players} height={320} />
      </div>

      <SectionTitle>Victorias por Evento</SectionTitle>
      <div className="card p-4">
        <StackedBarByEvent data={eventosData} xKey="evento" players={players} height={300} xLabel="Evento" />
      </div>
    </div>
  )
}
