import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

// ── Alta de pedidos (server-side, seguro) ─────────────────────────────────
// Crea el pedido con la service-role key para que la tabla pedidos pueda quedar
// completamente cerrada por RLS (nadie escribe ni lee directo desde el cliente).
//
// Seguridad:
//   • La identidad (usuario_id, email) sale del TOKEN, no del body → nadie puede
//     crear un pedido a nombre de otro usuario logueado.
//   • Los precios se RECALCULAN en el servidor desde productos.precio_venta según
//     el tipo de cliente → no se pueden manipular desde el navegador.

const FACTOR_VET = 1.30
const FACTOR_PROD = 1.58

function factorPara(tipo: string | null | undefined): number | null {
  if (tipo === "veterinario") return FACTOR_VET
  if (tipo === "productor") return FACTOR_PROD
  return null // pendiente / sin asignar → precios "a confirmar"
}

type ItemIn = { producto_id: number; cantidad: number; nota?: string }

export async function POST(req: NextRequest) {
  const db = getSupabaseAdmin()

  // 1. Identidad desde el token (si está logueado)
  let usuarioId: string | null = null
  let emailToken: string | null = null
  const authHeader = req.headers.get("authorization")
  if (authHeader?.startsWith("Bearer ")) {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data: { user } } = await anon.auth.getUser(authHeader.slice(7))
    if (user) { usuarioId = user.id; emailToken = user.email?.toLowerCase() ?? null }
  }

  // 2. Validar body
  let body: {
    cliente_nombre?: string; cliente_email?: string; cliente_telefono?: string
    cliente_direccion?: string; notas?: string; items?: ItemIn[]
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const nombre = (body.cliente_nombre ?? "").trim()
  const telefono = (body.cliente_telefono ?? "").trim()
  const items = Array.isArray(body.items) ? body.items : []
  if (!nombre || !telefono) return NextResponse.json({ error: "Faltan datos de contacto" }, { status: 400 })
  if (items.length === 0) return NextResponse.json({ error: "El carrito está vacío" }, { status: 400 })

  const cantidades = new Map<number, number>()
  for (const it of items) {
    const pid = Number(it.producto_id), cant = Number(it.cantidad)
    if (!Number.isFinite(pid) || !Number.isInteger(cant) || cant <= 0 || cant > 10000) {
      return NextResponse.json({ error: "Ítem inválido" }, { status: 400 })
    }
    cantidades.set(pid, (cantidades.get(pid) ?? 0) + cant)
  }

  // 3. Determinar el tipo de cliente (autoritativo, del servidor)
  let tipo: string | null = null
  if (emailToken) {
    const { data: cli } = await db.from("clientes").select("tipo_cliente").eq("email_tienda", emailToken).maybeSingle()
    if (cli?.tipo_cliente) tipo = cli.tipo_cliente
    else {
      const { data: perf } = await db.from("tienda_perfiles").select("tipo_cliente").eq("id", usuarioId).maybeSingle()
      tipo = perf?.tipo_cliente ?? null
    }
  }
  const factor = factorPara(tipo)

  // 4. Recalcular precios desde la base
  const ids = [...cantidades.keys()]
  const { data: prods, error: prodErr } = await db
    .from("productos").select("id, nombre, precio_venta").in("id", ids)
  if (prodErr) return NextResponse.json({ error: prodErr.message }, { status: 500 })

  const prodMap = new Map((prods ?? []).map(p => [p.id, p]))
  const itemsRows: { producto_id: number; nombre_producto: string; precio_unitario: number | null; cantidad: number; subtotal: number | null }[] = []
  let total = 0
  let hayPrecios = factor != null
  for (const [pid, cant] of cantidades) {
    const p = prodMap.get(pid)
    if (!p) return NextResponse.json({ error: `Producto ${pid} no existe` }, { status: 400 })
    const pu = factor != null ? Math.round(Number(p.precio_venta) * factor * 100) / 100 : null
    const sub = pu != null ? Math.round(pu * cant * 100) / 100 : null
    if (sub != null) total += sub
    itemsRows.push({ producto_id: pid, nombre_producto: p.nombre, precio_unitario: pu, cantidad: cant, subtotal: sub })
  }

  // 5. Insertar pedido + items (service role)
  const { data: pedido, error: eP } = await db.from("pedidos").insert({
    cliente_nombre: nombre,
    cliente_email: emailToken ?? (body.cliente_email?.trim() || null),
    cliente_telefono: telefono,
    cliente_direccion: body.cliente_direccion?.trim() || null,
    notas: body.notas?.trim() || null,
    total: hayPrecios ? Math.round(total * 100) / 100 : null,
    estado: "pendiente",
    usuario_id: usuarioId,
  }).select("id").single()
  if (eP || !pedido) return NextResponse.json({ error: eP?.message ?? "No se pudo crear el pedido" }, { status: 500 })

  const { error: eI } = await db.from("pedido_items").insert(
    itemsRows.map(r => ({ ...r, pedido_id: pedido.id }))
  )
  if (eI) return NextResponse.json({ error: eI.message }, { status: 500 })

  return NextResponse.json({ ok: true, id: pedido.id })
}
