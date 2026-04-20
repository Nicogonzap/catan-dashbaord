// Cron: todos los domingos 23:00 ARG = lunes 02:00 UTC
// Configurar en Supabase Dashboard → Edge Functions → Schedules
// Cron expression: "0 2 * * 1"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

async function getGoogleAccessToken(serviceAccountKey: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({
    iss: serviceAccountKey.client_email,
    scope: SCOPES.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))

  const signingInput = `${header}.${payload}`

  // Import the private key
  const pemKey = serviceAccountKey.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '')

  const keyData = Uint8Array.from(atob(pemKey), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  )

  const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  const tokenData = await tokenRes.json()
  return tokenData.access_token
}

async function clearAndWrite(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  values: (string | number | boolean)[][]
) {
  const range = `${sheetName}!A1`
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  )
}

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const spreadsheetId = Deno.env.get('SPREADSHEET_ID')
  const serviceAccountRaw = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')

  if (!spreadsheetId || !serviceAccountRaw) {
    return new Response(
      JSON.stringify({ error: 'Missing SPREADSHEET_ID or GOOGLE_SERVICE_ACCOUNT_KEY' }),
      { status: 500 }
    )
  }

  const serviceAccount = JSON.parse(serviceAccountRaw)

  try {
    const accessToken = await getGoogleAccessToken(serviceAccount)

    // Fetch all data
    const [{ data: resultados }, { data: partidas }, { data: eventos }, { data: jugadores }] = await Promise.all([
      supabase.from('resultados').select('*, jugadores(nombre), partidas(numero_partida, fecha, es_grand_slam, eventos(numero_evento, ubicacion))').order('partida_id'),
      supabase.from('partidas').select('*, eventos(*)').order('numero_partida'),
      supabase.from('eventos').select('*').order('numero_evento'),
      supabase.from('jugadores').select('*').order('nombre'),
    ])

    // Write Resultados sheet
    const resHeaders = ['partida','evento','fecha','ubicacion','grand_slam','jugador','pts_tablero','pv','ejercito','camino','pts_totales','rank','penalidad']
    const resRows = (resultados ?? []).map((r: any) => [
      r.partidas?.numero_partida,
      r.partidas?.eventos?.numero_evento,
      r.partidas?.fecha,
      r.partidas?.eventos?.ubicacion,
      r.partidas?.es_grand_slam ? 'SI' : 'NO',
      r.jugadores?.nombre,
      r.puntos_tablero,
      r.puntos_pv,
      r.ejercito_mas_grande ? 'SI' : 'NO',
      r.camino_mas_largo ? 'SI' : 'NO',
      r.puntos_totales,
      r.rank_en_partida,
      r.penalidad,
    ])
    await clearAndWrite(accessToken, spreadsheetId, 'Resultados', [resHeaders, ...resRows])

    // Write Eventos sheet
    const evHeaders = ['id','numero_evento','fecha','ubicacion']
    const evRows = (eventos ?? []).map((e: any) => [e.id, e.numero_evento, e.fecha, e.ubicacion])
    await clearAndWrite(accessToken, spreadsheetId, 'Eventos', [evHeaders, ...evRows])

    // Write Jugadores sheet
    const jugHeaders = ['id','nombre','es_miembro_oficial','activo']
    const jugRows = (jugadores ?? []).map((j: any) => [j.id, j.nombre, j.es_miembro_oficial ? 'SI' : 'NO', j.activo ? 'SI' : 'NO'])
    await clearAndWrite(accessToken, spreadsheetId, 'Jugadores', [jugHeaders, ...jugRows])

    // Log backup
    await supabase.from('backup_logs').insert({
      tipo: 'google_sheets',
      resultado: 'ok',
      mensaje: `${(resultados ?? []).length} resultados, ${(partidas ?? []).length} partidas exportadas`,
    })

    return new Response(
      JSON.stringify({ message: `Backup completado: ${(resultados ?? []).length} resultados` }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    await supabase.from('backup_logs').insert({
      tipo: 'google_sheets',
      resultado: 'error',
      mensaje: err.message,
    }).catch(() => {})

    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500 }
    )
  }
})
