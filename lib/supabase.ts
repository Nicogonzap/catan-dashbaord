import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export function createServiceClient() {
  return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export type Jugador = {
  id: string
  nombre: string
  es_miembro_oficial: boolean
  activo: boolean
  created_at: string
}

export type Evento = {
  id: number
  numero_evento: number
  fecha: string
  ubicacion: string
  created_at: string
}

export type Partida = {
  id: number
  numero_partida: number
  evento_id: number
  fecha: string
  total_jugadores: number
  es_grand_slam: boolean
  orden_turno: string[] | null
  created_at: string
}

export type Resultado = {
  id: number
  partida_id: number
  jugador_id: string
  puntos_tablero: number
  puntos_pv: number
  ejercito_mas_grande: boolean
  camino_mas_largo: boolean
  puntos_totales: number
  rank_en_partida: number
  penalidad: number
  created_at: string
}

export type EstadisticaJugador = {
  id: string
  nombre: string
  partidas_jugadas: number
  victorias: number
  pct_victorias: number
  promedio_puntos: number
  total_ejercitos: number
  total_caminos: number
  total_pv: number
  victorias_flawless: number
  diez_tablero: number
}

export type ResultadoConJugador = Resultado & {
  jugadores: Jugador
}

export type PartidaConResultados = Partida & {
  resultados: ResultadoConJugador[]
  eventos: Evento
}
