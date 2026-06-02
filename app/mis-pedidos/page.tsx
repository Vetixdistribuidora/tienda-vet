"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { supabase } from "@/lib/supabase"

type Item = { producto_id: number | null; nombre_producto: string; cantidad: number; precio_unitario: number }
type Pedido = {
  id: number; created_at: string; estado: string; total: number | null
  pedido_items: Item[]
}

const ESTADO: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pendiente:   { label: "Pendiente",   color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.3)"  },
  confirmado:  { label: "Confirmado",  color: "#4ade80", bg: "rgba(74,222,128,0.1)",  border: "rgba(74,222,128,0.3)"  },
  preparando:  { label: "Preparando",  color: "#a78bfa", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.3)" },
  enviado:     { label: "Enviado",     color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.3)"  },
  entregado:   { label: "Entregado",   color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.3)" },
  cancelado:   { label: "Cancelado",   color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)" },
}

function fmt(n: number) {
  return "$" + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtFecha(s: string) {
  return new Date(s).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

export default function MisPedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto] = useState<number | null>(null)
  const [sinSesion, setSinSesion] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setSinSesion(true); setCargando(false); return }
      const { data } = await supabase
        .from("pedidos")
        .select("id, created_at, estado, total, pedido_items(producto_id, nombre_producto, cantidad, precio_unitario)")
        .or(`usuario_id.eq.${session.user.id},cliente_email.eq.${session.user.email}`)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50)
      setPedidos((data as Pedido[]) ?? [])
      setCargando(false)
    })
  }, [])

  return (
    <div style={{ minHeight: "100vh", background: "#1a2035", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <header style={{ background: "#fde8f0", borderBottom: "1px solid #f0c8d8", position: "sticky", top: 0, zIndex: 10, boxShadow: "0 2px 12px rgba(15,23,42,0.08)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 20px", height: 70, display: "flex", alignItems: "center", gap: 16 }}>
          <a href="/" style={{ display: "inline-flex", lineHeight: 0, textDecoration: "none" }}>
            <Image src="/vetix-azul.jpeg" alt="VETIX" height={54} width={216} style={{ height: 54, width: "auto", mixBlendMode: "multiply" }} priority />
          </a>
          <div style={{ flex: 1 }} />
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, background: "#1a2035", color: "white", textDecoration: "none", fontSize: 13, fontWeight: 700, transition: "background 0.15s" }}>
            ← Volver a la tienda
          </a>
        </div>
      </header>

      {/* Contenido */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "36px 20px 80px" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 900, color: "white" }}>Mis pedidos</h1>
        <p style={{ margin: "0 0 32px", fontSize: 14, color: "#94b8d8" }}>Historial de tus pedidos realizados</p>

        {cargando && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#94b8d8" }}>Cargando...</div>
        )}

        {sinSesion && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ color: "#94b8d8", fontSize: 15, marginBottom: 20 }}>Necesitás iniciar sesión para ver tus pedidos</p>
            <a href="/" style={{ display: "inline-block", padding: "12px 28px", background: "#d4688e", color: "white", borderRadius: 10, textDecoration: "none", fontWeight: 800, fontSize: 14 }}>Ir a la tienda</a>
          </div>
        )}

        {!cargando && !sinSesion && pedidos.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
            <p style={{ color: "white", fontSize: 17, fontWeight: 800, marginBottom: 8 }}>Todavía no hiciste ningún pedido</p>
            <p style={{ color: "#94b8d8", fontSize: 14, marginBottom: 24 }}>Explorá el catálogo y agregá productos al carrito</p>
            <a href="/" style={{ display: "inline-block", padding: "12px 28px", background: "#d4688e", color: "white", borderRadius: 10, textDecoration: "none", fontWeight: 800, fontSize: 14 }}>Ver catálogo</a>
          </div>
        )}

        {!cargando && pedidos.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {pedidos.map(p => {
              const est = ESTADO[p.estado] ?? { label: p.estado, color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.3)" }
              const expandido = abierto === p.id
              const totalItems = p.pedido_items?.reduce((s, i) => s + i.cantidad, 0) ?? 0
              return (
                <div key={p.id}
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, overflow: "hidden", transition: "border-color 0.15s" }}>

                  {/* Fila resumen */}
                  <button onClick={() => setAbierto(expandido ? null : p.id)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "white" }}>Pedido #{p.id}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: est.color, background: est.bg, border: `1px solid ${est.border}`, borderRadius: 20, padding: "2px 10px" }}>
                          {est.label}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, color: "#64748b" }}>{fmtFecha(p.created_at)} · {totalItems} ítem{totalItems !== 1 ? "s" : ""}</span>
                    </div>
                    {p.total != null && p.total > 0 && (
                      <span style={{ fontSize: 16, fontWeight: 900, color: "#d4688e", flexShrink: 0 }}>{fmt(p.total)}</span>
                    )}
                    <span style={{ color: "#64748b", fontSize: 16, flexShrink: 0, transition: "transform 0.2s", display: "inline-block", transform: expandido ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
                  </button>

                  {/* Detalle */}
                  {expandido && (
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: "16px 20px 20px" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: "left", fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, padding: "0 0 10px" }}>Producto</th>
                            <th style={{ textAlign: "center", fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, padding: "0 0 10px" }}>Cant.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.pedido_items?.map((item, idx) => (
                            <tr key={idx} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                              <td style={{ padding: "9px 0", fontSize: 13, color: "white", fontWeight: 500 }}>{item.nombre_producto}</td>
                              <td style={{ padding: "9px 0", textAlign: "center", fontSize: 13, color: "#94b8d8", fontWeight: 700 }}>{item.cantidad}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(212,104,142,0.08)", border: "1px solid rgba(212,104,142,0.2)", borderRadius: 10, fontSize: 12, color: "#94b8d8", lineHeight: 1.6 }}>
                        🕐 Los precios y detalles de entrega se coordinan directamente con nosotros.
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
