import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

async function resolveAdmin(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const svc = createServiceClient()
  const { data: { user } } = await svc.auth.getUser(token)
  if (!user) return null
  const { data } = await svc.from('perfiles').select('rol').eq('id', user.id).single()
  return data?.rol === 'admin' ? user : null
}

// GET — list all users with their perfiles
export async function GET(req: NextRequest) {
  if (!await resolveAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const svc = createServiceClient()

  const { data: { users }, error } = await svc.auth.admin.listUsers({ perPage: 500 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: perfiles } = await svc
    .from('perfiles')
    .select('id, rol, jugador_id, jugadores(nombre)')

  const perfilMap = Object.fromEntries((perfiles ?? []).map((p: any) => [p.id, p]))

  const result = users.map(u => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    perfil: perfilMap[u.id] ?? null,
  }))

  return NextResponse.json(result)
}

// PATCH — update a user's role
export async function PATCH(req: NextRequest) {
  if (!await resolveAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { userId, rol } = await req.json()
  if (!userId || !rol) return NextResponse.json({ error: 'userId y rol requeridos' }, { status: 400 })
  const svc = createServiceClient()
  const { error } = await svc.from('perfiles').upsert({ id: userId, rol })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — delete a user entirely
export async function DELETE(req: NextRequest) {
  const admin = await resolveAdmin(req)
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })
  if (userId === admin.id) return NextResponse.json({ error: 'No podés eliminar tu propia cuenta' }, { status: 400 })
  const svc = createServiceClient()
  const { error } = await svc.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
