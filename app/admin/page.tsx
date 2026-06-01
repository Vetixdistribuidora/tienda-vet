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
  estado: string
  total: number
  notas: string | null
  usuario_id?: string | null
  // columnas de cliente — nombre puede variar según el esquema de la DB
  cliente_nombre?: string | null
  nombre?: string | null
  cliente_email?: string | null
  email?: string | null
  cliente_telefono?: string | null
  telefono?: string | null
  pedido_items: PedidoItemAdmin[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

type ProductoAdmin = {
  id: number
  nombre: string
  precio_venta: number
  stock: number
  categoria: string | null
  subcategoria: string | null
  laboratorio: string | null
  imagen_url: string | null
}

type ImagenItem = {
  file: File
  previewUrl: string
  productoId: number | null
  busq: string
  estado: "pendiente" | "subiendo" | "ok" | "error"
  errorMsg?: string
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

  // Error global de API
  const [apiError, setApiError] = useState<string | null>(null)

  // Tab Categorías — bulk
  const [busqCat, setBusqCat] = useState("")
  const [filtroCatActual, setFiltroCatActual] = useState("todos")
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkCat, setBulkCat] = useState("")
  const [bulkSubcat, setBulkSubcat] = useState("")
  const [guardandoBulk, setGuardandoBulk] = useState(false)
  // inline edit categoría
  const [editCatId, setEditCatId] = useState<number | null>(null)
  const [editCatVal, setEditCatVal] = useState("")
  const [guardandoCat, setGuardandoCat] = useState<number | null>(null)
  // inline edit subcategoría
  const [editSubcatId, setEditSubcatId] = useState<number | null>(null)
  const [editSubcatVal, setEditSubcatVal] = useState("")
  const [guardandoSubcat, setGuardandoSubcat] = useState<number | null>(null)

  // Tab Productos
  const [busqProd, setBusqProd] = useState("")
  const [filtroCatProd, setFiltroCatProd] = useState("todos")
  const [editProducto, setEditProducto] = useState<ProductoAdmin | null>(null)
  const [editFields, setEditFields] = useState<Partial<ProductoAdmin & { categoria: string; laboratorio: string }>>({})
  const [guardandoProd, setGuardandoProd] = useState(false)
  const [subiendoImagen, setSubiendoImagen] = useState(false)
  const [imagenError, setImagenError] = useState("")

  // Modal carga masiva de imágenes
  const [modalMasivo, setModalMasivo] = useState(false)
  const [imagenesPendientes, setImagenesPendientes] = useState<ImagenItem[]>([])
  const [subiendoMasivo, setSubiendoMasivo] = useState(false)
  const [dropdownIdx, setDropdownIdx] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // ── Auth — escucha cambios de sesión para mantener token siempre fresco ───────
  useEffect(() => {
    // Carga inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token && session.user.email === ADMIN_EMAIL) {
        setToken(session.access_token)
        setEsAdmin(true)
      }
      setVerificando(false)
    })
    // Listener: actualiza token cada vez que Supabase lo refresca automáticamente
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token && session.user.email === ADMIN_EMAIL) {
        setToken(session.access_token)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (esAdmin && token) cargarClientes()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esAdmin, token])

  useEffect(() => {
    if (!esAdmin || !token) return
    if (tab === "pedidos" && pedidos.length === 0) cargarPedidos()
    if ((tab === "categorias" || tab === "productos") && productos.length === 0) cargarProductos()
    // reset selección al cambiar de tab
    if (tab !== "categorias") setSelectedIds(new Set())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // ── API helper — siempre obtiene token fresco para evitar expiración ──────────
  async function apiFetch(path: string, init: RequestInit = {}) {
    const { data: { session } } = await supabase.auth.getSession()
    const freshToken = session?.access_token ?? token ?? ""
    return fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${freshToken}`,
      },
    })
  }

  // ── Loaders ───────────────────────────────────────────────────────────────────
  async function cargarClientes() {
    setCargandoClientes(true); setApiError(null)
    const res = await apiFetch("/api/admin/clientes")
    if (res.ok) { setClientes(await res.json()) }
    else { const body = await res.text(); setApiError(`Clientes: ${res.status} — ${body}`) }
    setCargandoClientes(false)
  }

  async function cargarPedidos() {
    setCargandoPedidos(true); setApiError(null)
    const res = await apiFetch("/api/admin/pedidos")
    if (res.ok) { setPedidos(await res.json()) }
    else { const body = await res.text(); setApiError(`Pedidos: ${res.status} — ${body}`) }
    setCargandoPedidos(false)
  }

  async function cargarProductos() {
    setCargandoProds(true); setApiError(null)
    const res = await apiFetch("/api/admin/productos")
    if (res.ok) { setProductos(await res.json()) }
    else { const body = await res.text(); setApiError(`Productos: ${res.status} — ${body}`) }
    setCargandoProds(false)
  }

  // ── Actions: clientes ─────────────────────────────────────────────────────────
  async function cambiarTipo(cliente: ClienteAdmin, tipo: TipoCliente) {
    setGuardandoTipo(cliente.id)
    setClientes(cs => cs.map(c => c.id === cliente.id ? { ...c, tipo_cliente: tipo } : c))
    await apiFetch(`/api/admin/clientes/${cliente.id}`, {
      method: "PATCH",
      body: JSON.stringify({ tipo_cliente: tipo, email: cliente.email }),
    })
    setGuardandoTipo(null)
  }

  // ── Actions: pedidos ──────────────────────────────────────────────────────────
  async function cambiarEstado(pedidoId: number, estado: string) {
    setGuardandoEstado(pedidoId)
    setPedidos(ps => ps.map(p => p.id === pedidoId ? { ...p, estado } : p))
    await apiFetch(`/api/admin/pedidos/${pedidoId}`, {
      method: "PATCH",
      body: JSON.stringify({ estado }),
    })
    setGuardandoEstado(null)
  }

  // ── Actions: categorías ───────────────────────────────────────────────────────
  function toggleSelect(id: number) {
    setSelectedIds(s => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === productosCatFiltrados.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(productosCatFiltrados.map(p => p.id)))
    }
  }

  async function asignarBulk() {
    if (selectedIds.size === 0) return
    if (!bulkCat.trim() && !bulkSubcat.trim()) return
    setGuardandoBulk(true)
    const updates: Record<string, string | null> = {}
    if (bulkCat.trim())    updates.categoria    = bulkCat.trim()
    if (bulkSubcat.trim()) updates.subcategoria = bulkSubcat.trim()
    await Promise.all(
      Array.from(selectedIds).map(id =>
        apiFetch(`/api/admin/productos/${id}`, {
          method: "PATCH",
          body: JSON.stringify(updates),
        })
      )
    )
    setProductos(ps => ps.map(p => selectedIds.has(p.id) ? { ...p, ...updates } : p))
    setSelectedIds(new Set())
    setBulkCat("")
    setBulkSubcat("")
    setGuardandoBulk(false)
  }

  async function guardarSubcategoria(id: number, subcat: string) {
    setGuardandoSubcat(id)
    const subcatFinal = subcat.trim() || null
    setProductos(ps => ps.map(p => p.id === id ? { ...p, subcategoria: subcatFinal } : p))
    await apiFetch(`/api/admin/productos/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ subcategoria: subcatFinal }),
    })
    setGuardandoSubcat(null)
    setEditSubcatId(null)
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

  // ── Actions: productos ────────────────────────────────────────────────────────
  async function guardarProducto() {
    if (!editProducto) return
    setGuardandoProd(true)
    const updates: Record<string, unknown> = {}
    if (editFields.nombre !== undefined) updates.nombre = editFields.nombre
    if (editFields.precio_venta !== undefined) updates.precio_venta = editFields.precio_venta
    if (editFields.categoria !== undefined) updates.categoria = (editFields.categoria as string).trim() || null
    if (editFields.subcategoria !== undefined) updates.subcategoria = (editFields.subcategoria as string).trim() || null
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

  async function subirImagen(file: File) {
    if (!editProducto) return
    setSubiendoImagen(true); setImagenError("")
    // Refrescar sesión antes de subir para evitar RLS por token vencido
    await supabase.auth.getSession()
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
    const path = `${editProducto.id}.${ext}`
    const { error: upErr } = await supabase.storage
      .from("productos")
      .upload(path, file, { upsert: true, contentType: file.type })
    if (upErr) { setImagenError("Error al subir: " + upErr.message); setSubiendoImagen(false); return }
    const { data: urlData } = supabase.storage.from("productos").getPublicUrl(path)
    const url = urlData.publicUrl + "?t=" + Date.now()
    await apiFetch(`/api/admin/productos/${editProducto.id}`, {
      method: "PATCH",
      body: JSON.stringify({ imagen_url: url }),
    })
    setEditProducto(p => p ? { ...p, imagen_url: url } : p)
    setProductos(ps => ps.map(p => p.id === editProducto.id ? { ...p, imagen_url: url } : p))
    setSubiendoImagen(false)
  }

  // ── Helpers: carga masiva ─────────────────────────────────────────────────────
  function normalizarTexto(s: string) {
    return s.toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "").replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim()
  }

  function autoMatch(filename: string): ProductoAdmin | null {
    const base = normalizarTexto(filename.replace(/\.[^.]+$/, ""))
    if (!base) return null
    const todos = productos
    return todos.find(p => normalizarTexto(p.nombre) === base)
      ?? todos.find(p => normalizarTexto(p.nombre).startsWith(base) || base.startsWith(normalizarTexto(p.nombre)))
      ?? todos.find(p => normalizarTexto(p.nombre).includes(base) || base.includes(normalizarTexto(p.nombre)))
      ?? null
  }

  function labelProducto(p: ProductoAdmin) {
    return p.laboratorio ? `${p.nombre} — ${p.laboratorio}` : p.nombre
  }

  function agregarImagenes(files: FileList | File[]) {
    const nuevas: ImagenItem[] = Array.from(files)
      .filter(f => f.type.startsWith("image/"))
      .map(file => {
        const match = autoMatch(file.name)
        return {
          file,
          previewUrl: URL.createObjectURL(file),
          productoId: match?.id ?? null,
          busq: match ? labelProducto(match) : "",
          estado: "pendiente" as const,
        }
      })
    setImagenesPendientes(prev => [...prev, ...nuevas])
  }

  function asignarProducto(idx: number, producto: ProductoAdmin) {
    setImagenesPendientes(prev => prev.map((it, i) =>
      i === idx ? { ...it, productoId: producto.id, busq: labelProducto(producto), estado: "pendiente" } : it
    ))
    setDropdownIdx(null)
  }

  function limpiarMasivo() {
    imagenesPendientes.forEach(it => URL.revokeObjectURL(it.previewUrl))
    setImagenesPendientes([])
    setSubiendoMasivo(false)
    setDropdownIdx(null)
  }

  async function subirImagenesMasivo() {
    const asignadas = imagenesPendientes.filter(it => it.productoId && it.estado !== "ok")
    if (asignadas.length === 0) return
    setSubiendoMasivo(true)
    await supabase.auth.getSession()
    await Promise.all(
      imagenesPendientes.map(async (item, idx) => {
        if (!item.productoId || item.estado === "ok") return
        setImagenesPendientes(prev => prev.map((it, i) => i === idx ? { ...it, estado: "subiendo" } : it))
        const ext = item.file.name.split(".").pop()?.toLowerCase() ?? "jpg"
        const path = `${item.productoId}.${ext}`
        const { error: upErr } = await supabase.storage
          .from("productos")
          .upload(path, item.file, { upsert: true, contentType: item.file.type })
        if (upErr) {
          setImagenesPendientes(prev => prev.map((it, i) => i === idx ? { ...it, estado: "error", errorMsg: upErr.message } : it))
          return
        }
        const { data: urlData } = supabase.storage.from("productos").getPublicUrl(path)
        const url = urlData.publicUrl + "?t=" + Date.now()
        await apiFetch(`/api/admin/productos/${item.productoId}`, {
          method: "PATCH",
          body: JSON.stringify({ imagen_url: url }),
        })
        setProductos(ps => ps.map(p => p.id === item.productoId ? { ...p, imagen_url: url } : p))
        setImagenesPendientes(prev => prev.map((it, i) => i === idx ? { ...it, estado: "ok" } : it))
      })
    )
    setSubiendoMasivo(false)
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const categoriasExistentes = Array.from(
    new Set(productos.filter(p => p.categoria).map(p => p.categoria!))
  ).sort()

  const subcategoriasExistentes = Array.from(
    new Set(productos.filter(p => p.subcategoria).map(p => p.subcategoria!))
  ).sort()

  const clientesFiltrados = clientes
    .filter(c => filtroTipo === "todos" || c.tipo_cliente === filtroTipo)
    .filter(c => {
      if (!busqClientes) return true
      return `${c.nombre} ${c.apellido} ${c.email}`.toLowerCase().includes(busqClientes.toLowerCase())
    })

  const pedidosFiltrados = pedidos.filter(p =>
    filtroEstado === "todos" || p.estado === filtroEstado
  )

  const productosCatFiltrados = productos
    .filter(p => !busqCat || p.nombre.toLowerCase().includes(busqCat.toLowerCase()) || (p.laboratorio ?? "").toLowerCase().includes(busqCat.toLowerCase()))
    .filter(p => {
      if (filtroCatActual === "todos") return true
      if (filtroCatActual === "__sin__") return !p.categoria
      return p.categoria === filtroCatActual
    })

  const productosFiltrados = productos
    .filter(p => !busqProd || p.nombre.toLowerCase().includes(busqProd.toLowerCase()) || (p.laboratorio ?? "").toLowerCase().includes(busqProd.toLowerCase()))
    .filter(p => filtroCatProd === "todos" || p.categoria === filtroCatProd)

  const todosSeleccionados = productosCatFiltrados.length > 0 && selectedIds.size === productosCatFiltrados.length
  const algunoSeleccionado = selectedIds.size > 0

  // Helpers para columnas de pedido con nombre variable
  const pNombre   = (p: PedidoAdmin) => p.cliente_nombre ?? p.nombre ?? "—"
  const pEmail    = (p: PedidoAdmin) => p.cliente_email   ?? p.email   ?? null
  const pTelefono = (p: PedidoAdmin) => p.cliente_telefono ?? p.telefono ?? null

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
            {ADMIN_EMAIL ? "Iniciá sesión con la cuenta admin en la tienda para continuar." : "Configurá NEXT_PUBLIC_ADMIN_EMAIL en Vercel."}
          </p>
          <Link href="/" style={{ color: "#e8197d", fontWeight: 700, textDecoration: "none", fontSize: 14 }}>← Volver a la tienda</Link>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  // ── Admin UI ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{ background: "#0f172a", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 16px rgba(0,0,0,0.35)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 54 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Image src="/logo.png" alt="VETIX" height={28} width={112} style={{ height: 28, width: "auto" }} priority />
            <span style={{ fontSize: 10.5, fontWeight: 800, background: "#e8197d", color: "white", borderRadius: 6, padding: "2px 8px", textTransform: "uppercase", letterSpacing: 0.8 }}>Admin</span>
          </div>
          <Link href="/" style={{ fontSize: 12, color: "#64748b", textDecoration: "none", fontWeight: 600 }}>← Tienda</Link>
        </div>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px", display: "flex", overflowX: "auto" }}>
          {(["clientes", "pedidos", "categorias", "productos"] as Tab[]).map(t => {
            const labels: Record<Tab, string> = {
              clientes:   clientes.length   ? `Clientes (${clientes.length})`   : "Clientes",
              pedidos:    pedidos.length    ? `Pedidos (${pedidos.length})`    : "Pedidos",
              categorias: "Categorías",
              productos:  productos.length  ? `Productos (${productos.length})` : "Productos",
            }
            return (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "13px 18px", background: "none", border: "none",
                borderBottom: `2.5px solid ${tab === t ? "#e8197d" : "transparent"}`,
                color: tab === t ? "white" : "#64748b", cursor: "pointer",
                fontSize: 13, fontWeight: tab === t ? 800 : 600, whiteSpace: "nowrap",
              }}>
                {labels[t]}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px" }}>

        {/* Error de API */}
        {apiError && (
          <div style={{ background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#dc2626", fontFamily: "monospace", wordBreak: "break-all" }}>
            <strong>Error al cargar datos:</strong> {apiError}
            <div style={{ marginTop: 8, fontSize: 12, color: "#64748b", fontFamily: "system-ui", fontStyle: "italic" }}>
              Verificá: 1) SUPABASE_SERVICE_ROLE_KEY en Vercel Variables, 2) NEXT_PUBLIC_ADMIN_EMAIL coincide exactamente con tu email, 3) Hiciste redeploy después de agregar las variables.
            </div>
          </div>
        )}

        {/* ════════ TAB CLIENTES ════════ */}
        {tab === "clientes" && (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <input placeholder="Buscar por nombre o email..." value={busqClientes} onChange={e => setBusqClientes(e.target.value)}
                style={{ flex: 1, minWidth: 200, padding: "9px 14px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: 13, outline: "none", background: "white" }}
                onFocus={e => (e.target.style.borderColor = "#e8197d")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
              <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
                style={{ padding: "9px 14px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: 13, background: "white", cursor: "pointer", outline: "none" }}>
                <option value="todos">Todos los tipos</option>
                <option value="veterinario">Veterinarios</option>
                <option value="productor">Productores</option>
                <option value="pendiente">Pendientes</option>
              </select>
              <button onClick={cargarClientes} style={{ padding: "9px 16px", background: "#1a2035", color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>↺ Actualizar</button>
            </div>

            {cargandoClientes ? <Spinner /> : (
              <div style={{ background: "white", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                      {["Cliente", "Email", "Teléfono", "Tipo"].map(h => (
                        <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 10.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clientesFiltrados.length === 0 ? (
                      <tr><td colSpan={4} style={{ padding: "48px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Sin resultados</td></tr>
                    ) : clientesFiltrados.map((c, i) => {
                      const ts = TIPO_STYLE[c.tipo_cliente] ?? TIPO_STYLE.pendiente
                      return (
                        <tr key={c.id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "white" : "#fafbfc" }}>
                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#475569", flexShrink: 0 }}>
                                {c.nombre?.[0]?.toUpperCase() ?? "?"}
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#1a2035" }}>{c.nombre} {c.apellido}</span>
                            </div>
                          </td>
                          <td style={{ padding: "12px 16px", fontSize: 13, color: "#475569" }}>{c.email}</td>
                          <td style={{ padding: "12px 16px", fontSize: 13, color: "#475569" }}>{c.telefono || "—"}</td>
                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <select value={c.tipo_cliente} onChange={e => cambiarTipo(c, e.target.value as TipoCliente)} disabled={guardandoTipo === c.id}
                                style={{ padding: "5px 10px", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", outline: "none", border: `1.5px solid ${ts.border}`, background: ts.bg, color: ts.color }}>
                                <option value="veterinario">Veterinario</option>
                                <option value="productor">Productor</option>
                                <option value="pendiente">Pendiente</option>
                              </select>
                              {guardandoTipo === c.id && <span style={{ fontSize: 11, color: "#94a3b8" }}>Guardando...</span>}
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

        {/* ════════ TAB PEDIDOS ════════ */}
        {tab === "pedidos" && (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
                style={{ padding: "9px 14px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: 13, background: "white", cursor: "pointer", outline: "none" }}>
                <option value="todos">Todos los estados</option>
                {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <button onClick={cargarPedidos} style={{ padding: "9px 16px", background: "#1a2035", color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>↺ Actualizar</button>
              {pedidosFiltrados.length > 0 && (
                <span style={{ fontSize: 13, color: "#64748b" }}>
                  {pedidosFiltrados.length} pedido{pedidosFiltrados.length !== 1 ? "s" : ""} — <strong style={{ color: "#1a2035" }}>{fmt(pedidosFiltrados.reduce((s, p) => s + (p.total ?? 0), 0))}</strong>
                </span>
              )}
            </div>

            {cargandoPedidos ? <Spinner /> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {pedidosFiltrados.length === 0 && <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", fontSize: 14 }}>Sin pedidos</div>}
                {pedidosFiltrados.map(p => {
                  const es = ESTADO_STYLE[p.estado] ?? ESTADO_STYLE.pendiente
                  const expanded = pedidoExpanded === p.id
                  return (
                    <div key={p.id} style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "hidden" }}>
                      <div onClick={() => setPedidoExpanded(expanded ? null : p.id)}
                        style={{ padding: "13px 18px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", minWidth: 48 }}>#{p.id}</span>
                        <span style={{ fontSize: 11.5, color: "#64748b", minWidth: 105, whiteSpace: "nowrap" }}>
                          {new Date(p.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#1a2035", flex: 1, minWidth: 120 }}>{pNombre(p)}</span>
                        <span style={{ fontSize: 12, color: "#64748b", minWidth: 160 }}>{pEmail(p) ?? "—"}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "#e8197d", minWidth: 90, textAlign: "right" }}>{fmt(p.total ?? 0)}</span>
                        <div onClick={e => e.stopPropagation()}>
                          <select value={p.estado} onChange={e => cambiarEstado(p.id, e.target.value)} disabled={guardandoEstado === p.id}
                            style={{ padding: "5px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", outline: "none", border: `1.5px solid ${es.border}`, background: es.bg, color: es.color }}>
                            {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                          </select>
                        </div>
                        <span style={{ fontSize: 12, color: "#94a3b8", userSelect: "none" }}>{expanded ? "▲" : "▼"}</span>
                      </div>
                      {expanded && (
                        <div style={{ padding: "0 18px 16px", borderTop: "1px solid #f1f5f9" }}>
                          {pTelefono(p) && <p style={{ margin: "10px 0 6px", fontSize: 12, color: "#64748b" }}>📞 {pTelefono(p)}</p>}
                          {p.notas && <p style={{ margin: "6px 0 10px", fontSize: 12, color: "#475569", background: "#f8fafc", padding: "8px 12px", borderRadius: 8, whiteSpace: "pre-wrap" }}>📝 {p.notas}</p>}
                          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
                            <thead>
                              <tr style={{ background: "#f8fafc" }}>
                                {["Producto", "Cant.", "Precio unit.", "Subtotal"].map(h => (
                                  <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>{h}</th>
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

        {/* ════════ TAB CATEGORÍAS ════════ */}
        {tab === "categorias" && (
          <div>
            {/* Toolbar */}
            <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
              <input placeholder="Buscar producto o laboratorio..." value={busqCat} onChange={e => { setBusqCat(e.target.value); setSelectedIds(new Set()) }}
                style={{ flex: 1, minWidth: 200, padding: "9px 14px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: 13, outline: "none", background: "white" }}
                onFocus={e => (e.target.style.borderColor = "#e8197d")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
              <select value={filtroCatActual} onChange={e => { setFiltroCatActual(e.target.value); setSelectedIds(new Set()) }}
                style={{ padding: "9px 14px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: 13, background: "white", cursor: "pointer", outline: "none", maxWidth: 220 }}>
                <option value="todos">Todas las categorías</option>
                <option value="__sin__">Sin categoría</option>
                {categoriasExistentes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={() => { cargarProductos(); setSelectedIds(new Set()) }}
                style={{ padding: "9px 16px", background: "#1a2035", color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                ↺ Actualizar
              </button>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                {productosCatFiltrados.length} producto{productosCatFiltrados.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Barra de acción masiva */}
            {algunoSeleccionado && (
              <div style={{ background: "#0f172a", borderRadius: 11, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "white", flexShrink: 0 }}>
                  {selectedIds.size} producto{selectedIds.size !== 1 ? "s" : ""}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 240 }}>
                  <span style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap" }}>Categoría:</span>
                  <input list="bulk-cats" value={bulkCat} onChange={e => setBulkCat(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && asignarBulk()}
                    placeholder="Categoría..."
                    style={{ flex: 1, minWidth: 120, padding: "6px 10px", borderRadius: 7, border: "1.5px solid #2d3a55", background: "#1e293b", color: "white", fontSize: 12, outline: "none" }} />
                  <datalist id="bulk-cats">{categoriasExistentes.map(c => <option key={c} value={c} />)}</datalist>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 200 }}>
                  <span style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap" }}>Subcategoría:</span>
                  <input list="bulk-subcats" value={bulkSubcat} onChange={e => setBulkSubcat(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && asignarBulk()}
                    placeholder="Subcategoría (opcional)..."
                    style={{ flex: 1, minWidth: 120, padding: "6px 10px", borderRadius: 7, border: "1.5px solid #2d3a55", background: "#1e293b", color: "white", fontSize: 12, outline: "none" }} />
                  <datalist id="bulk-subcats">{subcategoriasExistentes.map(c => <option key={c} value={c} />)}</datalist>
                </div>
                <button onClick={asignarBulk} disabled={guardandoBulk || (!bulkCat.trim() && !bulkSubcat.trim())}
                  style={{ padding: "7px 16px", background: guardandoBulk ? "#64748b" : "#e8197d", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {guardandoBulk ? "Guardando..." : "✓ Aplicar"}
                </button>
                <button onClick={() => { setSelectedIds(new Set()); setBulkCat(""); setBulkSubcat("") }}
                  style={{ padding: "7px 10px", background: "#1e293b", border: "1px solid #2d3a55", color: "#94a3b8", borderRadius: 8, fontSize: 12, cursor: "pointer", flexShrink: 0 }}>
                  ✕
                </button>
              </div>
            )}

            {cargandoProds ? <Spinner /> : (
              <div style={{ background: "white", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                      {/* Select all */}
                      <th style={{ padding: "11px 14px", width: 40 }}>
                        <input
                          type="checkbox"
                          checked={todosSeleccionados}
                          onChange={toggleSelectAll}
                          style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#e8197d" }}
                          title={todosSeleccionados ? "Deseleccionar todo" : "Seleccionar todo"}
                        />
                      </th>
                      {["Producto", "Laboratorio", "Categoría", "Subcategoría", ""].map(h => (
                        <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 10.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {productosCatFiltrados.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: "48px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Sin resultados</td></tr>
                    )}
                    {productosCatFiltrados.map((p, i) => {
                      const sel = selectedIds.has(p.id)
                      return (
                        <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9", background: sel ? "#fff0f7" : i % 2 === 0 ? "white" : "#fafbfc", transition: "background 0.1s" }}>
                          <td style={{ padding: "10px 14px" }}>
                            <input type="checkbox" checked={sel} onChange={() => toggleSelect(p.id)}
                              style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#e8197d" }} />
                          </td>
                          <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: sel ? 700 : 600, color: "#1a2035", maxWidth: 260 }}>{p.nombre}</td>
                          <td style={{ padding: "10px 16px" }}>
                            {p.laboratorio
                              ? <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap" }}>{p.laboratorio}</span>
                              : <span style={{ fontSize: 11, color: "#94a3b8" }}>—</span>}
                          </td>
                          <td style={{ padding: "10px 16px" }}>
                            {p.categoria
                              ? <span style={{ fontSize: 11, fontWeight: 700, color: "#e8197d", background: "#fff0f7", border: "1px solid #fbcfe8", borderRadius: 20, padding: "2px 8px" }}>{p.categoria}</span>
                              : <span style={{ fontSize: 11, color: "#94a3b8" }}>Sin categoría</span>}
                          </td>
                          <td style={{ padding: "10px 16px" }}>
                            {editCatId === p.id ? (
                              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                <input list={`cats-${p.id}`} value={editCatVal} onChange={e => setEditCatVal(e.target.value)} autoFocus
                                  onKeyDown={e => { if (e.key === "Enter") guardarCategoria(p.id, editCatVal); if (e.key === "Escape") setEditCatId(null) }}
                                  placeholder="Categoría..."
                                  style={{ padding: "5px 10px", border: "1.5px solid #e8197d", borderRadius: 7, fontSize: 12, outline: "none", width: 140 }} />
                                <datalist id={`cats-${p.id}`}>
                                  {categoriasExistentes.map(c => <option key={c} value={c} />)}
                                </datalist>
                                <button onClick={() => guardarCategoria(p.id, editCatVal)} disabled={guardandoCat === p.id}
                                  style={{ padding: "5px 10px", background: "#e8197d", color: "white", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                                  {guardandoCat === p.id ? "..." : "✓"}
                                </button>
                                <button onClick={() => setEditCatId(null)}
                                  style={{ padding: "5px 8px", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 7, fontSize: 12, cursor: "pointer" }}>✕</button>
                              </div>
                            ) : (
                              <button onClick={() => { setEditCatId(p.id); setEditCatVal(p.categoria ?? "") }}
                                style={{ padding: "5px 12px", background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                                {p.categoria ? "Cambiar" : "Asignar"}
                              </button>
                            )}
                          </td>
                          {/* Subcategoría inline edit */}
                          <td style={{ padding: "10px 16px" }}>
                            {editSubcatId === p.id ? (
                              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                <input list={`subcats-${p.id}`} value={editSubcatVal} onChange={e => setEditSubcatVal(e.target.value)} autoFocus
                                  onKeyDown={e => { if (e.key === "Enter") guardarSubcategoria(p.id, editSubcatVal); if (e.key === "Escape") setEditSubcatId(null) }}
                                  placeholder="Subcategoría..."
                                  style={{ padding: "5px 10px", border: "1.5px solid #7c3aed", borderRadius: 7, fontSize: 12, outline: "none", width: 140 }} />
                                <datalist id={`subcats-${p.id}`}>
                                  {subcategoriasExistentes.map(c => <option key={c} value={c} />)}
                                </datalist>
                                <button onClick={() => guardarSubcategoria(p.id, editSubcatVal)} disabled={guardandoSubcat === p.id}
                                  style={{ padding: "5px 10px", background: "#7c3aed", color: "white", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                                  {guardandoSubcat === p.id ? "..." : "✓"}
                                </button>
                                <button onClick={() => setEditSubcatId(null)}
                                  style={{ padding: "5px 8px", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 7, fontSize: 12, cursor: "pointer" }}>✕</button>
                              </div>
                            ) : (
                              <button onClick={() => { setEditSubcatId(p.id); setEditSubcatVal(p.subcategoria ?? "") }}
                                style={{ padding: "5px 12px", background: p.subcategoria ? "#faf5ff" : "#f1f5f9", color: p.subcategoria ? "#7c3aed" : "#475569", border: `1px solid ${p.subcategoria ? "#ddd6fe" : "#e2e8f0"}`, borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                                {p.subcategoria || "Asignar"}
                              </button>
                            )}
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

        {/* ════════ TAB PRODUCTOS ════════ */}
        {tab === "productos" && (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <input placeholder="Buscar por nombre o laboratorio..." value={busqProd} onChange={e => setBusqProd(e.target.value)}
                style={{ flex: 1, minWidth: 200, padding: "9px 14px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: 13, outline: "none", background: "white" }}
                onFocus={e => (e.target.style.borderColor = "#e8197d")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
              <select value={filtroCatProd} onChange={e => setFiltroCatProd(e.target.value)}
                style={{ padding: "9px 14px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: 13, background: "white", cursor: "pointer", outline: "none", maxWidth: 200 }}>
                <option value="todos">Todas las categorías</option>
                {categoriasExistentes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={cargarProductos} style={{ padding: "9px 16px", background: "#1a2035", color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>↺ Actualizar</button>
              <button onClick={() => { if (productos.length === 0) cargarProductos(); setModalMasivo(true) }}
                style={{ padding: "9px 16px", background: "#e8197d", color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                + Cargar imágenes
              </button>
              <span style={{ fontSize: 12, color: "#64748b", padding: "9px 0" }}>{productosFiltrados.length} productos</span>
            </div>

            {cargandoProds ? <Spinner /> : (
              <div style={{ background: "white", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                      {["", "Producto", "Laboratorio", "Categoría", "Precio", "Stock", ""].map((h, i) => (
                        <th key={i} style={{ padding: "11px 16px", textAlign: "left", fontSize: 10.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {productosFiltrados.map((p, i) => (
                      <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "white" : "#fafbfc" }}>
                        <td style={{ padding: "8px 8px 8px 16px", width: 48 }}>
                          {p.imagen_url
                            ? <img src={p.imagen_url} alt="" style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc" }} />
                            : <div style={{ width: 36, height: 36, borderRadius: 6, border: "1.5px dashed #e2e8f0", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>📷</div>}
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#1a2035", maxWidth: 260 }}>{p.nombre}</td>
                        <td style={{ padding: "10px 16px" }}>
                          {p.laboratorio
                            ? <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap" }}>{p.laboratorio}</span>
                            : <span style={{ fontSize: 11, color: "#94a3b8" }}>—</span>}
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          {p.categoria
                            ? <span style={{ fontSize: 11, fontWeight: 700, color: "#e8197d", background: "#fff0f7", border: "1px solid #fbcfe8", borderRadius: 20, padding: "2px 8px" }}>{p.categoria}</span>
                            : <span style={{ fontSize: 11, color: "#94a3b8" }}>—</span>}
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "#1a2035", whiteSpace: "nowrap" }}>{fmt(p.precio_venta)}</td>
                        <td style={{ padding: "10px 16px" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: p.stock > 0 ? "#16a34a" : "#94a3b8" }}>{p.stock}</span>
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          <button onClick={() => { setEditProducto(p); setEditFields({ nombre: p.nombre, precio_venta: p.precio_venta, categoria: p.categoria ?? "", subcategoria: p.subcategoria ?? "", laboratorio: p.laboratorio ?? "", stock: p.stock }) }}
                            style={{ padding: "5px 12px", background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
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

      {/* Modal editar producto */}
      {editProducto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,15,28,0.72)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setEditProducto(null) }}>
          <div style={{ background: "white", borderRadius: 18, width: "100%", maxWidth: 480, padding: "26px 28px 24px", boxShadow: "0 32px 80px rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "#1a2035" }}>Editar producto</h2>
                <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "#94a3b8" }}>ID #{editProducto.id}</p>
              </div>
              <button onClick={() => setEditProducto(null)} style={{ width: 32, height: 32, border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", cursor: "pointer", fontSize: 15, color: "#64748b" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {(["nombre", "categoria", "subcategoria", "laboratorio"] as const).map(key => (
                <div key={key}>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "#374151", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.6 }}>
                    {key === "nombre" ? "Nombre" : key === "categoria" ? "Categoría" : key === "subcategoria" ? "Subcategoría" : "Laboratorio"}
                  </label>
                  {key === "categoria" ? (
                    <>
                      <input list="edit-cats" value={(editFields.categoria as string) ?? ""} onChange={e => setEditFields(f => ({ ...f, categoria: e.target.value }))}
                        placeholder="Ej: Antiparasitarios"
                        style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                        onFocus={e => (e.target.style.borderColor = "#e8197d")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
                      <datalist id="edit-cats">{categoriasExistentes.map(c => <option key={c} value={c} />)}</datalist>
                    </>
                  ) : key === "subcategoria" ? (
                    <>
                      <input list="edit-subcats" value={(editFields.subcategoria as string) ?? ""} onChange={e => setEditFields(f => ({ ...f, subcategoria: e.target.value }))}
                        placeholder="Ej: Externos (opcional)"
                        style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                        onFocus={e => (e.target.style.borderColor = "#7c3aed")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
                      <datalist id="edit-subcats">{subcategoriasExistentes.map(c => <option key={c} value={c} />)}</datalist>
                    </>
                  ) : (
                    <input type="text" value={(editFields[key] as string) ?? ""} onChange={e => setEditFields(f => ({ ...f, [key]: e.target.value }))}
                      style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                      onFocus={e => (e.target.style.borderColor = "#e8197d")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
                  )}
                </div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "#374151", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.6 }}>Precio venta ($)</label>
                  <input type="number" value={editFields.precio_venta ?? ""} onChange={e => setEditFields(f => ({ ...f, precio_venta: parseFloat(e.target.value) || 0 }))}
                    style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = "#e8197d")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "#374151", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.6 }}>Stock</label>
                  <input type="number" value={editFields.stock ?? ""} onChange={e => setEditFields(f => ({ ...f, stock: parseInt(e.target.value) || 0 }))}
                    style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = "#e8197d")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
                </div>
              </div>
            </div>
              {/* Imagen */}
              <div>
                <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "#374151", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6 }}>Imagen del producto</label>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {editProducto.imagen_url ? (
                    <img src={editProducto.imagen_url} alt="" style={{ width: 64, height: 64, objectFit: "contain", borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc" }} />
                  ) : (
                    <div style={{ width: 64, height: 64, borderRadius: 10, border: "2px dashed #e2e8f0", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📷</div>
                  )}
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "inline-block", padding: "8px 14px", background: subiendoImagen ? "#f1f5f9" : "#1a2035", color: subiendoImagen ? "#94a3b8" : "white", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: subiendoImagen ? "not-allowed" : "pointer" }}>
                      {subiendoImagen ? "Subiendo..." : editProducto.imagen_url ? "Cambiar imagen" : "Subir imagen"}
                      <input type="file" accept="image/*" style={{ display: "none" }} disabled={subiendoImagen}
                        onChange={e => { const f = e.target.files?.[0]; if (f) subirImagen(f); e.target.value = "" }} />
                    </label>
                    <p style={{ margin: "5px 0 0", fontSize: 11, color: "#94a3b8" }}>JPG, PNG o WEBP · máx 5 MB</p>
                    {imagenError && <p style={{ margin: "4px 0 0", fontSize: 11, color: "#dc2626", fontWeight: 600 }}>{imagenError}</p>}
                  </div>
                </div>
              </div>

            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button onClick={() => setEditProducto(null)} style={{ flex: 1, padding: "11px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
              <button onClick={guardarProducto} disabled={guardandoProd} style={{ flex: 2, padding: "11px", background: guardandoProd ? "#f9a8d4" : "#e8197d", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 900, cursor: guardandoProd ? "not-allowed" : "pointer" }}>
                {guardandoProd ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal carga masiva de imágenes ── */}
      {modalMasivo && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,15,28,0.78)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget && !subiendoMasivo) { limpiarMasivo(); setModalMasivo(false) } }}>
          <div style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 680, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 32px 80px rgba(0,0,0,0.45)", overflow: "hidden" }}>

            {/* Header */}
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "#1a2035" }}>Carga masiva de imágenes</h2>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b" }}>
                  Seleccioná varias fotos y asignale un producto a cada una.
                </p>
              </div>
              <button onClick={() => { if (!subiendoMasivo) { limpiarMasivo(); setModalMasivo(false) } }}
                style={{ width: 32, height: 32, border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", cursor: "pointer", fontSize: 15, color: "#64748b", flexShrink: 0 }}>✕</button>
            </div>

            {/* Zona drag & drop */}
            <div style={{ padding: "16px 24px", flexShrink: 0 }}>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) agregarImagenes(e.dataTransfer.files) }}
                style={{ border: `2px dashed ${dragOver ? "#e8197d" : "#cbd5e1"}`, borderRadius: 12, padding: "20px 16px", textAlign: "center", background: dragOver ? "#fff0f7" : "#f8fafc", transition: "all 0.15s", cursor: "default" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🖼️</div>
                <p style={{ margin: "0 0 10px", fontSize: 13, color: "#475569", fontWeight: 600 }}>Arrastrá imágenes acá</p>
                <label style={{ display: "inline-block", padding: "8px 18px", background: "#1a2035", color: "white", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  O elegí archivos
                  <input type="file" accept="image/*" multiple style={{ display: "none" }}
                    onChange={e => { if (e.target.files?.length) agregarImagenes(e.target.files); e.target.value = "" }} />
                </label>
              </div>
            </div>

            {/* Lista de imágenes */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 16px" }}>
              {imagenesPendientes.length === 0 && (
                <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: "24px 0" }}>No hay imágenes cargadas todavía.</p>
              )}
              {imagenesPendientes.map((item, idx) => {
                const prodsFiltrados = productos.filter(p => {
                  if (!item.busq.trim()) return true
                  const q = normalizarTexto(item.busq)
                  return normalizarTexto(p.nombre).includes(q) || normalizarTexto(p.laboratorio ?? "").includes(q)
                }).slice(0, 8)

                const estadoColor = item.estado === "ok" ? "#16a34a" : item.estado === "error" ? "#dc2626" : item.estado === "subiendo" ? "#7c3aed" : "#64748b"
                const estadoLabel = item.estado === "ok" ? "✓ Subida" : item.estado === "error" ? "✗ Error" : item.estado === "subiendo" ? "Subiendo..." : item.productoId ? "Listo" : "Sin producto"

                return (
                  <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                    {/* Preview */}
                    <img src={item.previewUrl} alt="" style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", flexShrink: 0 }} />

                    {/* Info + selector */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: "0 0 6px", fontSize: 11.5, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.file.name}</p>

                      {/* Buscador de producto */}
                      <div style={{ position: "relative" }}>
                        <input
                          value={item.busq}
                          onChange={e => {
                            const val = e.target.value
                            setImagenesPendientes(prev => prev.map((it, i) => i === idx ? { ...it, busq: val, productoId: null } : it))
                            setDropdownIdx(idx)
                          }}
                          onFocus={() => setDropdownIdx(idx)}
                          onBlur={() => setTimeout(() => setDropdownIdx(d => d === idx ? null : d), 150)}
                          placeholder="Buscar producto o laboratorio..."
                          disabled={item.estado === "subiendo" || item.estado === "ok"}
                          style={{ width: "100%", padding: "7px 10px", border: `1.5px solid ${item.productoId ? "#e8197d" : "#e2e8f0"}`, borderRadius: 8, fontSize: 12, outline: "none", boxSizing: "border-box", background: item.estado === "ok" ? "#f0fdf4" : "white" }}
                        />
                        {dropdownIdx === idx && prodsFiltrados.length > 0 && (
                          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1.5px solid #e2e8f0", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 10, marginTop: 2, overflow: "hidden" }}>
                            {prodsFiltrados.map(p => (
                              <div key={p.id} onMouseDown={() => asignarProducto(idx, p)}
                                style={{ padding: "9px 12px", cursor: "pointer", borderBottom: "1px solid #f8fafc", display: "flex", alignItems: "center", gap: 8 }}
                                onMouseEnter={e => (e.currentTarget.style.background = "#fff0f7")}
                                onMouseLeave={e => (e.currentTarget.style.background = "white")}>
                                {p.imagen_url
                                  ? <img src={p.imagen_url} alt="" style={{ width: 28, height: 28, objectFit: "contain", borderRadius: 5, border: "1px solid #e2e8f0", background: "#f8fafc", flexShrink: 0 }} />
                                  : <div style={{ width: 28, height: 28, borderRadius: 5, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>📷</div>}
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1a2035", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nombre}</div>
                                  {p.laboratorio && <div style={{ fontSize: 10.5, color: "#16a34a", fontWeight: 600 }}>{p.laboratorio}</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Estado + quitar */}
                    <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: estadoColor }}>{estadoLabel}</span>
                      {item.estado !== "subiendo" && item.estado !== "ok" && (
                        <button onClick={() => setImagenesPendientes(prev => { URL.revokeObjectURL(item.previewUrl); return prev.filter((_, i) => i !== idx) })}
                          style={{ fontSize: 11, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                          Quitar
                        </button>
                      )}
                      {item.estado === "error" && item.errorMsg && (
                        <span style={{ fontSize: 10, color: "#dc2626", maxWidth: 100, textAlign: "right" }}>{item.errorMsg}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            {imagenesPendientes.length > 0 && (
              <div style={{ padding: "14px 24px", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, background: "#f8fafc" }}>
                {(() => {
                  const asignadas = imagenesPendientes.filter(it => it.productoId && it.estado !== "ok").length
                  const listas = imagenesPendientes.filter(it => it.estado === "ok").length
                  const errores = imagenesPendientes.filter(it => it.estado === "error").length
                  return (
                    <>
                      <span style={{ fontSize: 12, color: "#64748b", flex: 1 }}>
                        {asignadas > 0 && <span>{asignadas} para subir · </span>}
                        {listas > 0 && <span style={{ color: "#16a34a" }}>{listas} subidas · </span>}
                        {errores > 0 && <span style={{ color: "#dc2626" }}>{errores} con error · </span>}
                        {imagenesPendientes.filter(it => !it.productoId && it.estado === "pendiente").length > 0 && (
                          <span style={{ color: "#f59e0b" }}>{imagenesPendientes.filter(it => !it.productoId && it.estado === "pendiente").length} sin asignar</span>
                        )}
                      </span>
                      <button onClick={() => { limpiarMasivo(); setModalMasivo(false) }} disabled={subiendoMasivo}
                        style={{ padding: "9px 16px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        Cerrar
                      </button>
                      <button onClick={subirImagenesMasivo} disabled={subiendoMasivo || asignadas === 0}
                        style={{ padding: "9px 20px", background: subiendoMasivo || asignadas === 0 ? "#f9a8d4" : "#e8197d", color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 900, cursor: subiendoMasivo || asignadas === 0 ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                        {subiendoMasivo ? "Subiendo..." : `Subir ${asignadas} imagen${asignadas !== 1 ? "es" : ""}`}
                      </button>
                    </>
                  )
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid #e8197d", borderTopColor: "transparent", margin: "0 auto", animation: "spin 0.8s linear infinite" }} />
    </div>
  )
}
