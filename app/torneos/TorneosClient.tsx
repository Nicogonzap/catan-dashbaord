'use client'
import { useMemo } from 'react'
import { playerColor } from '@/lib/colors'

interface Props { resultados: any[] }

const YEARS = [2024, 2025, 2026]
const CURRENT_YEAR = 2026
const PODIO_MEDAL = ['🥇', '🥈', '🥉']

function KpiBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: '#EBF5FB' }}>
      <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#5D7A8A' }}>{label}</div>
      <div className="text-xl font-bold" style={{ color: '#1A2F45' }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: '#5D7A8A' }}>{sub}</div>}
    </div>
  )
}

function computeTorneo(resultados: any[], ano: number) {
  const res = resultados.filter(r => {
    const fecha = r.partidas?.fecha
    return fecha && new Date(fecha + 'T12:00:00').getFullYear() === ano
  })

  const partidas = new Set(res.map((r: any) => r.partida_id))
  const jugadores = new Set(res.map((r: any) => r.jugador_id))

  const victoriasPorJugador: Record<string, { nombre: string; wins: number; partidas: number }> = {}
  const grandSlams = new Set<number>()
  let flawless = 0
  let totalPuntos = 0
  let totalVP = 0
  let cebollitas = 0
  const conEjercito = new Set<number>()
  const conCamino = new Set<number>()
  let totalResultados = 0

  for (const r of res) {
    totalResultados++
    totalPuntos += r.puntos_totales ?? 0
    totalVP += r.puntos_pv ?? 0

    const nombre = r.jugadores?.nombre
    if (nombre) {
      if (!victoriasPorJugador[r.jugador_id]) victoriasPorJugador[r.jugador_id] = { nombre, wins: 0, partidas: 0 }
      victoriasPorJugador[r.jugador_id].partidas++
      if (r.rank_en_partida === 1) {
        victoriasPorJugador[r.jugador_id].wins++
        if (r.puntos_totales === 11) flawless++
      }
      if (r.rank_en_partida !== 1 && (r.puntos_totales === 9 || r.puntos_totales === 10)) cebollitas++
    }

    if (r.partidas?.es_grand_slam) grandSlams.add(r.partida_id)
    if (r.ejercito_mas_grande) conEjercito.add(r.partida_id)
    if (r.camino_mas_largo) conCamino.add(r.partida_id)
  }

  // Tiebreaker: fewer games played = higher rank (more efficient winner)
  const podio = Object.values(victoriasPorJugador)
    .sort((a, b) => b.wins - a.wins || a.partidas - b.partidas)
    .slice(0, 3)

  const nPartidas = partidas.size
  const promedioJugadoresPorPartida = nPartidas > 0
    ? Math.round(totalResultados / nPartidas * 10) / 10 : 0
  const promedioPuntosPorJugador = totalResultados > 0
    ? Math.round(totalPuntos / totalResultados * 10) / 10 : 0

  return {
    podio,
    nPartidas,
    nJugadores: jugadores.size,
    grandSlams: grandSlams.size,
    flawless,
    totalPuntos,
    totalVP,
    conEjercito: conEjercito.size,
    conCamino: conCamino.size,
    cebollitas,
    promedioJugadoresPorPartida,
    promedioPuntosPorJugador,
  }
}

export default function TorneosClient({ resultados }: Props) {
  const torneos = useMemo(
    () => YEARS.map(ano => ({ ano, ...computeTorneo(resultados, ano) })),
    [resultados]
  )

  return (
    <div>
      <h1 className="page-title text-3xl font-bold mb-6">Torneos</h1>

      <div className="space-y-8">
        {torneos.map(t => {
          const enCurso = t.ano === CURRENT_YEAR
          return (
            <div key={t.ano} className="card overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 flex items-center gap-4" style={{ background: '#154E80' }}>
                <span className="text-2xl font-bold text-white">{t.ano}</span>
                <span
                  className="px-3 py-1 rounded-full text-xs font-bold"
                  style={{
                    background: enCurso ? '#D4AC0D' : '#27AE60',
                    color: enCurso ? '#5D3A00' : '#fff',
                  }}
                >
                  {enCurso ? '⏳ En Curso' : '✅ Finalizado'}
                </span>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Podio */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: '#5D7A8A' }}>
                      {enCurso ? 'Posiciones Actuales' : 'Podio Final'}
                    </h3>
                    {t.podio.length === 0 ? (
                      <p className="text-sm" style={{ color: '#5D7A8A' }}>Sin datos</p>
                    ) : (
                      <div className="space-y-3">
                        {t.podio.map((p, i) => (
                          <div key={p.nombre} className="flex items-center gap-3">
                            <span className="text-2xl w-8 text-center">{PODIO_MEDAL[i]}</span>
                            <div className="flex-1 rounded-lg px-4 py-2.5 flex items-center justify-between"
                              style={{
                                background: i === 0 ? '#FEF9E7' : i === 1 ? '#F8F9F9' : '#FDF2E9',
                                border: `2px solid ${i === 0 ? '#D4AC0D' : i === 1 ? '#AED6F1' : '#E59866'}`,
                              }}>
                              <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full" style={{ background: playerColor(p.nombre) }} />
                                <span className="font-bold" style={{ color: '#1A2F45' }}>{p.nombre}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-bold text-lg" style={{ color: '#1A2F45' }}>{p.wins}</span>
                                <span className="text-xs ml-1" style={{ color: '#5D7A8A' }}>victorias</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Stats del torneo */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: '#5D7A8A' }}>
                      Cifras del Torneo
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <KpiBox label="Partidas" value={t.nPartidas} />
                      <KpiBox label="Jugadores únicos" value={t.nJugadores} />
                      <KpiBox label="Grand Slams" value={t.grandSlams} sub="partidas con los 6 miembros" />
                      <KpiBox label="Victorias Flawless" value={t.flawless} sub="con 11 puntos exactos" />
                      <KpiBox label="Puntos totales" value={t.totalPuntos.toLocaleString('es-AR')} />
                      <KpiBox label="VPs conseguidos" value={t.totalVP.toLocaleString('es-AR')} sub="puntos de cartas" />
                      <KpiBox
                        label="Con Ejército"
                        value={`${t.conEjercito} (${t.nPartidas > 0 ? Math.round(t.conEjercito / t.nPartidas * 100) : 0}%)`}
                        sub="partidas con ejército más grande"
                      />
                      <KpiBox
                        label="Con Camino"
                        value={`${t.conCamino} (${t.nPartidas > 0 ? Math.round(t.conCamino / t.nPartidas * 100) : 0}%)`}
                        sub="partidas con camino más largo"
                      />
                      <KpiBox
                        label="Prom. jugadores"
                        value={t.promedioJugadoresPorPartida}
                        sub="por partida"
                      />
                      <KpiBox
                        label="Prom. pts/jugador"
                        value={t.promedioPuntosPorJugador}
                        sub="promedio de puntos por resultado"
                      />
                      <KpiBox
                        label="Cebollitas"
                        value={t.cebollitas}
                        sub="9-10 pts sin ganar"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
