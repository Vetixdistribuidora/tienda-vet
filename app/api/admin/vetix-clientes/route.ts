import { NextRequest, NextResponse } from "next/server"
import { verificarAdmin } from "../_lib"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

// Busca clientes de vetix por nombre / apellido / CUIT para vincularlos con una
// cuenta de la tienda. Solo admin.
export async function GET(req: NextRequest) {
  if (!await verificarAdmin(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim()
  const soloVinculados = req.nextUrl.searchParams.get("linked") === "1"
  const db = getSupabaseAdmin()

  let query = db
    .from("clientes")
    .select("id, nombre, apellido, cuit, localidad, tipo_cliente, email_tienda")
    .order("nombre", { ascending: true })

  if (soloVinculados) {
    // Todas las cuentas ya vinculadas (para pintar el estado en el admin)
    query = query.not("email_tienda", "is", null).limit(1000)
  } else {
    query = query.limit(25)
    if (q) {
      // Coincidencia por nombre, apellido o CUIT
      query = query.or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%,cuit.ilike.%${q}%`)
    }
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const clientes = data ?? []
  const ids = clientes.map(c => c.id)
  if (ids.length === 0) return NextResponse.json([])

  // Enriquecer cada candidato con su saldo de cuenta corriente, para que el admin
  // pueda VERIFICAR que está vinculando al cliente correcto antes de confirmar.
  const { data: ventas } = await db
    .from("ventas")
    .select("id, cliente_id, total")
    .in("cliente_id", ids)
    .eq("estado", "cuenta_corriente")

  const ventaIds = (ventas ?? []).map(v => v.id)
  const pagadoPorVenta: Record<number, number> = {}
  if (ventaIds.length > 0) {
    const { data: pagos } = await db
      .from("pagos_cuenta_corriente")
      .select("venta_id, monto")
      .in("venta_id", ventaIds)
    for (const p of pagos ?? []) {
      if (p.venta_id != null) pagadoPorVenta[p.venta_id] = (pagadoPorVenta[p.venta_id] ?? 0) + Number(p.monto)
    }
  }

  const agg: Record<number, { saldo: number; abiertas: number }> = {}
  for (const v of ventas ?? []) {
    const pend = Math.max((Number(v.total) || 0) - (pagadoPorVenta[v.id] ?? 0), 0)
    const a = (agg[v.cliente_id] ??= { saldo: 0, abiertas: 0 })
    a.saldo += pend
    if (pend > 0) a.abiertas += 1
  }

  const enriquecidos = clientes.map(c => ({
    ...c,
    saldo: Math.round((agg[c.id]?.saldo ?? 0) * 100) / 100,
    facturas_abiertas: agg[c.id]?.abiertas ?? 0,
  }))

  return NextResponse.json(enriquecidos)
}
