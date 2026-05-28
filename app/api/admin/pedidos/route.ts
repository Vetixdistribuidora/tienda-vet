import { NextRequest, NextResponse } from "next/server"
import { verificarAdmin } from "../_lib"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export async function GET(req: NextRequest) {
  if (!await verificarAdmin(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { data, error } = await getSupabaseAdmin()
    .from("pedidos")
    .select("id, created_at, cliente_nombre, cliente_email, cliente_telefono, estado, total, notas, usuario_id, pedido_items(nombre_producto, cantidad, precio_unitario)")
    .order("created_at", { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
