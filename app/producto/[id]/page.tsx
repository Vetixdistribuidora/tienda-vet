import type { Metadata } from "next"
import Image from "next/image"
import { createClient } from "@supabase/supabase-js"
import { notFound } from "next/navigation"

// ── Supabase server-side ──────────────────────────────────────────────────────

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

type Producto = {
  id: number
  nombre: string
  precio_venta: number
  stock: number
  categoria: string | null
  laboratorio: string | null
  imagen_url: string | null
}

async function getProducto(id: number): Promise<Producto | null> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from("productos")
    .select("id, nombre, precio_venta, stock, categoria, laboratorio, imagen_url")
    .eq("id", id)
    .single()
  return data ?? null
}

// ── SEO Metadata dinámica ─────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params
  const producto = await getProducto(Number(id))
  if (!producto) return { title: "Producto no encontrado" }

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  const description = [
    producto.laboratorio ? `${producto.laboratorio}.` : "",
    producto.categoria ? `Categoría: ${producto.categoria}.` : "",
    `Precio de referencia: $${producto.precio_venta.toLocaleString("es-AR", { minimumFractionDigits: 2 })}.`,
    "Distribuidora VETIX — pedidos online las 24 hs.",
  ].filter(Boolean).join(" ")

  return {
    title: producto.nombre,
    description,
    openGraph: {
      title: `${producto.nombre} | VETIX Distribuidora`,
      description,
      url: `${SITE_URL}/producto/${producto.id}`,
      images: producto.imagen_url
        ? [{ url: producto.imagen_url, alt: producto.nombre }]
        : [{ url: `${SITE_URL}/logo.png`, alt: "VETIX" }],
    },
    twitter: {
      card: "summary_large_image",
      title: producto.nombre,
      description,
      images: producto.imagen_url ? [producto.imagen_url] : [`${SITE_URL}/logo.png`],
    },
    alternates: { canonical: `${SITE_URL}/producto/${producto.id}` },
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return "$" + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function stockColor(stock: number) {
  if (stock <= 0)  return { text: "Sin stock",         color: "#ef4444" }
  if (stock === 1) return { text: "¡Última unidad!",   color: "#dc2626" }
  if (stock <= 3)  return { text: `Solo ${stock} uds`, color: "#dc2626" }
  if (stock <= 10) return { text: "Stock limitado",    color: "#92400e" }
  return               { text: "En stock",              color: "#16a34a" }
}

// ── Página ────────────────────────────────────────────────────────────────────

export default async function ProductoPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const producto = await getProducto(Number(id))
  if (!producto) notFound()

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  const stock = stockColor(producto.stock)
  const tiendaUrl = `${SITE_URL}/?producto=${producto.id}`

  return (
    <div style={{ minHeight: "100vh", background: "#f5f7fb", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>

      {/* Header mínimo */}
      <header style={{ background: "#0f172a", padding: "0 20px", height: 64, display: "flex", alignItems: "center", gap: 16, boxShadow: "0 2px 20px rgba(0,0,0,0.4)", position: "sticky", top: 0, zIndex: 10 }}>
        <a href={SITE_URL} style={{ display: "inline-flex", alignItems: "center", background: "white", borderRadius: 8, padding: "4px 10px", textDecoration: "none", flexShrink: 0 }}>
          <Image src="/logo.png" alt="VETIX Distribuidora" height={36} width={144} style={{ height: 36, width: "auto" }} priority />
        </a>
        <div style={{ flex: 1 }} />
        <a href={SITE_URL} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#94b8d8", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
          ← Ir a la tienda
        </a>
      </header>

      {/* Breadcrumb */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "14px 20px 0", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#94a3b8" }}>
        <a href={SITE_URL} style={{ color: "#64748b", textDecoration: "none", fontWeight: 600 }}>VETIX</a>
        <span>›</span>
        {producto.categoria && (
          <>
            <a href={`${SITE_URL}?categoria=${encodeURIComponent(producto.categoria)}`} style={{ color: "#64748b", textDecoration: "none" }}>{producto.categoria}</a>
            <span>›</span>
          </>
        )}
        <span style={{ color: "#1a2035", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }}>{producto.nombre}</span>
      </div>

      {/* Contenido principal */}
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "20px 20px 60px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 32, background: "white", borderRadius: 22, border: "1px solid #eaecf2", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>

          {/* Imagen */}
          <div style={{ background: "#f7f8fb", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 340, position: "relative" }}>
            {producto.imagen_url ? (
              <Image
                src={producto.imagen_url}
                alt={producto.nombre}
                fill
                sizes="(max-width: 640px) 90vw, 450px"
                style={{ objectFit: "contain", padding: 24 }}
                priority
              />
            ) : (
              <div style={{ fontSize: 80, opacity: 0.15 }}>📦</div>
            )}
          </div>

          {/* Info */}
          <div style={{ padding: "32px 28px", display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Badges */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {producto.categoria && (
                <span style={{ fontSize: 11, fontWeight: 800, background: "#fce7f3", color: "#e8197d", padding: "3px 10px", borderRadius: 20, border: "1px solid #fbcfe8" }}>
                  {producto.categoria}
                </span>
              )}
              {producto.laboratorio && (
                <span style={{ fontSize: 11, fontWeight: 800, background: "#f0fdf4", color: "#16a34a", padding: "3px 10px", borderRadius: 20, border: "1px solid #bbf7d0" }}>
                  {producto.laboratorio}
                </span>
              )}
            </div>

            {/* Nombre */}
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#1a2035", lineHeight: 1.35 }}>
              {producto.nombre}
            </h1>

            {/* Precio */}
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>Precio de referencia</p>
              <p style={{ margin: 0, fontSize: 36, fontWeight: 900, color: "#e8197d", lineHeight: 1 }}>{fmt(producto.precio_venta)}</p>
              <p style={{ margin: "5px 0 0", fontSize: 12, color: "#94a3b8" }}>Precio sujeto a confirmación al coordinar</p>
            </div>

            {/* Detalles */}
            <div style={{ background: "#f8fafc", borderRadius: 12, padding: "14px 16px", border: "1px solid #eaecf2", display: "flex", flexDirection: "column", gap: 8 }}>
              {producto.laboratorio && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#64748b", fontWeight: 600 }}>Laboratorio</span>
                  <span style={{ color: "#1a2035", fontWeight: 700 }}>{producto.laboratorio}</span>
                </div>
              )}
              {producto.categoria && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#64748b", fontWeight: 600 }}>Categoría</span>
                  <span style={{ color: "#1a2035", fontWeight: 700 }}>{producto.categoria}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#64748b", fontWeight: 600 }}>Disponibilidad</span>
                <span style={{ color: stock.color, fontWeight: 700 }}>{stock.text}</span>
              </div>
            </div>

            {/* CTA */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: "auto" }}>
              <a href={tiendaUrl}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px", background: "#e8197d", color: "white", borderRadius: 12, textDecoration: "none", fontSize: 15, fontWeight: 900, boxShadow: "0 4px 18px rgba(232,25,125,0.4)", textAlign: "center" }}>
                🛒 Agregar al carrito en la tienda
              </a>
              {process.env.NEXT_PUBLIC_WHATSAPP && (
                <a href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP}?text=${encodeURIComponent(`Hola, consulto por: ${producto.nombre}`)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", background: "rgba(37,211,102,0.08)", border: "1.5px solid rgba(37,211,102,0.25)", borderRadius: 12, color: "#16a34a", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                  Consultar por WhatsApp
                </a>
              )}
            </div>

          </div>
        </div>

        {/* Aviso */}
        <div style={{ marginTop: 20, background: "white", borderRadius: 14, border: "1px solid #eaecf2", padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>ℹ️</span>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "#1a2035" }}>Precios de referencia</p>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
              Los precios indicados son de referencia y se confirman al coordinar el pedido.
              Hacé tu pedido online y nos contactamos para coordinar pago, forma de entrega o retiro.
            </p>
          </div>
        </div>
      </main>

      {/* Footer mínimo */}
      <footer style={{ background: "#0d1120", color: "#475569", textAlign: "center", padding: "22px 20px", fontSize: 13 }}>
        <a href={SITE_URL} style={{ color: "#e8197d", textDecoration: "none", fontWeight: 700 }}>VETIX Distribuidora</a>
        {" — "}Distribuidora veterinaria al por mayor · Pedidos online las 24 hs
      </footer>

    </div>
  )
}
