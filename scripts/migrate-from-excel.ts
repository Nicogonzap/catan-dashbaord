/**
 * Script de migración desde Catan_original.xlsx a Supabase.
 *
 * Uso:
 *   npx ts-node --esm scripts/migrate-from-excel.ts
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY en .env.local o en el entorno.
 */

import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as fs from 'fs'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MIEMBROS_OFICIALES = new Set(['Gallo', 'Ivo', 'Gaspa', 'Hugo', 'Moch', 'Max'])

function excelSerialToDate(serial: number): string {
  const utc = (serial - 25569) * 86400 * 1000
  return new Date(utc).toISOString().split('T')[0]
}

function normalizarNombre(nombre: string): string {
  return (nombre ?? '').toString().trim()
    .replace(/\s+/g, '')
    // correcciones conocidas
    .replace(/^Gasta$/i, 'Gasta')
    .replace(/^Gaspa$/i, 'Gaspa')
}

function isGrandSlam(jugadores: string[]): boolean {
  const s = new Set(jugadores.map(normalizarNombre))
  return s.size === 6 && [...MIEMBROS_OFICIALES].every(m => s.has(m))
}

async function getOrCreateJugador(
  nombre: string,
  cache: Map<string, string>
): Promise<string> {
  if (cache.has(nombre)) return cache.get(nombre)!

  const { data: existing } = await supabase
    .from('jugadores')
    .select('id')
    .eq('nombre', nombre)
    .single()

  if (existing) {
    cache.set(nombre, existing.id)
    return existing.id
  }

  const { data: nuevo, error } = await supabase
    .from('jugadores')
    .insert({ nombre, es_miembro_oficial: MIEMBROS_OFICIALES.has(nombre), activo: true })
    .select('id')
    .single()

  if (error) throw new Error(`Error creando jugador ${nombre}: ${error.message}`)
  cache.set(nombre, nuevo.id)
  return nuevo.id
}

async function main() {
  const xlsxPath = path.join(process.cwd(), 'data', 'Catan_original.xlsx')
  if (!fs.existsSync(xlsxPath)) {
    console.error('No se encontró data/Catan_original.xlsx')
    process.exit(1)
  }

  const workbook = XLSX.readFile(xlsxPath)

  // ── Leer hoja Partidas ──────────────────────────────────────
  const sheetPartidas = workbook.Sheets['Partidas']
  if (!sheetPartidas) throw new Error('No existe la hoja "Partidas"')
  const rawPartidas: any[] = XLSX.utils.sheet_to_json(sheetPartidas, { defval: null })

  // ── Leer hoja Resultados ─────────────────────────────────────
  const sheetResultados = workbook.Sheets['Resultados dashboard']
  if (!sheetResultados) throw new Error('No existe la hoja "Resultados dashboard"')
  const rawResultados: any[] = XLSX.utils.sheet_to_json(sheetResultados, { defval: null })

  const jugadorCache = new Map<string, string>()

  // Pre-cargar jugadores existentes
  const { data: jugadoresExistentes } = await supabase.from('jugadores').select('id,nombre')
  for (const j of jugadoresExistentes ?? []) jugadorCache.set(j.nombre, j.id)

  // Ordenar partidas por número correlativo
  const partidasSorted = [...rawPartidas].sort((a, b) => {
    const pa = Number(a['Partida'] ?? a['partida'] ?? 0)
    const pb = Number(b['Partida'] ?? b['partida'] ?? 0)
    return pa - pb
  })

  let eventoActualNum = -1
  let eventoActualId: number | null = null

  const eventoCache = new Map<number, number>() // numero_evento → id

  for (const row of partidasSorted) {
    const numeroEvento = Number(row['Evento'] ?? row['evento'])
    const fechaRaw = row['Fecha'] ?? row['fecha']
    const fecha = typeof fechaRaw === 'number' ? excelSerialToDate(fechaRaw) : String(fechaRaw)
    const numeroPartida = Number(row['Partida'] ?? row['partida'])
    const ubicacion = String(row['Ubicación'] ?? row['Ubicacion'] ?? row['ubicacion'] ?? 'Sin ubicación').trim()
    const totalJugadores = Number(row['Total Jugadores'] ?? row['total_jugadores'] ?? 0)

    const jugadoresDePartida: string[] = []
    for (let i = 1; i <= 6; i++) {
      const nombre = normalizarNombre(String(row[`Jugador${i}`] ?? row[`jugador${i}`] ?? ''))
      if (nombre) jugadoresDePartida.push(nombre)
    }

    if (!numeroEvento || !fecha || !numeroPartida) {
      console.warn(`Fila inválida:`, row)
      continue
    }

    // Crear evento si no existe
    if (!eventoCache.has(numeroEvento)) {
      const { data: evExist } = await supabase
        .from('eventos')
        .select('id')
        .eq('numero_evento', numeroEvento)
        .single()

      if (evExist) {
        eventoCache.set(numeroEvento, evExist.id)
      } else {
        const { data: evNew, error: evErr } = await supabase
          .from('eventos')
          .insert({ numero_evento: numeroEvento, fecha, ubicacion })
          .select('id')
          .single()
        if (evErr) throw evErr
        eventoCache.set(numeroEvento, evNew.id)
        console.log(`✅ Evento ${numeroEvento} creado`)
      }
    }

    const eventoId = eventoCache.get(numeroEvento)!
    const grandSlam = isGrandSlam(jugadoresDePartida)

    // Verificar si ya existe la partida
    const { data: partExist } = await supabase
      .from('partidas')
      .select('id')
      .eq('numero_partida', numeroPartida)
      .single()

    if (partExist) {
      console.log(`⏭  Partida ${numeroPartida} ya existe, saltando`)
      continue
    }

    const { data: partNueva, error: partErr } = await supabase
      .from('partidas')
      .insert({
        numero_partida: numeroPartida,
        evento_id: eventoId,
        fecha,
        total_jugadores: jugadoresDePartida.length || totalJugadores,
        es_grand_slam: grandSlam,
        orden_turno: null,
      })
      .select('id')
      .single()

    if (partErr) {
      console.error(`Error creando partida ${numeroPartida}:`, partErr.message)
      continue
    }

    console.log(`✅ Partida ${numeroPartida} creada (Evento ${numeroEvento})`)

    // Buscar resultados de esta partida en la hoja de resultados
    const resDePartida = rawResultados.filter(r => {
      const pNum = Number(r['Partida'] ?? r['partida'])
      return pNum === numeroPartida
    })

    if (resDePartida.length === 0) {
      console.warn(`⚠  Partida ${numeroPartida} sin resultados en la hoja de resultados`)
      continue
    }

    const resultadosInsert = []
    for (const res of resDePartida) {
      const nombreRaw = String(res['Jugadores'] ?? res['Jugador'] ?? res['jugador'] ?? '').trim()
      const nombre = normalizarNombre(nombreRaw)
      if (!nombre) continue

      const jugadorId = await getOrCreateJugador(nombre, jugadorCache)
      const ptsTablero = Number(res['Puntos tablero'] ?? res['puntos_tablero'] ?? 0)
      const pv = Number(res['PV'] ?? res['pv'] ?? 0)
      const ejercito = Boolean(res['Ejército más grande'] ?? res['ejercito_mas_grande'])
      const camino = Boolean(res['Camino más largo'] ?? res['camino_mas_largo'])
      const ptsTotal = Number(res['Puntos totales'] ?? res['puntos_totales'] ?? ptsTablero + pv + (ejercito ? 2 : 0) + (camino ? 2 : 0))
      const rank = Number(res['Rank por partida'] ?? res['rank_en_partida'] ?? 0)
      const penalidad = Number(res['Penalidad'] ?? res['penalidad'] ?? 0)

      resultadosInsert.push({
        partida_id: partNueva.id,
        jugador_id: jugadorId,
        puntos_tablero: ptsTablero,
        puntos_pv: pv,
        ejercito_mas_grande: ejercito,
        camino_mas_largo: camino,
        puntos_totales: ptsTotal,
        rank_en_partida: rank,
        penalidad,
      })
    }

    if (resultadosInsert.length > 0) {
      const { error: resErr } = await supabase.from('resultados').insert(resultadosInsert)
      if (resErr) console.error(`Error insertando resultados partida ${numeroPartida}:`, resErr.message)
      else console.log(`   └─ ${resultadosInsert.length} resultados insertados`)
    }
  }

  console.log('\n🎲 Migración completada!')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
