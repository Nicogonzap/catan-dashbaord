import { MIEMBROS_OFICIALES } from './colors'

export type ResultadoRaw = {
  partida_id: number
  jugador_id: string
  rank_en_partida: number
  puntos_totales: number
  puntos_tablero: number
  puntos_pv: number
  ejercito_mas_grande: boolean
  camino_mas_largo: boolean
  penalidad: number
  jugadores: { nombre: string }
  partidas: { numero_partida: number; fecha: string; eventos: { ubicacion: string } }
}

export function calcularRachaActual(
  resultados: ResultadoRaw[],
  jugadorNombre: string,
  tipo: 'victorias' | 'sequía'
): number {
  const sorted = [...resultados]
    .filter(r => r.jugadores.nombre === jugadorNombre)
    .sort((a, b) => b.partida_id - a.partida_id)

  let racha = 0
  for (const r of sorted) {
    const gano = r.rank_en_partida === 1
    if (tipo === 'victorias' && gano) racha++
    else if (tipo === 'sequía' && !gano) racha++
    else break
  }
  return racha
}

export function calcularRachaMaxima(
  resultados: ResultadoRaw[],
  jugadorNombre: string,
  tipo: 'victorias' | 'sequía'
): number {
  const sorted = [...resultados]
    .filter(r => r.jugadores.nombre === jugadorNombre)
    .sort((a, b) => a.partida_id - b.partida_id)

  let max = 0
  let current = 0
  for (const r of sorted) {
    const condicion = tipo === 'victorias' ? r.rank_en_partida === 1 : r.rank_en_partida !== 1
    if (condicion) {
      current++
      if (current > max) max = current
    } else {
      current = 0
    }
  }
  return max
}

export function calcularCebollitas(
  resultados: ResultadoRaw[],
  jugadorNombre: string
): number {
  const jugadorResultados = resultados.filter(r => r.jugadores.nombre === jugadorNombre)

  let count = 0
  for (const r of jugadorResultados) {
    if (r.rank_en_partida !== 1 && (r.puntos_totales === 9 || r.puntos_totales === 10)) {
      count++
    }
  }
  return count
}

export function calcularVictoriaTipica(
  resultados: ResultadoRaw[],
  jugadorNombre: string
): { tablero: number; pv: number; ejercito: number; camino: number } {
  const victorias = resultados.filter(
    r => r.jugadores.nombre === jugadorNombre && r.rank_en_partida === 1
  )
  if (victorias.length === 0) return { tablero: 0, pv: 0, ejercito: 0, camino: 0 }

  const totales = victorias.reduce(
    (acc, r) => ({
      tablero: acc.tablero + r.puntos_tablero,
      pv: acc.pv + r.puntos_pv,
      ejercito: acc.ejercito + (r.ejercito_mas_grande ? 2 : 0),
      camino: acc.camino + (r.camino_mas_largo ? 2 : 0),
    }),
    { tablero: 0, pv: 0, ejercito: 0, camino: 0 }
  )

  const total = totales.tablero + totales.pv + totales.ejercito + totales.camino
  return {
    tablero: Math.round((totales.tablero / total) * 100),
    pv: Math.round((totales.pv / total) * 100),
    ejercito: Math.round((totales.ejercito / total) * 100),
    camino: Math.round((totales.camino / total) * 100),
  }
}

export function victoriasAcumuladas(
  resultados: ResultadoRaw[],
  jugadores: string[]
): Array<{ partida: number; [jugador: string]: number }> {
  const sorted = [...resultados].sort((a, b) => a.partida_id - b.partida_id)
  const partidas = [...new Set(sorted.map(r => r.partida_id))]
  const acum: Record<string, number> = {}
  jugadores.forEach(j => (acum[j] = 0))

  return partidas.map(pid => {
    const res = sorted.filter(r => r.partida_id === pid)
    res.forEach(r => {
      const nombre = r.jugadores.nombre
      if (nombre in acum && r.rank_en_partida === 1) acum[nombre]++
    })
    return { partida: pid, ...Object.fromEntries(Object.entries(acum).map(([k, v]) => [k, v])) }
  })
}

export function victoriasporSede(
  resultados: ResultadoRaw[],
  jugadores: string[]
): Array<{ sede: string; [jugador: string]: number | string }> {
  const sedes: Record<string, Record<string, number>> = {}

  for (const r of resultados) {
    if (r.rank_en_partida !== 1) continue
    const sede = r.partidas.eventos.ubicacion
    const nombre = r.jugadores.nombre
    if (!jugadores.includes(nombre)) continue
    if (!sedes[sede]) {
      sedes[sede] = {}
      jugadores.forEach(j => (sedes[sede][j] = 0))
    }
    sedes[sede][nombre] = (sedes[sede][nombre] ?? 0) + 1
  }

  return Object.entries(sedes).map(([sede, vals]) => ({ sede, ...vals }))
}

export function calcularMaxVictoriasEnEvento(
  resultados: ResultadoRaw[],
  jugadorNombre: string
): number {
  const porEvento: Record<string | number, number> = {}
  for (const r of resultados) {
    if (r.jugadores.nombre !== jugadorNombre) continue
    if (r.rank_en_partida !== 1) continue
    const eventoId = (r.partidas as any).eventos?.id
    if (eventoId == null) continue
    porEvento[eventoId] = (porEvento[eventoId] ?? 0) + 1
  }
  const vals = Object.values(porEvento)
  return vals.length > 0 ? Math.max(...vals) : 0
}

export function isGrandSlam(jugadoresPartida: string[]): boolean {
  const set = new Set(jugadoresPartida)
  return (
    set.size === 6 &&
    MIEMBROS_OFICIALES.every(m => set.has(m))
  )
}
