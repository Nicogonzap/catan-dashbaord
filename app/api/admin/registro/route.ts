import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// Creates a perfil row using service role — called right after client-side signUp.
// No auth check: this always creates a 'normal' role perfil, so there's no privilege risk.
export async function POST(req: NextRequest) {
  const { userId, jugadorId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })

  const svc = createServiceClient()
  const { error } = await svc
    .from('perfiles')
    .upsert({ id: userId, jugador_id: jugadorId || null, rol: 'normal' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
