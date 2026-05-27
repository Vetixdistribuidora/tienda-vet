import type { MetadataRoute } from "next"
import { createClient } from "@supabase/supabase-js"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Rutas estáticas
  const estaticas: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ]

  // Rutas dinámicas de productos
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    let todos: { id: number; updated_at?: string }[] = []
    let desde = 0
    while (true) {
      const { data, error } = await supabase
        .from("productos")
        .select("id")
        .gt("stock", 0)
        .range(desde, desde + 999)
      if (error || !data || data.length === 0) break
      todos = [...todos, ...data]
      if (data.length < 1000) break
      desde += 1000
    }

    const dinamicas: MetadataRoute.Sitemap = todos.map(p => ({
      url: `${SITE_URL}/producto/${p.id}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }))

    return [...estaticas, ...dinamicas]
  } catch {
    return estaticas
  }
}
