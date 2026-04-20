'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ExportarPage() {
  const router = useRouter()
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [logs, setLogs] = useState<any[]>([])
  const [loadingBackup, setLoadingBackup] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.push('/admin/login'); return }
      setAuthed(true)
      setChecking(false)
      loadLogs()
    })
  }, [router])

  async function loadLogs() {
    const { data } = await supabase
      .from('backup_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    setLogs(data ?? [])
  }

  async function downloadCSV() {
    const { data } = await supabase
      .from('resultados')
      .select('*, jugadores(nombre), partidas(numero_partida, fecha, es_grand_slam, eventos(numero_evento, ubicacion))')
      .order('partida_id')

    if (!data) return

    const headers = ['partida','evento','fecha','ubicacion','grand_slam','jugador','pts_tablero','pv','ejercito','camino','pts_totales','rank','penalidad']
    const rows = data.map(r => [
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

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `catan-resultados-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function forzarBackup() {
    setLoadingBackup(true)
    setMsg('')
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/backup-to-sheets`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      const json = await res.json()
      setMsg(json.message ?? 'Backup ejecutado')
      loadLogs()
    } catch (e: any) {
      setMsg(`Error: ${e.message}`)
    }
    setLoadingBackup(false)
  }

  if (checking) return <div className="page-title text-center py-20">Verificando...</div>
  if (!authed) return null

  return (
    <div>
      <h1 className="page-title text-3xl font-bold mb-6">Exportar Datos</h1>

      <div className="flex flex-wrap gap-4 mb-8">
        <button
          onClick={downloadCSV}
          className="px-6 py-3 rounded-lg font-bold text-white"
          style={{ background: '#27AE60' }}
        >
          ⬇ Descargar CSV completo
        </button>
        <button
          onClick={forzarBackup}
          disabled={loadingBackup}
          className="px-6 py-3 rounded-lg font-bold text-white disabled:opacity-60"
          style={{ background: '#154E80' }}
        >
          {loadingBackup ? '⏳ Ejecutando...' : '☁ Forzar Backup a Google Sheets'}
        </button>
      </div>

      {msg && (
        <div className="card p-4 mb-6">
          <p className="text-sm" style={{ color: '#1A2F45' }}>{msg}</p>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3" style={{ background: '#D6EAF8' }}>
          <h2 className="font-bold text-sm uppercase tracking-wide" style={{ color: '#5D7A8A' }}>Historial de Backups</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#D6EAF8' }}>
              {['Fecha','Tipo','Resultado','Mensaje'].map(h => (
                <th key={h} className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: '#5D7A8A' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center" style={{ color: '#5D7A8A' }}>
                  Sin backups registrados todavía
                </td>
              </tr>
            ) : logs.map((log, i) => (
              <tr key={log.id} style={{ background: i % 2 === 0 ? '#EBF5FB' : '#D6EAF8' }}>
                <td className="px-4 py-2.5 font-mono text-xs" style={{ color: '#1A2F45' }}>
                  {new Date(log.created_at).toLocaleString('es-AR')}
                </td>
                <td className="px-4 py-2.5" style={{ color: '#1A2F45' }}>{log.tipo}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${log.resultado === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
                    {log.resultado}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs" style={{ color: '#5D7A8A' }}>{log.mensaje ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
