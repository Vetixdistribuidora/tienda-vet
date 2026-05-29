import { NextRequest, NextResponse } from "next/server"
import { verificarAdmin } from "../_lib"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export async function GET(req: NextRequest) {
  if (!await verificarAdmin(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  // Sin filtro de stock ni activo — muestra todos los productos existentes
  const { data, error } = await getSupabaseAdmin()
    .from("productos")
    .select("id, nombre, precio_venta, stock, categoria, laboratorio, imagen_url")
    .order("nombre")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
