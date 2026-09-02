import { NextRequest, NextResponse } from "next/server"
import { verificarAdmin } from "../_lib"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

// Gestión de la pestaña "Agotados" del admin.
//   GET            → lista los productos marcados (mostrar_agotado = true).
//   GET ?q=texto   → busca cualquier producto por nombre (para agregarlo).
// El marcado/desmarcado se hace con PATCH /api/admin/productos/[id].
export async function GET(req: NextRequest) {
  if (!await verificarAdmin(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim()
  const db = getSupabaseAdmin()
  const SELECT = "id, nombre, precio_venta, stock, categoria, laboratorio, imagen_url, oculto_tienda, mostrar_agotado"

  let query = db.from("productos").select(SELECT).order("nombre", { ascending: true })

  if (q) {
    query = query.ilike("nombre", `%${q}%`).limit(30)
  } else {
    query = query.eq("mostrar_agotado", true).limit(500)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
