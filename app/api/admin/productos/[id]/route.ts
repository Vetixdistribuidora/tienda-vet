import { NextRequest, NextResponse } from "next/server"
import { verificarAdmin } from "../../_lib"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await verificarAdmin(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()

  const { error } = await getSupabaseAdmin()
    .from("productos")
    .update(body)
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
