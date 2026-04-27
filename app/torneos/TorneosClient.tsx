'use client'
import { useMemo, useState, useEffect } from 'react'
import { playerColor } from '@/lib/colors'
import { getResultadosConJugadores } from '@/lib/queries'

const YEARS = [2026, 2025, 2024]
const CURRENT_YEAR = 2026
const PODIO_MEDAL = ['🥇', '🥈', '🥉']

function KpiBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: '#EBF5FB' }}>
      <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#5D7A8A' }}>{label}</div>
      <div className="text-lg font-bold leading-tight" style={{ color: '#1A2F45' }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: '#5D7A8A' }}>{sub}</div>}
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-2" style={{ background: '#D6EAF8' }}>
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#5D7A8A' }}>{children}</span>
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

export default function TorneosClient() {
  const [resultados, setResultados] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getResultadosConJugadores().then(res => { setResultados(res); setLoading(false) })
  }, [])

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

              {/* ── Podio ── */}
              <SectionHeader>{enCurso ? 'Posiciones Actuales' : 'Podio Final'}</SectionHeader>
              {t.podio.length === 0 ? (
                <p className="p-4 text-sm" style={{ color: '#5D7A8A' }}>Sin datos</p>
              ) : (
                <div className="grid grid-cols-3 divide-x" style={{ borderColor: '#AED6F1' }}>
                  {t.podio.map((p, i) => {
                    const bg = i === 0 ? '#FEF9E7' : i === 1 ? '#F8F9F9' : '#FDF2E9'
                    const border = i === 0 ? '#D4AC0D' : i === 1 ? '#AED6F1' : '#E59866'
                    return (
                      <div key={p.nombre} className="flex flex-col items-center py-4 px-2 gap-1"
                        style={{ background: bg, borderTop: `3px solid ${border}` }}>
                        <span className="text-2xl">{PODIO_MEDAL[i]}</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: playerColor(p.nombre) }} />
                          <span className="font-bold text-sm text-center leading-tight" style={{ color: '#1A2F45' }}>{p.nombre}</span>
                        </div>
                        <div className="text-center">
                          <span className="font-bold text-xl" style={{ color: '#1A2F45' }}>{p.wins}</span>
                          <div className="text-xs" style={{ color: '#5D7A8A' }}>victorias</div>
                        </div>
                        <div className="text-xs" style={{ color: '#5D7A8A' }}>{p.partidas} partidas</div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ── Cifras generales ── */}
              <SectionHeader>Cifras Generales</SectionHeader>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3">
                <KpiBox label="Partidas" value={t.nPartidas} />
                <KpiBox label="Jugadores únicos" value={t.nJugadores} />
                <KpiBox
                  label="Grand Slams"
                  value={`${t.grandSlams}`}
                  sub={`${t.nPartidas > 0 ? Math.round(t.grandSlams / t.nPartidas * 100) : 0}% del total`}
                />
                <KpiBox
                  label="Cebollitas"
                  value={t.cebollitas}
                  sub={`en ${t.nPartidas} partidas`}
                />
              </div>

              {/* ── Datos de partidas ── */}
              <SectionHeader>Datos de Partidas</SectionHeader>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3">
                <KpiBox label="Puntos totales" value={t.totalPuntos.toLocaleString('es-AR')} />
                <KpiBox label="VPs conseguidos" value={t.totalVP.toLocaleString('es-AR')} sub="puntos de cartas" />
                <KpiBox
                  label="Con Ejército"
                  value={`${t.conEjercito}`}
                  sub={`${t.nPartidas > 0 ? Math.round(t.conEjercito / t.nPartidas * 100) : 0}% del total`}
                />
                <KpiBox
                  label="Con Camino"
                  value={`${t.conCamino}`}
                  sub={`${t.nPartidas > 0 ? Math.round(t.conCamino / t.nPartidas * 100) : 0}% del total`}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
