"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

interface PedidoItem {
  id: number
  nombre_producto: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

interface Pedido {
  id: number
  created_at: string
  cliente_nombre: string
  cliente_email: string | null
  cliente_telefono: string | null
  cliente_direccion: string | null
  notas: string | null
  total: number
  estado: string
  items?: PedidoItem[]
}

const ESTADOS = ["pendiente", "confirmado", "entregado", "cancelado"]

const ESTADO_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  pendiente:   { bg: "#451a03", color: "#fbbf24", border: "#92400e" },
  confirmado:  { bg: "#052e16", color: "#4ade80", border: "#166534" },
  entregado:   { bg: "#1e293b", color: "#94a3b8", border: "#334155" },
  cancelado:   { bg: "#450a0a", color: "#f87171", border: "#7f1d1d" },
}

function fmt(n: number) {
  return "$" + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtFecha(s: string) {
  const d = new Date(s)
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto] = useState<number | null>(null)
  const [filtroEstado, setFiltroEstado] = useState("")
  const [actualizando, setActualizando] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const mostrarToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from("pedidos")
      .select("*, pedido_items(*)")
      .order("created_at", { ascending: false })
    if (data) {
      setPedidos(data.map((p: any) => ({ ...p, items: p.pedido_items })))
    }
    setCargando(false)
  }

  async function cambiarEstado(id: number, estado: string) {
    setActualizando(id)
    const { error } = await supabase.from("pedidos").update({ estado }).eq("id", id)
    if (!error) {
      setPedidos(prev => prev.map(p => p.id === id ? { ...p, estado } : p))
      mostrarToast("Estado actualizado")
    }
    setActualizando(null)
  }

  const pedidosFiltrados = filtroEstado ? pedidos.filter(p => p.estado === filtroEstado) : pedidos

  const totalPendientes = pedidos.filter(p => p.estado === "pendiente").length

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f1f5f9", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#1e293b", borderBottom: "1px solid #334155", padding: "14px 32px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/" style={{
          display: "flex", alignItems: "center", gap: 8, color: "#94a3b8",
          textDecoration: "none", fontSize: 14, padding: "6px 12px", borderRadius: 8,
          background: "#0f172a", border: "1px solid #334155"
        }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Volver a la tienda
        </Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9", display: "flex", alignItems: "center", gap: 10 }}>
            Pedidos
            {totalPendientes > 0 && (
              <span style={{ background: "#e8197d", color: "white", fontSize: 12, fontWeight: 800, padding: "2px 10px", borderRadius: 20 }}>
                {totalPendientes} pendiente{totalPendientes !== 1 ? "s" : ""}
              </span>
            )}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Pedidos recibidos desde la tienda online</p>
        </div>
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, background: "#0f172a", border: "1px solid #334155", color: "#f1f5f9", fontSize: 13, cursor: "pointer" }}
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>)}
        </select>
        <button onClick={cargar} style={{ padding: "8px 14px", borderRadius: 8, background: "#0f172a", border: "1px solid #334155", color: "#94a3b8", fontSize: 13, cursor: "pointer" }}>
          ↻ Actualizar
        </button>
      </div>

      <div style={{ padding: "24px 32px", maxWidth: 1000, margin: "0 auto" }}>
        {cargando ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />
            ))}
          </div>
        ) : pedidosFiltrados.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#475569" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
              {filtroEstado ? `No hay pedidos ${filtroEstado}s` : "Aún no hay pedidos"}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pedidosFiltrados.map(p => {
              const est = ESTADO_COLORS[p.estado] ?? ESTADO_COLORS.pendiente
              const expandido = abierto === p.id
              return (
                <div key={p.id} style={{ background: "#1e293b", borderRadius: 12, border: "1px solid #334155", overflow: "hidden" }}>
                  {/* Fila principal */}
                  <div
                    onClick={() => setAbierto(expandido ? null : p.id)}
                    style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#64748b", minWidth: 70 }}>
                      N° {String(p.id).padStart(4, "0")}
                    </span>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontWeight: 700, color: "#f1f5f9", fontSize: 15 }}>{p.cliente_nombre}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                        {p.cliente_telefono && <span>📱 {p.cliente_telefono}</span>}
                        {p.cliente_email && <span style={{ marginLeft: 10 }}>✉ {p.cliente_email}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", minWidth: 100 }}>
                      <div style={{ fontWeight: 800, fontSize: 16, color: "#e8197d" }}>{fmt(p.total)}</div>
                      <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{fmtFecha(p.created_at)}</div>
                    </div>
                    <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: est.bg, color: est.color, border: `1px solid ${est.border}` }}>
                      {p.estado}
                    </span>
                    <span style={{ color: "#475569", fontSize: 16 }}>{expandido ? "▲" : "▼"}</span>
                  </div>

                  {/* Detalle expandido */}
                  {expandido && (
                    <div style={{ borderTop: "1px solid #334155", padding: "16px 20px", background: "#0f172a" }}>
                      {/* Items */}
                      <div style={{ marginBottom: 16 }}>
                        <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5 }}>Productos</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {p.items?.map(item => (
                            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#cbd5e1", gap: 8 }}>
                              <span style={{ flex: 1 }}>{item.nombre_producto} <span style={{ color: "#475569" }}>×{item.cantidad}</span></span>
                              <span style={{ fontWeight: 600, color: "#f1f5f9" }}>{fmt(item.subtotal)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Info cliente */}
                      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16, fontSize: 13, color: "#94a3b8" }}>
                        {p.cliente_direccion && <span>📍 {p.cliente_direccion}</span>}
                        {p.notas && <span>📝 {p.notas}</span>}
                      </div>

                      {/* Cambiar estado */}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, color: "#475569", alignSelf: "center" }}>Cambiar estado:</span>
                        {ESTADOS.map(e => (
                          <button
                            key={e}
                            onClick={() => cambiarEstado(p.id, e)}
                            disabled={p.estado === e || actualizando === p.id}
                            style={{
                              padding: "5px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                              background: p.estado === e ? ESTADO_COLORS[e].bg : "#1e293b",
                              color: p.estado === e ? ESTADO_COLORS[e].color : "#64748b",
                              border: `1px solid ${p.estado === e ? ESTADO_COLORS[e].border : "#334155"}`,
                              cursor: p.estado === e ? "default" : "pointer"
                            }}
                          >
                            {e.charAt(0).toUpperCase() + e.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {!cargando && pedidosFiltrados.length > 0 && (
          <p style={{ margin: "16px 0 0", color: "#475569", fontSize: 13, textAlign: "right" }}>
            {pedidosFiltrados.length} pedido{pedidosFiltrados.length !== 1 ? "s" : ""}
            {" · Total: "}
            <b style={{ color: "#f1f5f9" }}>{fmt(pedidosFiltrados.reduce((s, p) => s + p.total, 0))}</b>
          </p>
        )}
      </div>

      {toast && (
        <div className="toast-anim" style={{
          position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
          background: "#16a34a", color: "#fff", padding: "12px 24px", borderRadius: 10,
          fontSize: 14, fontWeight: 600, boxShadow: "0 4px 24px #0008", zIndex: 9999
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}
