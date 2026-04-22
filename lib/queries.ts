import { supabase } from './supabase'

export async function getAnosDisponibles(): Promise<number[]> {
  const { data } = await supabase.from('partidas').select('fecha')
  if (!data) return []
  const years = [...new Set(data.map(p => new Date(p.fecha).getFullYear()))].sort((a, b) => b - a)
  return years
}

// Fetch all resultados with pagination (Supabase default limit = 1000 rows).
// When year is specified, fetches only that year's partida IDs first → efficient.
export async function getResultadosConJugadores(year?: number | null) {
  if (year) {
    const { data: partidas } = await supabase
      .from('partidas')
      .select('id')
      .gte('fecha', `${year}-01-01`)
      .lte('fecha', `${year}-12-31`)

    const ids = (partidas ?? []).map((p: any) => p.id)
    if (ids.length === 0) return []

    const { data, error } = await supabase
      .from('resultados')
      .select('*, jugadores(*), partidas(*, eventos(*))')
      .in('partida_id', ids)
      .order('partida_id', { ascending: true })
    if (error) throw error
    return data ?? []
  }

  // No year → paginate to bypass the 1000-row cap
  const allData: any[] = []
  const PAGE = 1000
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('resultados')
      .select('*, jugadores(*), partidas(*, eventos(*))')
      .order('partida_id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    allData.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return allData
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

  const resultados = await getResultadosConJugadores(year)
  const map: Record<string, any> = {}
  for (const r of resultados) {
    const j = (r as any).jugadores
    if (!j) continue
    if (!map[j.id]) {
      map[j.id] = {
        id: j.id, nombre: j.nombre, es_miembro_oficial: j.es_miembro_oficial,
        partidas_jugadas: 0, victorias: 0, _sum_pts: 0,
        total_ejercitos: 0, total_caminos: 0, total_pv: 0,
        victorias_flawless: 0, diez_tablero: 0,
      }
    }
    const s = map[j.id]
    s.partidas_jugadas++
    s._sum_pts += (r as any).puntos_totales
    if ((r as any).rank_en_partida === 1) {
      s.victorias++
      if ((r as any).puntos_totales === 11) s.victorias_flawless++
      if ((r as any).puntos_tablero === 10) s.diez_tablero++
    }
    if ((r as any).ejercito_mas_grande) s.total_ejercitos++
    if ((r as any).camino_mas_largo) s.total_caminos++
    s.total_pv += (r as any).puntos_pv
  }

  return Object.values(map)
    .map(s => ({
      ...s,
      pct_victorias: s.partidas_jugadas > 0
        ? Math.round(s.victorias / s.partidas_jugadas * 1000) / 10 : 0,
      promedio_puntos: s.partidas_jugadas > 0
        ? Math.round(s._sum_pts / s.partidas_jugadas * 100) / 100 : 0,
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
  if (year) q = q.gte('fecha', `${year}-01-01`).lte('fecha', `${year}-12-31`)
  const { data, error } = await q.order('numero_evento', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getPartidas(year?: number | null) {
  let q = supabase.from('partidas').select('*, eventos(*)')
  if (year) q = q.gte('fecha', `${year}-01-01`).lte('fecha', `${year}-12-31`)
  const { data, error } = await q.order('numero_partida', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getUltimoNumeroEvento(): Promise<number> {
  const { data } = await supabase
    .from('eventos').select('numero_evento')
    .order('numero_evento', { ascending: false }).limit(1).single()
  return data?.numero_evento ?? 0
}

export async function getUltimoNumeroPartida(): Promise<number> {
  const { data } = await supabase
    .from('partidas').select('numero_partida')
    .order('numero_partida', { ascending: false }).limit(1).single()
  return data?.numero_partida ?? 0
}

export async function getUbicaciones(): Promise<string[]> {
  const { data } = await supabase.from('eventos').select('ubicacion')
  const unique = [...new Set((data ?? []).map((e: any) => e.ubicacion as string))]
  return unique.sort()
}

export async function insertEvento(payload: {
  numero_evento: number; fecha: string; ubicacion: string
}) {
  const { data, error } = await supabase.from('eventos').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function insertPartida(payload: {
  numero_partida: number; evento_id: number; fecha: string
  total_jugadores: number; es_grand_slam: boolean; orden_turno: string[]
}) {
  const { data, error } = await supabase.from('partidas').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function insertResultados(resultados: Array<{
  partida_id: number; jugador_id: string; puntos_tablero: number; puntos_pv: number
  ejercito_mas_grande: boolean; camino_mas_largo: boolean; puntos_totales: number
  rank_en_partida: number; penalidad: number
}>) {
  const { error } = await supabase.from('resultados').insert(resultados)
  if (error) throw error
}

export async function getUltimoEvento() {
  const { data } = await supabase
    .from('eventos')
    .select('*')
    .order('numero_evento', { ascending: false })
    .limit(1)
    .single()
  return data ?? null
}

export async function getPartidasDeEvento(eventoId: number) {
  const { data, error } = await supabase
    .from('partidas')
    .select('id, numero_partida, fecha, es_grand_slam, total_jugadores, orden_turno, resultados(id, rank_en_partida, puntos_totales, jugadores(nombre))')
    .eq('evento_id', eventoId)
    .order('numero_partida', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function actualizarNombreJugador(id: string, nombre: string) {
  const { error } = await supabase.from('jugadores').update({ nombre }).eq('id', id)
  if (error) throw error
}

// ── Historial / ediciones ────────────────────────────────────────────────────

export async function getPartidasLista() {
  const { data, error } = await supabase
    .from('partidas')
    .select('id, numero_partida, fecha, orden_turno, eventos(id, numero_evento, ubicacion), resultados(id, rank_en_partida, jugadores(nombre))')
    .order('numero_partida', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getResultadosDePartida(partidaId: number) {
  const { data, error } = await supabase
    .from('resultados')
    .select('id, jugador_id, puntos_tablero, puntos_pv, ejercito_mas_grande, camino_mas_largo, puntos_totales, rank_en_partida, penalidad, jugadores(id, nombre)')
    .eq('partida_id', partidaId)
    .order('rank_en_partida', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function actualizarResultadosConAudit(
  partidaId: number,
  resultadosNuevos: Array<{
    id: number; puntos_tablero: number; puntos_pv: number
    ejercito_mas_grande: boolean; camino_mas_largo: boolean
    puntos_totales: number; rank_en_partida: number; penalidad: number
    jugador_nombre: string
  }>,
  snapshotAnterior: any[]
) {
  for (const r of resultadosNuevos) {
    const { error } = await supabase
      .from('resultados')
      .update({
        puntos_tablero: r.puntos_tablero,
        puntos_pv: r.puntos_pv,
        ejercito_mas_grande: r.ejercito_mas_grande,
        camino_mas_largo: r.camino_mas_largo,
        puntos_totales: r.puntos_totales,
        rank_en_partida: r.rank_en_partida,
        penalidad: r.penalidad,
      })
      .eq('id', r.id)
    if (error) throw error
  }
  const { error: auditError } = await supabase
    .from('resultados_historial')
    .insert({ partida_id: partidaId, snapshot_anterior: snapshotAnterior, snapshot_nuevo: resultadosNuevos })
  if (auditError) console.error('Audit log failed (table may not exist):', auditError.message)
}

export async function getAuditDePartida(partidaId: number) {
  const { data, error } = await supabase
    .from('resultados_historial')
    .select('*')
    .eq('partida_id', partidaId)
    .order('editado_en', { ascending: false })
  if (error) return []
  return data ?? []
}

export async function revertirEdicion(snapshotAnterior: any[], partidaId: number, snapshotActual: any[]) {
  for (const r of snapshotAnterior) {
    const { error } = await supabase
      .from('resultados')
      .update({
        puntos_tablero: r.puntos_tablero,
        puntos_pv: r.puntos_pv,
        ejercito_mas_grande: r.ejercito_mas_grande,
        camino_mas_largo: r.camino_mas_largo,
        puntos_totales: r.puntos_totales,
        rank_en_partida: r.rank_en_partida,
        penalidad: r.penalidad,
      })
      .eq('id', r.id)
    if (error) throw error
  }
  await supabase
    .from('resultados_historial')
    .insert({ partida_id: partidaId, snapshot_anterior: snapshotActual, snapshot_nuevo: snapshotAnterior })
}
