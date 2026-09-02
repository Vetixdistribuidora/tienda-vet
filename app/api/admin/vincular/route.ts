import { NextRequest, NextResponse } from "next/server"
import { verificarAdmin } from "../_lib"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

// Vincula (o desvincula) una cuenta de la tienda con un cliente de vetix,
// escribiendo el email en clientes.email_tienda. Ese es el puente que usa
// /api/mi-cuenta para mostrarle al cliente su cuenta corriente. Solo admin.
//
// body: { email: string, cliente_id: number | null }
//   cliente_id = número  → vincular ese email a ese cliente
//   cliente_id = null    → desvincular (limpiar el email de cualquier cliente)
export async function POST(req: NextRequest) {
  if (!await verificarAdmin(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { email, cliente_id } = await req.json()
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Falta el email" }, { status: 400 })
  }
  const emailLc = email.trim().toLowerCase()
  const db = getSupabaseAdmin()

  // 1. Quitar este email de cualquier cliente que lo tuviera (evita duplicados:
  //    un email de tienda apunta a un solo cliente de vetix).
  const { error: eClear } = await db
    .from("clientes")
    .update({ email_tienda: null })
    .eq("email_tienda", emailLc)
  if (eClear) return NextResponse.json({ error: eClear.message }, { status: 500 })

  // 2. Si se pasó un cliente, asignarle el email.
  if (cliente_id != null) {
    const { error: eSet } = await db
      .from("clientes")
      .update({ email_tienda: emailLc })
      .eq("id", cliente_id)
    if (eSet) return NextResponse.json({ error: eSet.message }, { status: 500 })

    // Reflejar el tipo_cliente de vetix en el perfil de la tienda (mismo criterio
    // que ya usa el login: clientes manda sobre tienda_perfiles).
    const { data: cli } = await db
      .from("clientes")
      .select("tipo_cliente")
      .eq("id", cliente_id)
      .maybeSingle()
    if (cli?.tipo_cliente) {
      await db.from("tienda_perfiles").update({ tipo_cliente: cli.tipo_cliente }).ilike("email", emailLc)
    }
  }

  return NextResponse.json({ ok: true })
}
