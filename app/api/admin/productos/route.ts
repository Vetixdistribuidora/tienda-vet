import { NextRequest, NextResponse } from "next/server"
import { verificarAdmin } from "../_lib"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

type ProdRow = { id: number; nombre: string; precio_venta: number; stock: number; categoria: string | null; laboratorio: string | null; imagen_url: string | null }

export async function GET(req: NextRequest) {
  if (!await verificarAdmin(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const db = getSupabaseAdmin()
  const SELECT = "id, nombre, precio_venta, stock, categoria, subcategoria, laboratorio, imagen_url"

  // ── 1. Traer el MISMO catálogo que ve la tienda (stock > 0 + ventas
  //       recientes), así el panel admin y la tienda coinciden y se puede
  //       gestionar todo lo que ve el cliente. Fallback a stock>0 si la
  //       función catalogo_tienda no existe. ──────────────────────────────────
  const conStock: ProdRow[] = []
  let desde = 0
  let usarRpc = true
  while (true) {
    let data: ProdRow[] | null
    if (usarRpc) {
      const r = await db.rpc("catalogo_tienda").select(SELECT).order("nombre").range(desde, desde + 999)
      if (r.error) { usarRpc = false; desde = 0; continue }
      data = r.data as ProdRow[]
    } else {
      const r = await db.from("productos").select(SELECT).gt("stock", 0).order("nombre").range(desde, desde + 999)
      if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 })
      data = r.data as ProdRow[]
    }
    if (!data || data.length === 0) break
    conStock.push(...data)
    if (data.length < 1000) break
    desde += 1000
    if (desde >= 20000) break
  }

  // ── 2. Traer todos los producto_id que aparecen en pedido_items ─────────────
  const todosItems: { producto_id: number | null }[] = []
  let desdeItems = 0
  while (true) {
    const { data, error } = await db
      .from("pedido_items")
      .select("producto_id")
      .not("producto_id", "is", null)
      .range(desdeItems, desdeItems + 999)
    if (error) break // no es crítico si falla
    if (!data || data.length === 0) break
    todosItems.push(...data)
    if (data.length < 1000) break
    desdeItems += 1000
  }

  // ── 3. IDs vendidos que no están ya en conStock ─────────────────────────────
  const idsConStock = new Set(conStock.map(p => p.id))
  const idsVendidos = [...new Set(todosItems.map(i => i.producto_id).filter((id): id is number => id != null))]
  const idsExtra = idsVendidos.filter(id => !idsConStock.has(id))

  // ── 4. Traer los productos vendidos sin stock actual (en batches de 200) ────
  const sinStockVendidos: ProdRow[] = []
  for (let i = 0; i < idsExtra.length; i += 200) {
    const batch = idsExtra.slice(i, i + 200)
    const { data } = await db
      .from("productos")
      .select(SELECT)
      .in("id", batch)
    if (data) sinStockVendidos.push(...data)
  }

  // ── 5. Mergear y ordenar por nombre ─────────────────────────────────────────
  const todos = [...conStock, ...sinStockVendidos]
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }))

  return NextResponse.json(todos)
}
