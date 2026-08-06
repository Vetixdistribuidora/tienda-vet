import { NextRequest, NextResponse } from "next/server"
import { verificarAdmin } from "../_lib"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export async function GET(req: NextRequest) {
  if (!await verificarAdmin(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  // select("*") para no asumir nombres de columnas — la tabla pedidos puede
  // tener cliente_nombre o nombre según cómo fue creada en distribuidora-vet
  const { data, error } = await getSupabaseAdmin()
    .from("pedidos")
    .select("*, pedido_items(nombre_producto, cantidad, precio_unitario)")
    .is("nombre_proveedor", null)  // solo pedidos de la tienda (los de proveedores son de distribuidora-vet)
    .is("deleted_at", null)        // no mostrar pedidos borrados (borrado suave, compartido con distribuidora-vet)
    .order("created_at", { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
