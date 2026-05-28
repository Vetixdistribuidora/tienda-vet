import { createClient } from "@supabase/supabase-js"

// Server-side only — requires SUPABASE_SERVICE_ROLE_KEY env var (no NEXT_PUBLIC_)
// Add this in Vercel: Settings > Environment Variables > SUPABASE_SERVICE_ROLE_KEY
// Lazy: created per-request so missing key doesn't crash build-time evaluation
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
