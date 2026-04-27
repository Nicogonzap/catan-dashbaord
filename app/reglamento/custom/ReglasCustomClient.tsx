'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  getReglasCustom, getPerfilUsuario,
  createReglaCustom, updateReglaCustom, deleteReglaCustom, upsertVotoRegla,
} from '@/lib/queries'

type Regla = {
  id: number
  titulo: string
  descripcion: string
  ejemplos?: string
  excepciones?: string
  votos_reglas: Array<{ user_id: string; voto: string }>
}

type FormData = { titulo: string; descripcion: string; ejemplos: string; excepciones: string }
const EMPTY_FORM: FormData = { titulo: '', descripcion: '', ejemplos: '', excepciones: '' }

function parseItems(text?: string): string[] {
  if (!text) return []
  return text.split('\n').map(s => s.trim()).filter(Boolean)
}

function Modal({
  regla, onSave, onClose,
}: {
  regla: Partial<FormData> | null
  onSave: (data: FormData) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<FormData>(
    regla ? { titulo: regla.titulo ?? '', descripcion: regla.descripcion ?? '', ejemplos: regla.ejemplos ?? '', excepciones: regla.excepciones ?? '' }
          : EMPTY_FORM
  )
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.titulo.trim() || !form.descripcion.trim()) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-lg rounded-xl shadow-2xl p-6" style={{ background: '#EBF5FB' }}>
        <h3 className="text-lg font-bold mb-4" style={{ color: '#1A2F45' }}>
          {regla?.titulo ? 'Editar regla' : 'Nueva regla'}
        </h3>
        {([
          { key: 'titulo', label: 'Título', placeholder: 'Reroll de dado en distintas superficies', multi: false },
          { key: 'descripcion', label: 'Descripción', placeholder: 'En caso de que cualquier dado caiga en dos superficies...', multi: true },
          { key: 'ejemplos', label: 'Ejemplos (uno por línea)', placeholder: '(1) Carta-Mesa\n(2) Tablero-Mesa', multi: true },
          { key: 'excepciones', label: 'Excepciones (uno por línea)', placeholder: '(1) Dos hexágonos del tablero', multi: true },
        ] as const).map(f => (
          <div key={f.key} className="mb-3">
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: '#5D7A8A' }}>{f.label}</label>
            {f.multi ? (
              <textarea
                rows={3}
                value={form[f.key]}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none"
                style={{ background: '#fff', borderColor: '#AED6F1', color: '#1A2F45', resize: 'vertical' }}
              />
            ) : (
              <input
                value={form[f.key]}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none"
                style={{ background: '#fff', borderColor: '#AED6F1', color: '#1A2F45' }}
              />
            )}
          </div>
        ))}
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: '#5D7A8A' }}>Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.titulo.trim() || !form.descripcion.trim()}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: '#154E80' }}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ReglasCustomClient() {
  const [reglas, setReglas] = useState<Regla[]>([])
  const [loading, setLoading] = useState(true)
  const [esAdmin, setEsAdmin] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [editando, setEditando] = useState<Regla | null | 'new'>(null)
  const editandoRegla = editando !== null && editando !== 'new' ? editando : null
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [votando, setVotando] = useState<number | null>(null)

  async function load() {
    const [reglasData, perfil, { data: { session } }] = await Promise.all([
      getReglasCustom(),
      getPerfilUsuario(),
      supabase.auth.getSession(),
    ])
    setReglas(reglasData as Regla[])
    setEsAdmin(perfil?.rol === 'admin')
    setUserId(session?.user?.id ?? null)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave(data: FormData) {
    if (editando === 'new') {
      await createReglaCustom(data)
    } else if (editandoRegla) {
      await updateReglaCustom(editandoRegla.id, data)
    }
    setEditando(null)
    await load()
  }

  async function handleDelete(id: number) {
    await deleteReglaCustom(id)
    setConfirmDelete(null)
    await load()
  }

  async function handleVoto(reglaId: number, voto: 'conforme' | 'disconforme') {
    if (votando) return
    setVotando(reglaId)
    try {
      await upsertVotoRegla(reglaId, voto)
      await load()
    } catch (e) {
      console.error(e)
    } finally {
      setVotando(null)
    }
  }

  if (loading) return <p className="text-center py-20 text-white/70">Cargando...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/reglamento" className="text-white/60 hover:text-white text-sm">← Reglamento</Link>
          <h1 className="page-title text-3xl font-bold">Reglas Custom</h1>
        </div>
        {esAdmin && (
          <button
            onClick={() => setEditando('new')}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: '#27AE60' }}
          >
            + Nueva regla
          </button>
        )}
      </div>

      {reglas.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-lg mb-1" style={{ color: '#5D7A8A' }}>No hay reglas custom todavía.</p>
          {esAdmin && <p className="text-sm" style={{ color: '#AED6F1' }}>Usá el botón de arriba para crear la primera.</p>}
        </div>
      )}

      <div className="space-y-4">
        {reglas.map(regla => {
          const conformes = regla.votos_reglas.filter(v => v.voto === 'conforme').length
          const disconformes = regla.votos_reglas.filter(v => v.voto === 'disconforme').length
          const miVoto = userId ? regla.votos_reglas.find(v => v.user_id === userId)?.voto ?? null : null
          const ejemplos = parseItems(regla.ejemplos)
          const excepciones = parseItems(regla.excepciones)

          return (
            <div key={regla.id} className="card p-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <h2 className="text-lg font-bold" style={{ color: '#1A2F45' }}>{regla.titulo}</h2>
                {esAdmin && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setEditando(regla)}
                      className="text-sm px-2 py-1 rounded transition-colors hover:bg-blue-50"
                      style={{ color: '#2471A3' }}
                      title="Editar regla"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => setConfirmDelete(regla.id)}
                      className="text-sm px-2 py-1 rounded transition-colors hover:bg-red-50"
                      style={{ color: '#C0392B' }}
                      title="Eliminar regla"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>

              {/* Descripción */}
              <p className="text-sm mb-3 leading-relaxed" style={{ color: '#5D7A8A' }}>{regla.descripcion}</p>

              {/* Ejemplos */}
              {ejemplos.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#5D7A8A' }}>Ejemplos</p>
                  <ul className="space-y-1">
                    {ejemplos.map((ej, i) => (
                      <li key={i} className="text-sm flex gap-2" style={{ color: '#1A2F45' }}>
                        <span style={{ color: '#2471A3' }}>•</span>
                        <span>{ej}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Excepciones */}
              {excepciones.length > 0 && (
                <div className="mb-3 p-3 rounded-lg" style={{ background: '#D6EAF8' }}>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#5D7A8A' }}>Excepciones</p>
                  <ul className="space-y-1">
                    {excepciones.map((ex, i) => (
                      <li key={i} className="text-sm flex gap-2" style={{ color: '#5D7A8A' }}>
                        <span>⚠️</span>
                        <span>{ex}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Voting */}
              <div className="flex items-center gap-3 pt-3 border-t" style={{ borderColor: '#AED6F1' }}>
                <span className="text-xs" style={{ color: '#5D7A8A' }}>¿Estás conforme con esta regla?</span>
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={() => userId && handleVoto(regla.id, 'conforme')}
                    disabled={votando === regla.id || !userId}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all disabled:opacity-50"
                    style={{
                      background: miVoto === 'conforme' ? '#1E8449' : '#EBF5FB',
                      color: miVoto === 'conforme' ? '#fff' : '#1E8449',
                      borderColor: '#1E8449',
                    }}
                  >
                    👍 {conformes}
                  </button>
                  <button
                    onClick={() => userId && handleVoto(regla.id, 'disconforme')}
                    disabled={votando === regla.id || !userId}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all disabled:opacity-50"
                    style={{
                      background: miVoto === 'disconforme' ? '#C0392B' : '#EBF5FB',
                      color: miVoto === 'disconforme' ? '#fff' : '#C0392B',
                      borderColor: '#C0392B',
                    }}
                  >
                    👎 {disconformes}
                  </button>
                </div>
              </div>
              {!userId && <p className="text-xs mt-2" style={{ color: '#AED6F1' }}>Iniciá sesión para votar</p>}
            </div>
          )
        })}
      </div>

      {/* Confirm Delete Modal */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-xl p-6 shadow-2xl" style={{ background: '#EBF5FB', maxWidth: 380 }}>
            <h3 className="font-bold mb-2" style={{ color: '#1A2F45' }}>¿Eliminar esta regla?</h3>
            <p className="text-sm mb-4" style={{ color: '#5D7A8A' }}>Esta acción no se puede deshacer.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg text-sm" style={{ color: '#5D7A8A' }}>Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#C0392B' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {editando !== null && (
        <Modal
          regla={editandoRegla ? { titulo: editandoRegla.titulo, descripcion: editandoRegla.descripcion, ejemplos: editandoRegla.ejemplos, excepciones: editandoRegla.excepciones } : null}
          onSave={handleSave}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  )
}
