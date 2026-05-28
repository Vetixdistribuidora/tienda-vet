import { createClient } from "@supabase/supabase-js"
import { NextRequest } from "next/server"

export async function verificarAdmin(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get("authorization")
  if (!auth?.startsWith("Bearer ")) return false

  const token = auth.slice(7)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return false

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? ""
  return user.email === adminEmail
}
