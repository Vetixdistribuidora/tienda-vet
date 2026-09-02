import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

// Productos "vitrina": los marcados con mostrar_agotado = true, que deben
// aparecer en la tienda SIEMPRE (aunque tengan stock 0), con su cartel "Sin
// stock". Se leen con service-role para que funcione igual para visitantes y
// clientes logueados, sin tocar el RPC del catálogo ni el RLS.
//
// Solo devuelve columnas públicas (nunca costo/margen). El filtro final de
// precio/oculto lo aplica la tienda en su pipeline habitual.
export async function GET() {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from("productos")
    .select("id, nombre, precio_venta, stock, categoria, subcategoria, laboratorio, imagen_url, oculto_tienda")
    .eq("mostrar_agotado", true)
    .order("nombre")
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
