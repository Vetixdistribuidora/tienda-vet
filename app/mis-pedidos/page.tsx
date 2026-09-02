"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { supabase } from "@/lib/supabase"

// ── Tipos ─────────────────────────────────────────────────────────────────
type Item = { producto_id: number | null; nombre_producto: string; cantidad: number; precio_unitario: number }
type Pedido = { id: number; created_at: string; estado: string; total: number | null; pedido_items: Item[] }

type Factura = {
  id: number; nro_factura: string | null; fecha: string
  total: number; pagado: number; pendiente: number
  estado_pago: "pagada" | "parcial" | "pendiente"
}
type Pago = {
  id: number; fecha: string; monto: number
  metodo_pago: string | null; nro_recibo: string | null; venta_id: number | null
}
type Cuenta = {
  vinculado: boolean
  cliente?: { nombre: string; tipo_cliente: string | null }
  resumen?: { saldo: number; saldo_favor: number; neto: number; facturas_pendientes: number; total_pagado: number }
  facturas?: Factura[]
  pagos?: Pago[]
}

// ── Estilos de estado ─────────────────────────────────────────────────────
const ESTADO_ENVIO: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pendiente:        { label: "Pendiente",     color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.3)"  },
  confirmado:       { label: "Confirmado",    color: "#4ade80", bg: "rgba(74,222,128,0.1)",  border: "rgba(74,222,128,0.3)"  },
  "en preparación": { label: "En preparación",color: "#a78bfa", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.3)" },
  preparando:       { label: "Preparando",    color: "#a78bfa", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.3)" },
  enviado:          { label: "Enviado",       color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.3)"  },
  entregado:        { label: "Entregado",     color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.3)" },
  cancelado:        { label: "Cancelado",     color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)" },
}
const ESTADO_PAGO: Record<Factura["estado_pago"], { label: string; color: string; bg: string; border: string }> = {
  pagada:    { label: "Pagada",             color: "#4ade80", bg: "rgba(74,222,128,0.12)", border: "rgba(74,222,128,0.3)" },
  parcial:   { label: "Pago parcial",       color: "#fbbf24", bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.3)" },
  pendiente: { label: "Pendiente de pago",  color: "#f87171", bg: "rgba(248,113,113,0.12)",border: "rgba(248,113,113,0.3)" },
}

function fmt(n: number) {
  return "$" + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtFecha(s: string, conHora = false) {
  return new Date(s).toLocaleDateString("es-AR",
    conHora ? { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }
            : { day: "2-digit", month: "short", year: "numeric" })
}
const cap = (s: string | null | undefined) => s ? s.charAt(0).toUpperCase() + s.slice(1) : ""

// ── Componentes chicos ────────────────────────────────────────────────────
function Badge({ e }: { e: { label: string; color: string; bg: string; border: string } }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: e.color, background: e.bg, border: `1px solid ${e.border}`, borderRadius: 20, padding: "2px 10px", whiteSpace: "nowrap" }}>
      {e.label}
    </span>
  )
}
function SectionTitle({ children, icon }: { children: React.ReactNode; icon: string }) {
  return (
    <h2 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 800, color: "#f0c8d8", display: "flex", alignItems: "center", gap: 8 }}>
      <span aria-hidden>{icon}</span>{children}
    </h2>
  )
}

export default function MiCuentaPage() {
  const [cuenta, setCuenta] = useState<Cuenta | null>(null)
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [cargando, setCargando] = useState(true)
  const [sinSesion, setSinSesion] = useState(false)
  const [abierto, setAbierto] = useState<number | null>(null)
  const [verPagos, setVerPagos] = useState(false)

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setSinSesion(true); setCargando(false); return }

      // Pedidos online (envío) — lectura directa con RLS del cliente
      const pedidosProm = supabase
        .from("pedidos")
        .select("id, created_at, estado, total, pedido_items(producto_id, nombre_producto, cantidad, precio_unitario)")
        .or(`usuario_id.eq.${session.user.id},cliente_email.eq.${session.user.email}`)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50)

      // Cuenta corriente (saldo/facturas/pagos) — vía API server-side
      const cuentaProm = fetch("/api/mi-cuenta", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).then(r => r.ok ? r.json() : { vinculado: false }).catch(() => ({ vinculado: false }))

      const [{ data: pedidosData }, cuentaData] = await Promise.all([pedidosProm, cuentaProm])
      setPedidos((pedidosData as Pedido[]) ?? [])
      setCuenta(cuentaData as Cuenta)
      setCargando(false)
    })()
  }, [])

  const r = cuenta?.resumen
  const vinculado = cuenta?.vinculado
  const facturas = cuenta?.facturas ?? []
  const pagos = cuenta?.pagos ?? []

  return (
    <div style={{ minHeight: "100vh", background: "#1a2035", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <header style={{ background: "#fde8f0", borderBottom: "1px solid #f0c8d8", position: "sticky", top: 0, zIndex: 10, boxShadow: "0 2px 12px rgba(15,23,42,0.08)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 20px", height: 70, display: "flex", alignItems: "center", gap: 16 }}>
          <a href="/" style={{ display: "inline-flex", lineHeight: 0, textDecoration: "none" }}>
            <Image src="/vetix-azul.jpeg" alt="VETIX" height={54} width={216} style={{ height: 54, width: "auto", mixBlendMode: "multiply" }} priority />
          </a>
          <div style={{ flex: 1 }} />
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, background: "#1a2035", color: "white", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
            ← Volver a la tienda
          </a>
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "36px 20px 80px" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 900, color: "white" }}>Mi cuenta</h1>
        <p style={{ margin: "0 0 32px", fontSize: 14, color: "#94b8d8" }}>
          {cuenta?.cliente?.nombre
            ? <>Hola, {cap(cuenta.cliente.nombre)} · el estado de tu cuenta corriente y tus pedidos</>
            : <>El estado de tu cuenta corriente y tus pedidos</>}
        </p>

        {cargando && <div style={{ textAlign: "center", padding: "60px 0", color: "#94b8d8" }}>Cargando...</div>}

        {/* Sin sesión */}
        {!cargando && sinSesion && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ color: "#94b8d8", fontSize: 15, marginBottom: 20 }}>Necesitás iniciar sesión para ver tu cuenta</p>
            <a href="/" style={{ display: "inline-block", padding: "12px 28px", background: "#d4688e", color: "white", borderRadius: 10, textDecoration: "none", fontWeight: 800, fontSize: 14 }}>Ir a la tienda</a>
          </div>
        )}

        {!cargando && !sinSesion && (
          <>
            {/* ── RESUMEN ── */}
            {vinculado && r && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 32 }}>
                <div style={{ background: r.saldo > 0 ? "rgba(248,113,113,0.1)" : "rgba(74,222,128,0.1)", border: `1px solid ${r.saldo > 0 ? "rgba(248,113,113,0.25)" : "rgba(74,222,128,0.25)"}`, borderRadius: 16, padding: "18px 20px" }}>
                  <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: r.saldo > 0 ? "#f87171" : "#4ade80" }}>Saldo a pagar</p>
                  <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: r.saldo > 0 ? "#f87171" : "#4ade80" }}>
                    {r.saldo > 0 ? fmt(r.saldo) : "¡Al día!"}
                  </p>
                </div>
                {r.saldo_favor > 0 && (
                  <div style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: 16, padding: "18px 20px" }}>
                    <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "#4ade80" }}>Saldo a favor</p>
                    <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#4ade80" }}>{fmt(r.saldo_favor)}</p>
                  </div>
                )}
                <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "18px 20px" }}>
                  <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "#94b8d8" }}>Facturas pendientes</p>
                  <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "white" }}>{r.facturas_pendientes}</p>
                </div>
                <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "18px 20px" }}>
                  <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "#94b8d8" }}>Total pagado</p>
                  <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "white" }}>{fmt(r.total_pagado)}</p>
                </div>
              </div>
            )}

            {/* Cuenta no vinculada todavía */}
            {vinculado === false && (
              <div style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 16, padding: "20px 22px", marginBottom: 32, display: "flex", gap: 14, alignItems: "flex-start" }}>
                <span style={{ fontSize: 22 }} aria-hidden>ℹ️</span>
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: "white" }}>Tu cuenta corriente todavía no está vinculada</p>
                  <p style={{ margin: 0, fontSize: 13, color: "#94b8d8", lineHeight: 1.6 }}>
                    Estamos asociando tu usuario con tu ficha de cliente. En cuanto lo hagamos, vas a ver acá tu saldo, tus facturas y tus pagos. Mientras tanto podés ver tus pedidos abajo.
                  </p>
                </div>
              </div>
            )}

            {/* ── FACTURAS / CUENTA CORRIENTE ── */}
            {vinculado && facturas.length > 0 && (
              <div style={{ marginBottom: 34 }}>
                <SectionTitle icon="📄">Facturas y cuenta corriente</SectionTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {facturas.map(f => {
                    const ep = ESTADO_PAGO[f.estado_pago]
                    const expandido = abierto === f.id
                    return (
                      <div key={f.id} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, overflow: "hidden" }}>
                        <button onClick={() => setAbierto(expandido ? null : f.id)}
                          style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                              <span style={{ fontSize: 14, fontWeight: 800, color: "white" }}>
                                {f.nro_factura ? `Factura ${f.nro_factura}` : `Venta #${f.id}`}
                              </span>
                              <Badge e={ep} />
                            </div>
                            <span style={{ fontSize: 12, color: "#64748b" }}>{fmtFecha(f.fecha)}</span>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 16, fontWeight: 900, color: "white" }}>{fmt(f.total)}</div>
                            {f.pendiente > 0 && <div style={{ fontSize: 11, color: "#f87171", fontWeight: 700 }}>Debe {fmt(f.pendiente)}</div>}
                          </div>
                          <span style={{ color: "#64748b", fontSize: 16, flexShrink: 0, transition: "transform 0.2s", transform: expandido ? "rotate(90deg)" : "none" }}>›</span>
                        </button>
                        {expandido && (
                          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: "12px 18px 16px", fontSize: 13, color: "#94b8d8" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>Total de la factura</span><span style={{ color: "white", fontWeight: 700 }}>{fmt(f.total)}</span></div>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>Pagado</span><span style={{ color: "#4ade80", fontWeight: 700 }}>{fmt(f.pagado)}</span></div>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 4 }}><span>Saldo pendiente</span><span style={{ color: f.pendiente > 0 ? "#f87171" : "#4ade80", fontWeight: 800 }}>{fmt(f.pendiente)}</span></div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── PAGOS / RECIBOS ── */}
            {vinculado && pagos.length > 0 && (
              <div style={{ marginBottom: 34 }}>
                <button onClick={() => setVerPagos(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 12 }}>
                  <SectionTitle icon="🧾">Mis pagos ({pagos.length}) <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{verPagos ? "▲ ocultar" : "▼ ver"}</span></SectionTitle>
                </button>
                {verPagos && (
                  <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, overflow: "hidden" }}>
                    {pagos.map((p, i) => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "white" }}>
                            {cap(p.metodo_pago) || "Pago"}{p.nro_recibo ? ` · Recibo ${p.nro_recibo}` : ""}
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>{fmtFecha(p.fecha)}{p.venta_id ? ` · Factura #${p.venta_id}` : ""}</div>
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 800, color: "#4ade80", flexShrink: 0 }}>{fmt(p.monto)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── PEDIDOS ONLINE (envío) ── */}
            <div>
              <SectionTitle icon="📦">Mis pedidos online</SectionTitle>
              {pedidos.length === 0 ? (
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "28px 20px", textAlign: "center" }}>
                  <p style={{ color: "#94b8d8", fontSize: 14, margin: "0 0 16px" }}>Todavía no hiciste ningún pedido desde la tienda</p>
                  <a href="/" style={{ display: "inline-block", padding: "10px 22px", background: "#d4688e", color: "white", borderRadius: 10, textDecoration: "none", fontWeight: 800, fontSize: 13 }}>Ver catálogo</a>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {pedidos.map(p => {
                    const est = ESTADO_ENVIO[p.estado] ?? { label: cap(p.estado), color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.3)" }
                    const expandido = abierto === -p.id
                    const totalItems = p.pedido_items?.reduce((s, i) => s + i.cantidad, 0) ?? 0
                    return (
                      <div key={p.id} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, overflow: "hidden" }}>
                        <button onClick={() => setAbierto(expandido ? null : -p.id)}
                          style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                              <span style={{ fontSize: 14, fontWeight: 800, color: "white" }}>Pedido #{p.id}</span>
                              <Badge e={est} />
                            </div>
                            <span style={{ fontSize: 12, color: "#64748b" }}>{fmtFecha(p.created_at, true)} · {totalItems} ítem{totalItems !== 1 ? "s" : ""}</span>
                          </div>
                          {p.total != null && p.total > 0 && <span style={{ fontSize: 16, fontWeight: 900, color: "#d4688e", flexShrink: 0 }}>{fmt(p.total)}</span>}
                          <span style={{ color: "#64748b", fontSize: 16, flexShrink: 0, transition: "transform 0.2s", transform: expandido ? "rotate(90deg)" : "none" }}>›</span>
                        </button>
                        {expandido && (
                          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: "14px 18px 18px" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                              <tbody>
                                {p.pedido_items?.map((item, idx) => (
                                  <tr key={idx} style={{ borderTop: idx > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                                    <td style={{ padding: "8px 0", fontSize: 13, color: "white" }}>{item.nombre_producto}</td>
                                    <td style={{ padding: "8px 0", textAlign: "right", fontSize: 13, color: "#94b8d8", fontWeight: 700, whiteSpace: "nowrap" }}>× {item.cantidad}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
