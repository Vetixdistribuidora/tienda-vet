import { NextRequest, NextResponse } from "next/server"
import { verificarAdmin } from "../_lib"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

type ProdRow = { id: number; nombre: string; precio_venta: number; stock: number; categoria: string | null; laboratorio: string | null; imagen_url: string | null }

export async function GET(req: NextRequest) {
  if (!await verificarAdmin(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const db = getSupabaseAdmin()
  const SELECT = "id, nombre, precio_venta, stock, categoria, laboratorio, imagen_url"

  // ── 1. Traer todos los productos con stock > 0 (paginando de a 1000) ────────
  const conStock: ProdRow[] = []
  let desde = 0
  while (true) {
    const { data, error } = await db
      .from("productos")
      .select(SELECT)
      .gt("stock", 0)
      .order("nombre")
      .range(desde, desde + 999)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) break
    conStock.push(...data)
    if (data.length < 1000) break
    desde += 1000
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
