"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Image from "next/image"
import Link from "next/link"

// ── Types ─────────────────────────────────────────────────────────────────────
type TipoCliente = "veterinario" | "productor" | "pendiente"

type ClienteAdmin = {
  id: string
  nombre: string
  apellido: string
  email: string
  telefono: string
  tipo_cliente: TipoCliente
  created_at: string | null
}

type PedidoItemAdmin = {
  nombre_producto: string
  cantidad: number
  precio_unitario: number
}

type PedidoAdmin = {
  id: number
  created_at: string
  cliente_nombre: string
  cliente_email: string | null
  cliente_telefono: string | null
  estado: string
  total: number
  notas: string | null
  pedido_items: PedidoItemAdmin[]
}

type ProductoAdmin = {
  id: number
  nombre: string
  precio_venta: number
  stock: number
  categoria: string | null
  laboratorio: string | null
  imagen_url: string | null
}

// ── Constantes ────────────────────────────────────────────────────────────────
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? ""
const ESTADOS = ["pendiente", "confirmado", "en preparación", "enviado", "entregado", "cancelado"]

const fmt = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })

const TIPO_STYLE: Record<TipoCliente, { bg: string; border: string; color: string }> = {
  veterinario: { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
  productor:   { bg: "#f0fdf4", border: "#bbf7d0", color: "#15803d" },
  pendiente:   { bg: "#fffbeb", border: "#fde68a", color: "#92400e" },
}

const ESTADO_STYLE: Record<string, { bg: string; border: string; color: string }> = {
  pendiente:        { bg: "#fffbeb", border: "#fde68a",  color: "#92400e" },
  confirmado:       { bg: "#eff6ff", border: "#bfdbfe",  color: "#1d4ed8" },
  "en preparación": { bg: "#faf5ff", border: "#ddd6fe",  color: "#7c3aed" },
  enviado:          { bg: "#fff7ed", border: "#fed7aa",  color: "#c2410c" },
  entregado:        { bg: "#f0fdf4", border: "#bbf7d0",  color: "#15803d" },
  cancelado:        { bg: "#fef2f2", border: "#fecaca",  color: "#dc2626" },
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function AdminPanel() {
  type Tab = "clientes" | "pedidos" | "categorias" | "productos"
  const [tab, setTab] = useState<Tab>("clientes")
  const [token, setToken] = useState<string | null>(null)
  const [esAdmin, setEsAdmin] = useState(false)
  const [verificando, setVerificando] = useState(true)

  // Clientes
  const [clientes, setClientes] = useState<ClienteAdmin[]>([])
  const [cargandoClientes, setCargandoClientes] = useState(false)
  const [busqClientes, setBusqClientes] = useState("")
  const [filtroTipo, setFiltroTipo] = useState("todos")
  const [guardandoTipo, setGuardandoTipo] = useState<string | null>(null)

  // Pedidos
  const [pedidos, setPedidos] = useState<PedidoAdmin[]>([])
  const [cargandoPedidos, setCargandoPedidos] = useState(false)
  const [pedidoExpanded, setPedidoExpanded] = useState<number | null>(null)
  const [filtroEstado, setFiltroEstado] = useState("todos")
  const [guardandoEstado, setGuardandoEstado] = useState<number | null>(null)

  // Productos (compartido entre Categorías y Productos)
  const [productos, setProductos] = useState<ProductoAdmin[]>([])
  const [cargandoProds, setCargandoProds] = useState(false)

  // Tab Categorías
  const [busqCat, setBusqCat] = useState("")
  const [editCatId, setEditCatId] = useState<number | null>(null)
  const [editCatVal, setEditCatVal] = useState("")
  const [guardandoCat, setGuardandoCat] = useState<number | null>(null)

  // Tab Productos
  const [busqProd, setBusqProd] = useState("")
  const [editProducto, setEditProducto] = useState<ProductoAdmin | null>(null)
  const [editFields, setEditFields] = useState<Partial<ProductoAdmin & { categoria: string; laboratorio: string }>>({})
  const [guardandoProd, setGuardandoProd] = useState(false)

  // ── Auth check ───────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token && session.user.email === ADMIN_EMAIL) {
        setToken(session.access_token)
        setEsAdmin(true)
      }
      setVerificando(false)
    })
  }, [])

  // Load initial tab after admin confirmed
  useEffect(() => {
    if (esAdmin && token) cargarClientes()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esAdmin, token])

  // Load data on tab change
  useEffect(() => {
    if (!esAdmin || !token) return
    if (tab === "pedidos" && pedidos.length === 0) cargarPedidos()
    if ((tab === "categorias" || tab === "productos") && productos.length === 0) cargarProductos()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // ── API helper ────────────────────────────────────────────────────────────────
  function apiFetch(path: string, init: RequestInit = {}) {
    return fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token ?? ""}`,
      },
    })
  }

  // ── Loaders ───────────────────────────────────────────────────────────────────
  async function cargarClientes() {
    setCargandoClientes(true)
    const res = await apiFetch("/api/admin/clientes")
    if (res.ok) setClientes(await res.json())
    setCargandoClientes(false)
  }

  async function cargarPedidos() {
    setCargandoPedidos(true)
    const res = await apiFetch("/api/admin/pedidos")
    if (res.ok) setPedidos(await res.json())
    setCargandoPedidos(false)
  }

  async function cargarProductos() {
    setCargandoProds(true)
    const res = await apiFetch("/api/admin/productos")
    if (res.ok) setProductos(await res.json())
    setCargandoProds(false)
  }

  // ── Actions ───────────────────────────────────────────────────────────────────
  async function cambiarTipo(cliente: ClienteAdmin, tipo: TipoCliente) {
    setGuardandoTipo(cliente.id)
    setClientes(cs => cs.map(c => c.id === cliente.id ? { ...c, tipo_cliente: tipo } : c))
    await apiFetch(`/api/admin/clientes/${cliente.id}`, {
      method: "PATCH",
      body: JSON.stringify({ tipo_cliente: tipo, email: cliente.email }),
    })
    setGuardandoTipo(null)
  }

  async function cambiarEstado(pedidoId: number, estado: string) {
    setGuardandoEstado(pedidoId)
    setPedidos(ps => ps.map(p => p.id === pedidoId ? { ...p, estado } : p))
    await apiFetch(`/api/admin/pedidos/${pedidoId}`, {
      method: "PATCH",
      body: JSON.stringify({ estado }),
    })
    setGuardandoEstado(null)
  }

  async function guardarCategoria(id: number, cat: string) {
    setGuardandoCat(id)
    const catFinal = cat.trim() || null
    setProductos(ps => ps.map(p => p.id === id ? { ...p, categoria: catFinal } : p))
    await apiFetch(`/api/admin/productos/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ categoria: catFinal }),
    })
    setGuardandoCat(null)
    setEditCatId(null)
  }

  async function guardarProducto() {
    if (!editProducto) return
    setGuardandoProd(true)
    const updates: Record<string, unknown> = {}
    if (editFields.nombre !== undefined) updates.nombre = editFields.nombre
    if (editFields.precio_venta !== undefined) updates.precio_venta = editFields.precio_venta
    if (editFields.categoria !== undefined) updates.categoria = (editFields.categoria as string).trim() || null
    if (editFields.laboratorio !== undefined) updates.laboratorio = (editFields.laboratorio as string).trim() || null
    if (editFields.stock !== undefined) updates.stock = editFields.stock
    await apiFetch(`/api/admin/productos/${editProducto.id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    })
    setProductos(ps => ps.map(p =>
      p.id === editProducto.id
        ? { ...p, ...updates, categoria: updates.categoria as string | null, laboratorio: updates.laboratorio as string | null }
        : p
    ))
    setGuardandoProd(false)
    setEditProducto(null)
  }

  // ── Derived data ─────────────────────────────────────────────────────────────
  const categoriasExistentes = Array.from(
    new Set(productos.filter(p => p.categoria).map(p => p.categoria!))
  ).sort()

  const clientesFiltrados = clientes
    .filter(c => filtroTipo === "todos" || c.tipo_cliente === filtroTipo)
    .filter(c => {
      if (!busqClientes) return true
      const q = busqClientes.toLowerCase()
      return `${c.nombre} ${c.apellido} ${c.email}`.toLowerCase().includes(q)
    })

  const pedidosFiltrados = pedidos.filter(p =>
    filtroEstado === "todos" || p.estado === filtroEstado
  )

  const totalPedidosFiltrados = pedidosFiltrados.reduce((s, p) => s + (p.total ?? 0), 0)

  const productosCatFiltrados = productos.filter(p =>
    !busqCat || p.nombre.toLowerCase().includes(busqCat.toLowerCase())
  )

  const productosFiltrados = productos.filter(p =>
    !busqProd ||
    p.nombre.toLowerCase().includes(busqProd.toLowerCase()) ||
    (p.laboratorio ?? "").toLowerCase().includes(busqProd.toLowerCase())
  )

  // ── Loading / not admin ───────────────────────────────────────────────────────
  if (verificando) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #e8197d", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (!esAdmin) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🔒</div>
          <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 900, color: "white" }}>Acceso restringido</h1>
          <p style={{ margin: "0 0 24px", color: "#64748b", fontSize: 14 }}>
            {ADMIN_EMAIL
              ? "Iniciá sesión con la cuenta admin en la tienda para continuar."
              : "Configurá NEXT_PUBLIC_ADMIN_EMAIL en Vercel para habilitar el panel."}
          </p>
          <Link href="/" style={{ color: "#e8197d", fontWeight: 700, textDecoration: "none", fontSize: 14 }}>
            ← Volver a la tienda
          </Link>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  // ── Admin UI ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ background: "#0f172a", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 16px rgba(0,0,0,0.35)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 54 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Image src="/logo.png" alt="VETIX" height={28} width={112} style={{ height: 28, width: "auto" }} priority />
            <span style={{ fontSize: 10.5, fontWeight: 800, background: "#e8197d", color: "white", borderRadius: 6, padding: "2px 8px", textTransform: "uppercase", letterSpacing: 0.8 }}>
              Admin
            </span>
          </div>
          <Link href="/" style={{ fontSize: 12, color: "#64748b", textDecoration: "none", fontWeight: 600 }}>
            ← Tienda
          </Link>
        </div>

        {/* Tabs */}
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px", display: "flex", gap: 0, overflowX: "auto" }}>
          {(["clientes", "pedidos", "categorias", "productos"] as Tab[]).map(t => {
            const labels: Record<Tab, string> = {
              clientes: clientes.length ? `Clientes (${clientes.length})` : "Clientes",
              pedidos: pedidos.length ? `Pedidos (${pedidos.length})` : "Pedidos",
              categorias: "Categorías",
              productos: productos.length ? `Productos (${productos.length})` : "Productos",
            }
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "13px 18px",
                  background: "none",
                  border: "none",
                  borderBottom: `2.5px solid ${tab === t ? "#e8197d" : "transparent"}`,
                  color: tab === t ? "white" : "#64748b",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: tab === t ? 800 : 600,
                  whiteSpace: "nowrap",
                  transition: "color 0.15s",
                }}
              >
                {labels[t]}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px" }}>

        {/* ════════════════ TAB CLIENTES ════════════════ */}
        {tab === "clientes" && (
          <div>
            {/* Toolbar */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <input
                placeholder="Buscar por nombre o email..."
                value={busqClientes}
                onChange={e => setBusqClientes(e.target.value)}
                style={{ flex: 1, minWidth: 200, padding: "9px 14px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: 13, outline: "none", background: "white" }}
                onFocus={e => (e.target.style.borderColor = "#e8197d")}
                onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
              />
              <select
                value={filtroTipo}
                onChange={e => setFiltroTipo(e.target.value)}
                style={{ padding: "9px 14px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: 13, background: "white", cursor: "pointer", outline: "none" }}
              >
                <option value="todos">Todos los tipos</option>
                <option value="veterinario">Veterinarios</option>
                <option value="productor">Productores</option>
                <option value="pendiente">Pendientes</option>
              </select>
              <button
                onClick={cargarClientes}
                style={{ padding: "9px 16px", background: "#1a2035", color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                ↺ Actualizar
              </button>
            </div>

            {cargandoClientes ? <Spinner /> : (
              <div style={{ background: "white", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                      {["Cliente", "Email", "Teléfono", "Tipo"].map(h => (
                        <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 10.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clientesFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: "48px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                          Sin resultados
                        </td>
                      </tr>
                    ) : clientesFiltrados.map((c, i) => {
                      const ts = TIPO_STYLE[c.tipo_cliente] ?? TIPO_STYLE.pendiente
                      return (
                        <tr key={c.id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "white" : "#fafbfc" }}>
                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#475569", flexShrink: 0 }}>
                                {c.nombre?.[0]?.toUpperCase() ?? "?"}
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#1a2035" }}>
                                {c.nombre} {c.apellido}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: "12px 16px", fontSize: 13, color: "#475569" }}>{c.email}</td>
                          <td style={{ padding: "12px 16px", fontSize: 13, color: "#475569" }}>{c.telefono || "—"}</td>
                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <select
                                value={c.tipo_cliente}
                                onChange={e => cambiarTipo(c, e.target.value as TipoCliente)}
                                disabled={guardandoTipo === c.id}
                                style={{
                                  padding: "5px 10px", borderRadius: 7, fontSize: 12, fontWeight: 700,
                                  cursor: "pointer", outline: "none", border: `1.5px solid ${ts.border}`,
                                  background: ts.bg, color: ts.color,
                                }}
                              >
                                <option value="veterinario">Veterinario</option>
                                <option value="productor">Productor</option>
                                <option value="pendiente">Pendiente</option>
                              </select>
                              {guardandoTipo === c.id && (
                                <span style={{ fontSize: 11, color: "#94a3b8" }}>Guardando...</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ════════════════ TAB PEDIDOS ════════════════ */}
        {tab === "pedidos" && (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <select
                value={filtroEstado}
                onChange={e => setFiltroEstado(e.target.value)}
                style={{ padding: "9px 14px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: 13, background: "white", cursor: "pointer", outline: "none" }}
              >
                <option value="todos">Todos los estados</option>
                {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <button
                onClick={cargarPedidos}
                style={{ padding: "9px 16px", background: "#1a2035", color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                ↺ Actualizar
              </button>
              {pedidosFiltrados.length > 0 && (
                <span style={{ fontSize: 13, color: "#64748b" }}>
                  {pedidosFiltrados.length} pedido{pedidosFiltrados.length !== 1 ? "s" : ""} —{" "}
                  <strong style={{ color: "#1a2035" }}>{fmt(totalPedidosFiltrados)}</strong>
                </span>
              )}
            </div>

            {cargandoPedidos ? <Spinner /> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {pedidosFiltrados.length === 0 && (
                  <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", fontSize: 14 }}>Sin pedidos</div>
                )}
                {pedidosFiltrados.map(p => {
                  const es = ESTADO_STYLE[p.estado] ?? ESTADO_STYLE.pendiente
                  const expanded = pedidoExpanded === p.id
                  return (
                    <div key={p.id} style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "hidden" }}>
                      <div
                        onClick={() => setPedidoExpanded(expanded ? null : p.id)}
                        style={{ padding: "13px 18px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flexWrap: "wrap" }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", minWidth: 48 }}>#{p.id}</span>
                        <span style={{ fontSize: 11.5, color: "#64748b", minWidth: 105, whiteSpace: "nowrap" }}>
                          {new Date(p.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#1a2035", flex: 1, minWidth: 120 }}>
                          {p.cliente_nombre}
                        </span>
                        <span style={{ fontSize: 12, color: "#64748b", minWidth: 160 }}>
                          {p.cliente_email ?? "—"}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "#e8197d", minWidth: 90, textAlign: "right" }}>
                          {fmt(p.total ?? 0)}
                        </span>
                        <div onClick={e => e.stopPropagation()}>
                          <select
                            value={p.estado}
                            onChange={e => cambiarEstado(p.id, e.target.value)}
                            disabled={guardandoEstado === p.id}
                            style={{
                              padding: "5px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                              cursor: "pointer", outline: "none",
                              border: `1.5px solid ${es.border}`,
                              background: es.bg,
                              color: es.color,
                            }}
                          >
                            {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                          </select>
                        </div>
                        <span style={{ fontSize: 12, color: "#94a3b8", userSelect: "none" }}>
                          {expanded ? "▲" : "▼"}
                        </span>
                      </div>

                      {expanded && (
                        <div style={{ padding: "0 18px 16px", borderTop: "1px solid #f1f5f9" }}>
                          {p.cliente_telefono && (
                            <p style={{ margin: "10px 0 6px", fontSize: 12, color: "#64748b" }}>
                              📞 {p.cliente_telefono}
                            </p>
                          )}
                          {p.notas && (
                            <p style={{ margin: "6px 0 10px", fontSize: 12, color: "#475569", background: "#f8fafc", padding: "8px 12px", borderRadius: 8, whiteSpace: "pre-wrap" }}>
                              📝 {p.notas}
                            </p>
                          )}
                          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
                            <thead>
                              <tr style={{ background: "#f8fafc" }}>
                                {["Producto", "Cant.", "Precio unit.", "Subtotal"].map(h => (
                                  <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {p.pedido_items.map((item, idx) => (
                                <tr key={idx} style={{ borderTop: "1px solid #f1f5f9" }}>
                                  <td style={{ padding: "7px 10px", fontSize: 12, color: "#1a2035" }}>{item.nombre_producto}</td>
                                  <td style={{ padding: "7px 10px", fontSize: 12, color: "#475569" }}>{item.cantidad}</td>
                                  <td style={{ padding: "7px 10px", fontSize: 12, color: "#475569" }}>{fmt(item.precio_unitario)}</td>
                                  <td style={{ padding: "7px 10px", fontSize: 12, fontWeight: 700, color: "#1a2035" }}>{fmt(item.precio_unitario * item.cantidad)}</td>
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
        )}

        {/* ════════════════ TAB CATEGORÍAS ════════════════ */}
        {tab === "categorias" && (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <input
                placeholder="Buscar producto..."
                value={busqCat}
                onChange={e => setBusqCat(e.target.value)}
                style={{ flex: 1, minWidth: 200, padding: "9px 14px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: 13, outline: "none", background: "white" }}
                onFocus={e => (e.target.style.borderColor = "#e8197d")}
                onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
              />
              <button
                onClick={cargarProductos}
                style={{ padding: "9px 16px", background: "#1a2035", color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                ↺ Actualizar
              </button>
              {categoriasExistentes.length > 0 && (
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  {categoriasExistentes.length} categoría{categoriasExistentes.length !== 1 ? "s" : ""} en uso
                </span>
              )}
            </div>

            {cargandoProds ? <Spinner /> : (
              <div style={{ background: "white", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                      {["Producto", "Laboratorio", "Categoría actual", "Editar"].map(h => (
                        <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 10.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {productosCatFiltrados.map((p, i) => (
                      <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "white" : "#fafbfc" }}>
                        <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#1a2035", maxWidth: 280 }}>{p.nombre}</td>
                        <td style={{ padding: "10px 16px" }}>
                          {p.laboratorio
                            ? <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap" }}>{p.laboratorio}</span>
                            : <span style={{ fontSize: 11, color: "#94a3b8" }}>—</span>
                          }
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          {p.categoria
                            ? <span style={{ fontSize: 11, fontWeight: 700, color: "#e8197d", background: "#fff0f7", border: "1px solid #fbcfe8", borderRadius: 20, padding: "2px 8px" }}>{p.categoria}</span>
                            : <span style={{ fontSize: 11, color: "#94a3b8" }}>Sin categoría</span>
                          }
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          {editCatId === p.id ? (
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <input
                                list={`cats-${p.id}`}
                                value={editCatVal}
                                onChange={e => setEditCatVal(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter") guardarCategoria(p.id, editCatVal)
                                  if (e.key === "Escape") setEditCatId(null)
                                }}
                                autoFocus
                                placeholder="Escribí o elegí..."
                                style={{ padding: "5px 10px", border: "1.5px solid #e8197d", borderRadius: 7, fontSize: 12, outline: "none", width: 160 }}
                              />
                              <datalist id={`cats-${p.id}`}>
                                {categoriasExistentes.map(c => <option key={c} value={c} />)}
                              </datalist>
                              <button
                                onClick={() => guardarCategoria(p.id, editCatVal)}
                                disabled={guardandoCat === p.id}
                                style={{ padding: "5px 10px", background: "#e8197d", color: "white", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                              >
                                {guardandoCat === p.id ? "..." : "✓"}
                              </button>
                              <button
                                onClick={() => setEditCatId(null)}
                                style={{ padding: "5px 8px", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 7, fontSize: 12, cursor: "pointer" }}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditCatId(p.id); setEditCatVal(p.categoria ?? "") }}
                              style={{ padding: "5px 12px", background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                            >
                              {p.categoria ? "Cambiar" : "Asignar"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ════════════════ TAB PRODUCTOS ════════════════ */}
        {tab === "productos" && (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <input
                placeholder="Buscar por nombre o laboratorio..."
                value={busqProd}
                onChange={e => setBusqProd(e.target.value)}
                style={{ flex: 1, minWidth: 200, padding: "9px 14px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: 13, outline: "none", background: "white" }}
                onFocus={e => (e.target.style.borderColor = "#e8197d")}
                onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
              />
              <button
                onClick={cargarProductos}
                style={{ padding: "9px 16px", background: "#1a2035", color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                ↺ Actualizar
              </button>
            </div>

            {cargandoProds ? <Spinner /> : (
              <div style={{ background: "white", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                      {["Producto", "Laboratorio", "Categoría", "Precio", "Stock", ""].map((h, i) => (
                        <th key={i} style={{ padding: "11px 16px", textAlign: "left", fontSize: 10.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {productosFiltrados.map((p, i) => (
                      <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "white" : "#fafbfc" }}>
                        <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#1a2035", maxWidth: 260 }}>{p.nombre}</td>
                        <td style={{ padding: "10px 16px" }}>
                          {p.laboratorio
                            ? <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap" }}>{p.laboratorio}</span>
                            : <span style={{ fontSize: 11, color: "#94a3b8" }}>—</span>
                          }
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          {p.categoria
                            ? <span style={{ fontSize: 11, fontWeight: 700, color: "#e8197d", background: "#fff0f7", border: "1px solid #fbcfe8", borderRadius: 20, padding: "2px 8px" }}>{p.categoria}</span>
                            : <span style={{ fontSize: 11, color: "#94a3b8" }}>—</span>
                          }
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "#1a2035", whiteSpace: "nowrap" }}>{fmt(p.precio_venta)}</td>
                        <td style={{ padding: "10px 16px", fontSize: 13, color: "#475569" }}>{p.stock}</td>
                        <td style={{ padding: "10px 16px" }}>
                          <button
                            onClick={() => {
                              setEditProducto(p)
                              setEditFields({
                                nombre: p.nombre,
                                precio_venta: p.precio_venta,
                                categoria: p.categoria ?? "",
                                laboratorio: p.laboratorio ?? "",
                                stock: p.stock,
                              })
                            }}
                            style={{ padding: "5px 12px", background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                          >
                            ✏ Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal editar producto ───────────────────────────────────────── */}
      {editProducto && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(10,15,28,0.72)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setEditProducto(null) }}
        >
          <div style={{ background: "white", borderRadius: 18, width: "100%", maxWidth: 480, padding: "26px 28px 24px", boxShadow: "0 32px 80px rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "#1a2035" }}>Editar producto</h2>
                <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "#94a3b8" }}>ID #{editProducto.id}</p>
              </div>
              <button
                onClick={() => setEditProducto(null)}
                style={{ width: 32, height: 32, border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", cursor: "pointer", fontSize: 15, color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {(["nombre", "categoria", "laboratorio"] as const).map(key => (
                <div key={key}>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "#374151", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.6 }}>
                    {key === "nombre" ? "Nombre" : key === "categoria" ? "Categoría" : "Laboratorio"}
                  </label>
                  {key === "categoria" ? (
                    <>
                      <input
                        list="edit-cats"
                        value={(editFields.categoria as string) ?? ""}
                        onChange={e => setEditFields(f => ({ ...f, categoria: e.target.value }))}
                        placeholder="Ej: Antiparasitarios"
                        style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                        onFocus={e => (e.target.style.borderColor = "#e8197d")}
                        onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                      />
                      <datalist id="edit-cats">
                        {categoriasExistentes.map(c => <option key={c} value={c} />)}
                      </datalist>
                    </>
                  ) : (
                    <input
                      type="text"
                      value={(editFields[key] as string) ?? ""}
                      onChange={e => setEditFields(f => ({ ...f, [key]: e.target.value }))}
                      style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                      onFocus={e => (e.target.style.borderColor = "#e8197d")}
                      onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                    />
                  )}
                </div>
              ))}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "#374151", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.6 }}>
                    Precio venta ($)
                  </label>
                  <input
                    type="number"
                    value={editFields.precio_venta ?? ""}
                    onChange={e => setEditFields(f => ({ ...f, precio_venta: parseFloat(e.target.value) || 0 }))}
                    style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = "#e8197d")}
                    onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "#374151", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.6 }}>
                    Stock
                  </label>
                  <input
                    type="number"
                    value={editFields.stock ?? ""}
                    onChange={e => setEditFields(f => ({ ...f, stock: parseInt(e.target.value) || 0 }))}
                    style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = "#e8197d")}
                    onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button
                onClick={() => setEditProducto(null)}
                style={{ flex: 1, padding: "11px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={guardarProducto}
                disabled={guardandoProd}
                style={{ flex: 2, padding: "11px", background: guardandoProd ? "#f9a8d4" : "#e8197d", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 900, cursor: guardandoProd ? "not-allowed" : "pointer" }}
              >
                {guardandoProd ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── Spinner helper ────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid #e8197d", borderTopColor: "transparent", margin: "0 auto", animation: "spin 0.8s linear infinite" }} />
    </div>
  )
}
