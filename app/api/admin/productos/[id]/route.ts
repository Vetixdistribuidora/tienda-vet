import { NextRequest, NextResponse } from "next/server"
import { verificarAdmin } from "../../_lib"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await verificarAdmin(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()

  // Whitelist de columnas editables — evita asignación masiva de campos arbitrarios
  const CAMPOS_PERMITIDOS = ["nombre", "precio_venta", "stock", "categoria", "subcategoria", "laboratorio", "imagen_url"] as const
  const updates: Record<string, unknown> = {}
  for (const campo of CAMPOS_PERMITIDOS) {
    if (campo in body) updates[campo] = body[campo]
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Sin campos válidos para actualizar" }, { status: 400 })
  }

  const { error } = await getSupabaseAdmin()
    .from("productos")
    .update(updates)
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
