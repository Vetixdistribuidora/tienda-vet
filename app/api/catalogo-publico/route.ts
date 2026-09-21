import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

// Catálogo para el cliente "público" (minorista): SOLO la categoría Pet Shop,
// con precio = costo × 2 (100% sobre el costo), calculado del lado del servidor
// para que el costo NUNCA llegue al navegador. Devuelve exactamente las mismas
// columnas que el catálogo normal (con el precio ya puesto en precio_venta).
const FACTOR_PUBLICO = 2.0
const CATEGORIA_PUBLICO = "Pet Shop"

export async function GET() {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from("productos")
    .select("id, nombre, costo, stock, categoria, subcategoria, laboratorio, imagen_url, oculto_tienda, mostrar_agotado")
    .eq("categoria", CATEGORIA_PUBLICO)
    .order("nombre", { ascending: true })
    .limit(2000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const productos = (data ?? [])
    // Con costo válido, visibles en la tienda, y con stock (o marcados en vitrina)
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
