import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

// Catálogo para el cliente "público" (minorista): SOLO la categoría Pet Shop,
// con precio = costo × 2 (100% sobre el costo), calculado del lado del servidor
// para que el costo NUNCA llegue al navegador. Devuelve exactamente las mismas
// columnas que el catálogo normal (con el precio ya puesto en precio_venta).
//
// Acceso restringido: requiere un usuario autenticado cuyo tipo sea "publico".
// Así ni siquiera los precios (costo × 2) quedan expuestos a cualquiera.
const FACTOR_PUBLICO = 2.0
const CATEGORIA_PUBLICO = "Pet Shop"

export async function GET(req: NextRequest) {
  // 1. Requiere sesión y que el usuario sea de tipo "publico"
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: { user } } = await anon.auth.getUser(authHeader.slice(7))
  if (!user) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })

  const db = getSupabaseAdmin()
  const { data: perf } = await db
    .from("tienda_perfiles")
    .select("tipo_cliente")
    .eq("id", user.id)
    .maybeSingle()
  if (perf?.tipo_cliente !== "publico") {
    return NextResponse.json({ error: "Solo para clientes minoristas" }, { status: 403 })
  }

  // 2. Traer el Pet Shop con precio = costo × 2 (nunca se devuelve el costo)
  const { data, error } = await db
    .from("productos")
    .select("id, nombre, costo, stock, categoria, subcategoria, laboratorio, imagen_url, oculto_tienda, mostrar_agotado")
    .eq("categoria", CATEGORIA_PUBLICO)
    .order("nombre", { ascending: true })
    .limit(2000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const productos = (data ?? [])
    .filter(p => Number(p.costo) > 0 && p.oculto_tienda !== true && (Number(p.stock) > 0 || p.mostrar_agotado === true))
    .map(p => ({
      id: p.id,
      nombre: p.nombre,
      precio_venta: Math.round(Number(p.costo) * FACTOR_PUBLICO * 100) / 100,
      stock: p.stock,
      categoria: p.categoria,
      subcategoria: p.subcategoria,
      laboratorio: p.laboratorio,
      imagen_url: p.imagen_url,
      oculto_tienda: p.oculto_tienda,
    }))

  return NextResponse.json(productos)
}
