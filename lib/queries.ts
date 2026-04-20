import { supabase } from './supabase'

function yearFilter(year: number | null) {
  if (!year) return null
  return { gte: `${year}-01-01`, lte: `${year}-12-31` }
}

export async function getAnosDisponibles(): Promise<number[]> {
  const { data } = await supabase.from('partidas').select('fecha')
  if (!data) return []
  const years = [...new Set(data.map(p => new Date(p.fecha).getFullYear()))].sort((a, b) => b - a)
  return years
}

export async function getEstadisticasJugadores(year?: number | null) {
  if (!year) {
    const { data, error } = await supabase
      .from('estadisticas_jugadores')
      .select('*')
      .order('victorias', { ascending: false })
    if (error) throw error
    return data ?? []
  }

  // When filtering by year, compute on-the-fly from resultados
  const { data, error } = await supabase
    .from('resultados')
    .select('*, jugadores(*), partidas!inner(fecha)')
    .gte('partidas.fecha', `${year}-01-01`)
    .lte('partidas.fecha', `${year}-12-31`)
  if (error) throw error

  const map: Record<string, any> = {}
  for (const r of data ?? []) {
    const j = r.jugadores
    if (!j) continue
    if (!map[j.id]) {
      map[j.id] = {
        id: j.id,
        nombre: j.nombre,
        es_miembro_oficial: j.es_miembro_oficial,
        partidas_jugadas: 0,
        victorias: 0,
        pct_victorias: 0,
        promedio_puntos: 0,
        total_ejercitos: 0,
        total_caminos: 0,
        total_pv: 0,
        victorias_flawless: 0,
        diez_tablero: 0,
        _sum_pts: 0,
      }
    }
    const s = map[j.id]
    s.partidas_jugadas++
    s._sum_pts += r.puntos_totales
    if (r.rank_en_partida === 1) {
      s.victorias++
      if (r.puntos_totales === 11) s.victorias_flawless++
      if (r.puntos_tablero === 10) s.diez_tablero++
    }
    if (r.ejercito_mas_grande) s.total_ejercitos++
    if (r.camino_mas_largo) s.total_caminos++
    s.total_pv += r.puntos_pv
  }

  return Object.values(map)
    .map(s => ({
      ...s,
      pct_victorias: s.partidas_jugadas > 0
        ? Math.round((s.victorias / s.partidas_jugadas) * 1000) / 10
        : 0,
      promedio_puntos: s.partidas_jugadas > 0
        ? Math.round((s._sum_pts / s.partidas_jugadas) * 100) / 100
        : 0,
    }))
    .sort((a, b) => b.victorias - a.victorias)
}

export async function getJugadores(soloActivos = true) {
  let q = supabase.from('jugadores').select('*')
  if (soloActivos) q = q.eq('activo', true)
  const { data, error } = await q.order('nombre')
  if (error) throw error
  return data ?? []
}

export async function getEventos(year?: number | null) {
  let q = supabase.from('eventos').select('*')
  if (year) {
    q = q.gte('fecha', `${year}-01-01`).lte('fecha', `${year}-12-31`)
  }
  const { data, error } = await q.order('numero_evento', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getPartidas(year?: number | null) {
  let q = supabase.from('partidas').select('*, eventos(*)')
  if (year) {
    q = q.gte('fecha', `${year}-01-01`).lte('fecha', `${year}-12-31`)
  }
  const { data, error } = await q.order('numero_partida', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getResultadosConJugadores(year?: number | null) {
  let q = supabase
    .from('resultados')
    .select('*, jugadores(*), partidas(*, eventos(*))')
  if (year) {
    q = (q as any).gte('partidas.fecha', `${year}-01-01`).lte('partidas.fecha', `${year}-12-31`)
  }
  const { data, error } = await q.order('partida_id', { ascending: true })
  if (error) throw error

  // Client-side filter as fallback (nested filters on joined tables need PostgREST syntax)
  if (year) {
    return (data ?? []).filter((r: any) => {
      const fecha = r.partidas?.fecha
      if (!fecha) return false
      const y = new Date(fecha).getFullYear()
      return y === year
    })
  }
  return data ?? []
}

export async function getPartidasDeEvento(eventoId: number) {
  const { data, error } = await supabase
    .from('partidas')
    .select('*, resultados(*, jugadores(*))')
    .eq('evento_id', eventoId)
    .order('numero_partida')
  if (error) throw error
  return data ?? []
}

export async function getPartidaDetalle(partidaId: number) {
  const { data, error } = await supabase
    .from('partidas')
    .select('*, eventos(*), resultados(*, jugadores(*))')
    .eq('id', partidaId)
    .single()
  if (error) throw error
  return data
}

export async function getUltimoNumeroEvento(): Promise<number> {
  const { data } = await supabase
    .from('eventos')
    .select('numero_evento')
    .order('numero_evento', { ascending: false })
    .limit(1)
    .single()
  return data?.numero_evento ?? 0
}

export async function getUltimoNumeroPartida(): Promise<number> {
  const { data } = await supabase
    .from('partidas')
    .select('numero_partida')
    .order('numero_partida', { ascending: false })
    .limit(1)
    .single()
  return data?.numero_partida ?? 0
}

export async function getUbicaciones(): Promise<string[]> {
  const { data } = await supabase.from('eventos').select('ubicacion')
  const unique = [...new Set((data ?? []).map((e: any) => e.ubicacion as string))]
  return unique.sort()
}

export async function insertEvento(payload: {
  numero_evento: number
  fecha: string
  ubicacion: string
}) {
  const { data, error } = await supabase
    .from('eventos')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function insertPartida(payload: {
  numero_partida: number
  evento_id: number
  fecha: string
  total_jugadores: number
  es_grand_slam: boolean
  orden_turno: string[]
}) {
  const { data, error } = await supabase
    .from('partidas')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function insertResultados(resultados: Array<{
  partida_id: number
  jugador_id: string
  puntos_tablero: number
  puntos_pv: number
  ejercito_mas_grande: boolean
  camino_mas_largo: boolean
  puntos_totales: number
  rank_en_partida: number
  penalidad: number
}>) {
  const { error } = await supabase.from('resultados').insert(resultados)
  if (error) throw error
}
