"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

const CATEGORIAS = [
  "Accesorios",
  "Alimento Balanceado",
  "Ambiental",
  "Desinfectantes",
  "Instrumental y Descartables",
  "Medicamentos",
  "Pet Shop",
  "Antibióticos",
  "Antiparasitarios",
  "Suplementos Minerales",
  "Antiinflamatorios",
  "Analgésicos y Tranquilizantes",
  "Vacunas",
  "Piedras Sanitarias",
  "Cercos Eléctricos",
  "Identificación de Ganado",
  "Snacks",
  "Protectores Articulares",
  "Cremas",
  "Colirios",
  "Antidiarreicos",
  "Protectores Hepáticos",
  "Revulsivos",
  "Agroinsumos",
  "Sustituto Lácteo",
]

interface Producto {
  id: number
  nombre: string
  categoria: string | null
}

export default function CategoriasPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const [filtroCategoria, setFiltroCategoria] = useState("")
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set())
  const [cambios, setCambios] = useState<Record<number, string | null>>({})
  const [categoriaEnMasa, setCategoriaEnMasa] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const mostrarToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const cargar = useCallback(async () => {
    setCargando(true)
    let todos: Producto[] = []
    let desde = 0
    while (true) {
      const { data } = await supabase
        .from("productos")
        .select("id, nombre, categoria")
        .gt("stock", 0)
        .order("nombre")
        .range(desde, desde + 999)
      if (!data || data.length === 0) break
      todos = [...todos, ...data]
      if (data.length < 1000) break
      desde += 1000
    }
    setProductos(todos)
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const getCat = (p: Producto) => cambios[p.id] !== undefined ? cambios[p.id] : p.categoria

  const productosFiltrados = productos.filter(p => {
    const matchNombre = p.nombre.toLowerCase().includes(busqueda.toLowerCase())
    const cat = getCat(p)
    const matchCat =
      filtroCategoria === "__sin__" ? !cat :
      filtroCategoria === "" ? true :
      cat === filtroCategoria
    return matchNombre && matchCat
  })

  const toggleSeleccion = (id: number) => {
    setSeleccionados(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleTodos = () => {
    if (seleccionados.size === productosFiltrados.length) setSeleccionados(new Set())
    else setSeleccionados(new Set(productosFiltrados.map(p => p.id)))
  }

  const aplicarEnMasa = () => {
    if (seleccionados.size === 0 || categoriaEnMasa === "") return
    const val = categoriaEnMasa === "__sin__" ? null : categoriaEnMasa
    setCambios(prev => {
      const next = { ...prev }
      for (const id of seleccionados) next[id] = val
      return next
    })
  }

  const cambiarIndividual = (id: number, val: string) => {
    setCambios(prev => ({ ...prev, [id]: val === "__sin__" ? null : val }))
  }

  const guardarTodo = async () => {
    const ids = Object.keys(cambios).map(Number)
    if (ids.length === 0) { mostrarToast("Sin cambios pendientes", false); return }
    setGuardando(true)
    let errores = 0
    for (const id of ids) {
      const { error } = await supabase
        .from("productos")
        .update({ categoria: cambios[id] })
        .eq("id", id)
      if (error) errores++
    }
    setGuardando(false)
    if (errores === 0) {
      setCambios({})
      setSeleccionados(new Set())
      mostrarToast(`${ids.length} producto${ids.length !== 1 ? "s" : ""} actualizado${ids.length !== 1 ? "s" : ""}`)
      cargar()
    } else {
      mostrarToast(`${errores} error${errores !== 1 ? "es" : ""} al guardar`, false)
    }
  }

  const pendientes = Object.keys(cambios).length

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
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Editor de categorías</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            Asigná categorías a los productos para que aparezcan agrupados en la tienda
          </p>
        </div>
      </div>

      <div style={{ padding: "24px 32px", maxWidth: 1000, margin: "0 auto" }}>

        {/* Chips de categorías */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {CATEGORIAS.map(c => (
            <span key={c} style={{
              padding: "4px 12px", borderRadius: 20, background: "#1e293b",
              color: "#94a3b8", fontSize: 12, fontWeight: 500, border: "1px solid #334155"
            }}>{c}</span>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar producto..."
            style={{ flex: 1, minWidth: 180, padding: "8px 12px", borderRadius: 8, background: "#1e293b", border: "1px solid #334155", color: "#f1f5f9", fontSize: 14, outline: "none" }}
          />
          <select
            value={filtroCategoria}
            onChange={e => setFiltroCategoria(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, background: "#1e293b", border: "1px solid #334155", color: "#f1f5f9", fontSize: 14, cursor: "pointer" }}
          >
            <option value="__sin__">Sin categoría (pendientes)</option>
            <option value="">Todos los productos</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Acciones en masa */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", padding: "10px 14px", borderRadius: 8, background: "#0f172a", border: "1px solid #1e293b", flexWrap: "wrap" }}>
          <span style={{ color: "#94a3b8", fontSize: 13, minWidth: 120 }}>
            {seleccionados.size} seleccionado{seleccionados.size !== 1 ? "s" : ""}
          </span>
          <select
            value={categoriaEnMasa}
            onChange={e => setCategoriaEnMasa(e.target.value)}
            style={{ padding: "7px 12px", borderRadius: 8, background: "#1e293b", border: "1px solid #334155", color: "#f1f5f9", fontSize: 13, cursor: "pointer" }}
          >
            <option value="">— Asignar categoría —</option>
            <option value="__sin__">Sin categoría</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            onClick={aplicarEnMasa}
            disabled={seleccionados.size === 0 || categoriaEnMasa === ""}
            style={{
              padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: seleccionados.size > 0 && categoriaEnMasa !== "" ? "#3b82f6" : "#1e293b",
              color: seleccionados.size > 0 && categoriaEnMasa !== "" ? "#fff" : "#475569",
              border: "none", cursor: seleccionados.size > 0 && categoriaEnMasa !== "" ? "pointer" : "default"
            }}
          >
            Aplicar
          </button>
          <div style={{ flex: 1 }} />
          {pendientes > 0 && (
            <span style={{ padding: "4px 10px", borderRadius: 12, background: "#854d0e33", color: "#fbbf24", fontSize: 12, fontWeight: 600, border: "1px solid #92400e44" }}>
              {pendientes} sin guardar
            </span>
          )}
          <button
            onClick={guardarTodo}
            disabled={guardando || pendientes === 0}
            style={{
              padding: "7px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
              background: pendientes > 0 ? "#16a34a" : "#1e293b",
              color: pendientes > 0 ? "#fff" : "#475569",
              border: "none", cursor: pendientes > 0 ? "pointer" : "default"
            }}
          >
            {guardando ? "Guardando..." : "Guardar todo"}
          </button>
        </div>

        {/* Tabla */}
        <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #1e293b" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#0f172a" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", width: 40 }}>
                  <input type="checkbox"
                    checked={productosFiltrados.length > 0 && seleccionados.size === productosFiltrados.length}
                    onChange={toggleTodos}
                    style={{ cursor: "pointer", accentColor: "#3b82f6" }}
                  />
                </th>
                <th style={{ padding: "10px 14px", textAlign: "left", color: "#94a3b8", fontWeight: 600 }}>Producto</th>
                <th style={{ padding: "10px 14px", textAlign: "left", color: "#94a3b8", fontWeight: 600, width: 260 }}>Categoría</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #1e293b" }}>
                    <td style={{ padding: "10px 14px" }} />
                    <td style={{ padding: "10px 14px" }}><div className="skeleton" style={{ height: 16, borderRadius: 6, width: "60%" }} /></td>
                    <td style={{ padding: "10px 14px" }}><div className="skeleton" style={{ height: 32, borderRadius: 8 }} /></td>
                  </tr>
                ))
              ) : productosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: "40px 0", textAlign: "center", color: "#475569" }}>
                    {filtroCategoria === "__sin__" ? "✓ Todos los productos tienen categoría asignada" : "No se encontraron productos"}
                  </td>
                </tr>
              ) : (
                productosFiltrados.map(p => {
                  const cat = getCat(p)
                  const modificado = cambios[p.id] !== undefined
                  return (
                    <tr
                      key={p.id}
                      onClick={() => toggleSeleccion(p.id)}
                      style={{
                        borderTop: "1px solid #1e293b",
                        background: seleccionados.has(p.id) ? "#1e3a5f22" : modificado ? "#1a2e1a" : "transparent",
                        cursor: "pointer", transition: "background 0.1s"
                      }}
                    >
                      <td style={{ padding: "10px 14px" }} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={seleccionados.has(p.id)} onChange={() => toggleSeleccion(p.id)}
                          style={{ cursor: "pointer", accentColor: "#3b82f6" }} />
                      </td>
                      <td style={{ padding: "10px 14px", color: "#e2e8f0" }}>
                        {p.nombre}
                        {modificado && <span style={{ marginLeft: 8, fontSize: 11, color: "#86efac", fontWeight: 600 }}>✎</span>}
                      </td>
                      <td style={{ padding: "8px 14px" }} onClick={e => e.stopPropagation()}>
                        <select
                          value={cat ?? "__sin__"}
                          onChange={e => cambiarIndividual(p.id, e.target.value)}
                          style={{
                            width: "100%", padding: "6px 10px", borderRadius: 7,
                            background: modificado ? "#14532d" : "#1e293b",
                            border: modificado ? "1px solid #16a34a" : "1px solid #334155",
                            color: "#f1f5f9", fontSize: 13, cursor: "pointer"
                          }}
                        >
                          <option value="__sin__">Sin categoría</option>
                          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {!cargando && (
          <p style={{ margin: "10px 0 0", color: "#475569", fontSize: 13, textAlign: "right" }}>
            {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? "s" : ""}
            {filtroCategoria === "__sin__" && ` sin categoría`}
          </p>
        )}
      </div>

      {toast && (
        <div className="toast-anim" style={{
          position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
          background: toast.ok ? "#16a34a" : "#dc2626",
          color: "#fff", padding: "12px 24px", borderRadius: 10,
          fontSize: 14, fontWeight: 600, boxShadow: "0 4px 24px #0008", zIndex: 9999
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
