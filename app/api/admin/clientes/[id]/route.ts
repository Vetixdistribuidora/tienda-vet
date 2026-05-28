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
  const { tipo_cliente, email } = await req.json()

  const db = getSupabaseAdmin()

  // Update tienda_perfiles (cached value)
  const { error: e1 } = await db
    .from("tienda_perfiles")
    .update({ tipo_cliente })
    .eq("id", id)

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

  // Also update clientes.tipo_cliente (source of truth used on login)
  if (email) {
    await db
      .from("clientes")
      .update({ tipo_cliente })
      .eq("email_tienda", email.toLowerCase())
  }

  return NextResponse.json({ ok: true })
}
