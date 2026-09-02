import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

// ── Cuenta corriente del cliente logueado ─────────────────────────────────
// Traduce la sesión de la tienda (email) al cliente de vetix (cliente_id) vía
// clientes.email_tienda, y calcula saldo / facturas / pagos leyendo las tablas
// de vetix con la service-role key (solo del lado del servidor).
//
// Modelo de datos de vetix (verificado):
//   ventas.estado = 'cuenta_corriente' (fiada, es deuda) | 'cobrada' (saldada) | 'anulada'
//   El saldo de cada factura = total − Σ pagos_cuenta_corriente con ese venta_id.
//   saldo del cliente = Σ (total − pagado) sobre las ventas en cuenta_corriente.
//   clientes.saldo_favor = crédito a favor del cliente.

type Factura = {
  id: number
  nro_factura: string | null
  fecha: string
  total: number
  pagado: number
  pendiente: number
  estado_pago: "pagada" | "parcial" | "pendiente"
}
type Pago = {
  id: number
  fecha: string
  monto: number
  metodo_pago: string | null
  nro_recibo: string | null
  venta_id: number | null
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export async function GET(req: NextRequest) {
  // 1. Autenticar al cliente por su token de sesión
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const token = authHeader.slice(7)

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user }, error: authErr } = await anon.auth.getUser(token)
  if (authErr || !user?.email) {
    return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
  }

  const email = user.email.toLowerCase()
  const db = getSupabaseAdmin()

  // 2. Traducir email de la tienda → cliente de vetix
  // eq (no ilike) para que un email con comodines LIKE (_ %) no matchee de más.
  // email_tienda se guarda siempre en minúsculas (ver /api/admin/vincular).
  const { data: cliente, error: cliErr } = await db
    .from("clientes")
    .select("id, nombre, apellido, tipo_cliente, saldo_favor")
    .eq("email_tienda", email)
    .maybeSingle()

  if (cliErr) {
    return NextResponse.json({ error: cliErr.message }, { status: 500 })
  }
  // Cuenta creada en la tienda pero todavía no vinculada a un cliente de vetix
  if (!cliente) {
    return NextResponse.json({ vinculado: false })
  }

  const clienteId = cliente.id

  // 3. Leer ventas y pagos del cliente (en paralelo)
  const [ventasRes, pagosRes] = await Promise.all([
    db.from("ventas")
      .select("id, total, estado, fecha, nro_factura")
      .eq("cliente_id", clienteId)
      .neq("estado", "anulada")
      .order("fecha", { ascending: false }),
    db.from("pagos_cuenta_corriente")
      .select("id, monto, metodo_pago, nro_recibo, venta_id, fecha")
      .eq("cliente_id", clienteId)
      .order("fecha", { ascending: false }),
  ])

  if (ventasRes.error) return NextResponse.json({ error: ventasRes.error.message }, { status: 500 })
  if (pagosRes.error) return NextResponse.json({ error: pagosRes.error.message }, { status: 500 })

  const ventas = ventasRes.data ?? []
  const pagos = pagosRes.data ?? []

  // 4. Pagos acumulados por venta
  const pagadoPorVenta: Record<number, number> = {}
  for (const p of pagos) {
    if (p.venta_id != null) {
      pagadoPorVenta[p.venta_id] = (pagadoPorVenta[p.venta_id] ?? 0) + Number(p.monto)
    }
  }

  // 5. Armar facturas + calcular saldo
  let saldo = 0
  const facturas: Factura[] = ventas.map(v => {
    const total = Number(v.total) || 0
    const pagado = pagadoPorVenta[v.id] ?? 0
    const cobrada = v.estado === "cobrada"
    const pendiente = cobrada ? 0 : Math.max(total - pagado, 0)
    saldo += pendiente
    const estado_pago: Factura["estado_pago"] =
      cobrada || pendiente <= 0 ? "pagada" : pagado > 0 ? "parcial" : "pendiente"
    return {
      id: v.id,
      nro_factura: v.nro_factura,
      fecha: v.fecha,
      total: round2(total),
      pagado: round2(pagado),
      pendiente: round2(pendiente),
      estado_pago,
    }
  })

  const listaPagos: Pago[] = pagos.map(p => ({
    id: p.id,
    fecha: p.fecha,
    monto: round2(Number(p.monto) || 0),
    metodo_pago: p.metodo_pago,
    nro_recibo: p.nro_recibo,
    venta_id: p.venta_id,
  }))

  const saldoFavor = round2(Number(cliente.saldo_favor) || 0)

  return NextResponse.json({
    vinculado: true,
    cliente: {
      nombre: [cliente.nombre, cliente.apellido].filter(Boolean).join(" "),
      tipo_cliente: cliente.tipo_cliente,
    },
    resumen: {
      saldo: round2(saldo),                       // lo que debe
      saldo_favor: saldoFavor,                    // crédito a favor
      neto: round2(saldo - saldoFavor),           // deuda neta
      facturas_pendientes: facturas.filter(f => f.estado_pago !== "pagada").length,
      total_pagado: round2(listaPagos.reduce((s, p) => s + p.monto, 0)),
    },
    facturas,
    pagos: listaPagos,
  })
}
