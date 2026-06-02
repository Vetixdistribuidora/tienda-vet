"use client"

import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import Image from "next/image"
import { supabase } from "@/lib/supabase"

// ── Types ────────────────────────────────────────────────────────────────────

type Producto = {
  id: number
  nombre: string
  precio_venta: number
  stock: number
  categoria: string | null
  subcategoria: string | null
  laboratorio: string | null
  imagen_url: string | null
}
type ItemCarrito = { producto: Producto; cantidad: number; nota?: string }
type Orden = "az" | "za" | "precio_asc" | "precio_desc" | "stock_asc"
type PedidoHistorial = {
  id: number
  created_at: string
  estado: string
  total: number
  pedido_items: { producto_id: number | null; nombre_producto: string; cantidad: number; precio_unitario: number }[]
}

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP ?? ""
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? ""

const CATEGORIAS_ORDEN = ["Accesorios", "Alimento Balanceado", "Ambiental", "Desinfectantes", "Instrumental y Descartables", "Medicamentos", "Pet Shop", "Antibióticos", "Antiparasitarios", "Suplementos Minerales", "Antiinflamatorios", "Analgésicos y Tranquilizantes", "Vacunas", "Piedras Sanitarias", "Cercos Eléctricos", "Identificación de Ganado", "Snacks", "Protectores Articulares", "Cremas", "Colirios", "Antidiarreicos", "Protectores Hepáticos", "Revulsivos", "Agroinsumos", "Sustituto Lácteo"]

// Colores e iconos por categoría para las tarjetas visuales
// beige cálido · azul pizarra · verde salvia · rosa pastel
const _BG1 = "#faf7f4", _C1 = "#6b5744", _B1 = "#e8ddd4" // beige — tratamientos
const _BG2 = "#f4f6fb", _C2 = "#3d5270", _B2 = "#c8d4e8" // azul pizarra — clínico
const _BG3 = "#f4f8f4", _C3 = "#3d5e3d", _B3 = "#c4d8c4" // verde salvia — alimentación/campo
const _BG4 = "#fdf0f5", _C4 = "#b05070", _B4 = "#f0c8d8" // rosa — accesorios/otros
const CAT_ESTILO: Record<string, { bg: string; color: string; border: string; icon: string }> = {
  "Medicamentos":                  { bg: _BG1, color: _C1, border: _B1, icon: "💊" },
  "Antiparasitarios":              { bg: _BG1, color: _C1, border: _B1, icon: "🛡️" },
  "Analgésicos y Tranquilizantes": { bg: _BG1, color: _C1, border: _B1, icon: "💆" },
  "Antiinflamatorios":             { bg: _BG1, color: _C1, border: _B1, icon: "🔥" },
  "Cremas":                        { bg: _BG1, color: _C1, border: _B1, icon: "🧴" },
  "Desinfectantes":                { bg: _BG1, color: _C1, border: _B1, icon: "🧴" },
  "Antidiarreicos":                { bg: _BG1, color: _C1, border: _B1, icon: "💊" },
  "Revulsivos":                    { bg: _BG1, color: _C1, border: _B1, icon: "🌡️" },
  "Antibióticos":                  { bg: _BG2, color: _C2, border: _B2, icon: "🔬" },
  "Vacunas":                       { bg: _BG2, color: _C2, border: _B2, icon: "💉" },
  "Colirios":                      { bg: _BG2, color: _C2, border: _B2, icon: "👁️" },
  "Instrumental y Descartables":   { bg: _BG2, color: _C2, border: _B2, icon: "🩺" },
  "Accesorios":                    { bg: _BG2, color: _C2, border: _B2, icon: "🎒" },
  "Protectores Articulares":       { bg: _BG2, color: _C2, border: _B2, icon: "🦴" },
  "Protectores Hepáticos":         { bg: _BG2, color: _C2, border: _B2, icon: "🫀" },
  "Alimento Balanceado":           { bg: _BG3, color: _C3, border: _B3, icon: "🌾" },
  "Ambiental":                     { bg: _BG3, color: _C3, border: _B3, icon: "🌿" },
  "Agroinsumos":                   { bg: _BG3, color: _C3, border: _B3, icon: "🌱" },
  "Sustituto Lácteo":              { bg: _BG3, color: _C3, border: _B3, icon: "🥛" },
  "Identificación de Ganado":      { bg: _BG3, color: _C3, border: _B3, icon: "🏷️" },
  "Snacks":                        { bg: _BG3, color: _C3, border: _B3, icon: "🦴" },
  "Suplementos Minerales":         { bg: _BG3, color: _C3, border: _B3, icon: "⚗️" },
  "Pet Shop":                      { bg: _BG4, color: _C4, border: _B4, icon: "🐾" },
  "Piedras Sanitarias":            { bg: _BG4, color: _C4, border: _B4, icon: "🪨" },
  "Cercos Eléctricos":             { bg: _BG4, color: _C4, border: _B4, icon: "⚡" },
}
const CAT_DEFAULT = { bg: "#f5f7fb", color: "#374151", border: "#e2e8f0", icon: "📦" }

// ── Precios por rol ───────────────────────────────────────────────────────
const FACTOR_VET  = 1.30
const FACTOR_PROD = 1.58
type TipoCliente = "veterinario" | "productor" | "pendiente"
type PerfilUsuario = {
  id: string; nombre: string; apellido: string; email: string
  telefono: string; direccion: string; tipo_cliente: TipoCliente
}
function precioConTipo(precioVenta: number, tipo: TipoCliente | null): number | null {
  if (tipo === "veterinario") return Math.round(precioVenta * FACTOR_VET * 100) / 100
  if (tipo === "productor")   return Math.round(precioVenta * FACTOR_PROD * 100) / 100
  return null
}

// ── Banner de anuncio ─────────────────────────────────────────────────────
// Cambiá el texto para mostrar un anuncio en la parte superior.
// Si es string vacío ("") el banner no aparece.
// Cambiá el número en "vetix_banner_X" cuando actualices el texto para que
// los clientes que ya lo cerraron vean el nuevo anuncio.
const BANNER_TEXTO = ""
const BANNER_VERSION = "vetix_banner_1"

function fmt(n: number) {
  return "$" + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Logo ─────────────────────────────────────────────────────────────────────

function LogoMarca({ height = 46 }: { height?: number }) {
  return (
    <div style={{
      borderRadius: 8,
      overflow: "hidden",
      display: "inline-flex",
      alignItems: "center",
      flexShrink: 0,
      lineHeight: 0,
    }}>
      <Image
        src="/vetix-azul.jpeg"
        alt="VETIX Distribuidora"
        height={height}
        width={height * 4}
        style={{ height, width: "auto", display: "block" }}
        priority
      />
    </div>
  )
}

// ── Íconos ───────────────────────────────────────────────────────────────────

function IcoSearch() {
  return (
    <svg width="15" height="15" fill="none" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  )
}
function IcoCart({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  )
}
function IcoClose() {
  return (
    <svg width="15" height="15" fill="none" strokeWidth="2.5" viewBox="0 0 24 24" stroke="currentColor">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}
function IcoBox() {
  return (
    <svg width="36" height="36" fill="none" strokeWidth="1.2" viewBox="0 0 24 24" stroke="#c4cad6">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
    </svg>
  )
}
function IcoWA({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  )
}
function IcoCheck() {
  return (
    <svg width="14" height="14" fill="none" strokeWidth="2.5" viewBox="0 0 24 24" stroke="currentColor">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
// Resalta las palabras buscadas dentro de un texto
function HighlightText({ texto, query }: { texto: string; query: string }) {
  if (!query.trim()) return <>{texto}</>
  const palabras = query.trim().split(/\s+/).filter(w => w.length >= 2)
  if (palabras.length === 0) return <>{texto}</>
  const escapadas = palabras.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  const partes = texto.split(new RegExp(`(${escapadas.join("|")})`, "gi"))
  return (
    <>
      {partes.map((parte, i) =>
        i % 2 === 1
          ? <mark key={i} style={{ background: "#fef08a", color: "#92400e", borderRadius: 2, padding: "0 1px", fontWeight: 800 }}>{parte}</mark>
          : parte
      )}
    </>
  )
}

// Devuelve texto y colores del badge de stock
function stockLabel(stock: number): { text: string; color: string; bg: string; border: string } | null {
  if (stock <= 0) return null
  if (stock === 1) return { text: "¡Última unidad!", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" }
  if (stock <= 3)  return { text: `Solo ${stock} unidades`, color: "#dc2626", bg: "#fef2f2", border: "#fecaca" }
  if (stock <= 10) return { text: "Stock limitado", color: "#92400e", bg: "#fef3c7", border: "#fde68a" }
  return null
}

function IcoZoom({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6M8 11h6"/>
    </svg>
  )
}
function IcoShare({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  )
}


// ── Sub-components ───────────────────────────────────────────────────────────

function Toast({ mensaje }: { mensaje: string }) {
  return (
    <div className="toast-anim" style={{
      position: "fixed", bottom: 90, right: 20, zIndex: 200,
      background: "#0f172a", color: "white", padding: "12px 18px",
      borderRadius: 14, fontSize: 13, fontWeight: 600,
      boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
      display: "flex", alignItems: "center", gap: 9, maxWidth: 300,
      border: "1px solid #1e293b",
    }}>
      <span style={{ width: 22, height: 22, background: "#d4688e", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "white" }}>
        <IcoCheck />
      </span>
      {mensaje}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div style={{ background: "#e8e8e8", borderRadius: 14, border: "1px solid #e6e2de", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
      <div className="skeleton" style={{ height: 166 }} />
      <div style={{ padding: "14px 14px 16px" }}>
        <div className="skeleton" style={{ height: 10, borderRadius: 6, marginBottom: 10, width: "45%" }} />
        <div className="skeleton" style={{ height: 14, borderRadius: 6, marginBottom: 6 }} />
        <div className="skeleton" style={{ height: 14, borderRadius: 6, width: "68%", marginBottom: 18 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="skeleton" style={{ height: 22, width: 72, borderRadius: 6 }} />
          <div className="skeleton" style={{ height: 36, width: 86, borderRadius: 9 }} />
        </div>
      </div>
    </div>
  )
}

function FilaListaProducto({ p, enCarrito, onAgregar, onCambiar, onDetalle, esFav, onToggleFav, searchQuery, tipoCliente, onVerPrecio }: {
  p: Producto; enCarrito: number; onAgregar: () => void; onCambiar: (d: number) => void
  onDetalle: () => void; esFav: boolean; onToggleFav: () => void; searchQuery?: string
  tipoCliente?: TipoCliente | null; onVerPrecio?: () => void
}) {
  const [hover, setHover] = useState(false)
  const badge = stockLabel(p.stock)
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 14px", background: "#e8e8e8", borderRadius: 10, border: `1.5px solid ${hover ? "#f4b8d4" : "#e6e2de"}`, transition: "border-color 0.15s", minWidth: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>

      {/* Imagen mini */}
      <div onClick={onDetalle} style={{ width: 48, height: 48, background: "#f7f8fb", borderRadius: 8, flexShrink: 0, cursor: "pointer", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        {p.imagen_url
          ? <Image src={p.imagen_url} alt="" fill sizes="48px" style={{ objectFit: "contain", padding: 4 }} />
          : <div style={{ opacity: 0.25 }}><IcoBox /></div>}
      </div>

      {/* Lab */}
      {p.laboratorio && (
        <span className="hide-sm" style={{ fontSize: 9.5, fontWeight: 800, color: "#b05070", background: "#fdf0f5", border: "1px solid #f0c8d8", borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap", flexShrink: 0 }}>
          {p.laboratorio}
        </span>
      )}

      {/* Nombre */}
      <p onClick={onDetalle} style={{ flex: 1, margin: 0, fontSize: 13, fontWeight: 600, color: "#1a2035", cursor: "pointer", lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}>
        <HighlightText texto={p.nombre} query={searchQuery ?? ""} />
      </p>

      {/* Categoría */}
      {p.categoria && (
        <span className="hide-sm" style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap", flexShrink: 0, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
          {p.categoria}
        </span>
      )}

      {/* Stock badge dinámico */}
      {badge && (
        <span className="hide-sm" style={{ fontSize: 9.5, fontWeight: 800, color: badge.color, background: badge.bg, border: `1px solid ${badge.border}`, borderRadius: 20, padding: "2px 7px", whiteSpace: "nowrap", flexShrink: 0 }}>
          ⚠ {badge.text}
        </span>
      )}

      {/* Precio */}
      {tipoCliente === undefined || tipoCliente === null ? (
        <button onClick={e => { e.stopPropagation(); onVerPrecio?.() }}
          style={{ fontSize: 11, fontWeight: 700, color: "#d4688e", background: "#fdf0f5", border: "1px solid #f0c8d8", borderRadius: 7, padding: "5px 10px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
          Ver precio
        </button>
      ) : tipoCliente === "pendiente" ? (
        <span style={{ fontSize: 11, fontWeight: 700, color: "#92400e", flexShrink: 0, whiteSpace: "nowrap" }}>A consultar</span>
      ) : (
        <span style={{ fontSize: 15, fontWeight: 900, color: "#d4688e", flexShrink: 0, minWidth: 88, textAlign: "right" }}>
          {fmt(precioConTipo(p.precio_venta, tipoCliente)!)}
        </span>
      )}

      {/* Favorito */}
      <button onClick={e => { e.stopPropagation(); onToggleFav() }}
        style={{ width: 28, height: 28, borderRadius: "50%", background: esFav ? "#d4688e" : "#e2e2e2", border: esFav ? "none" : "1px solid #e2e8f0", cursor: "pointer", fontSize: 13, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: esFav ? "white" : "#94a3b8", transition: "all 0.15s" }}>
        {esFav ? "♥" : "♡"}
      </button>

      {/* Agregar */}
      {enCarrito > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 2, background: "#fdf0f5", border: "2px solid #d4688e", borderRadius: 9, padding: "2px 3px", flexShrink: 0 }}>
          <button onClick={e => { e.stopPropagation(); onCambiar(-1) }} style={{ width: 24, height: 24, border: "none", borderRadius: 6, background: "#fdf0f5", color: "#be185d", fontWeight: 900, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
          <span style={{ fontSize: 12, fontWeight: 900, color: "#be185d", minWidth: 20, textAlign: "center" }}>{enCarrito}</span>
          <button onClick={e => { e.stopPropagation(); onCambiar(1) }} style={{ width: 24, height: 24, border: "none", borderRadius: 6, background: "#d4688e", color: "white", fontWeight: 900, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
        </div>
      ) : (
        <button onClick={e => { e.stopPropagation(); onAgregar() }}
          style={{ background: "#d4688e", color: "white", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, transition: "background 0.15s, transform 0.12s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "#b05070"; e.currentTarget.style.transform = "scale(1.06)" }}
          onMouseLeave={e => { e.currentTarget.style.background = "#d4688e"; e.currentTarget.style.transform = "scale(1)" }}>
          + Agregar
        </button>
      )}
    </div>
  )
}

function TarjetaProducto({ p, enCarrito, onAgregar, onCambiar, onDetalle, esFav, onToggleFav, tipoCliente, onVerPrecio }: {
  p: Producto; enCarrito: number; onAgregar: () => void; onCambiar: (d: number) => void
  onDetalle: () => void; esFav: boolean; onToggleFav: () => void
  tipoCliente?: TipoCliente | null; onVerPrecio?: () => void
}) {
  const [hover, setHover] = useState(false)
  const badge = stockLabel(p.stock)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "#e8e8e8",
        borderRadius: 14,
        border: `1.5px solid ${hover ? "#f4b8d4" : "#e6e2de"}`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "box-shadow 0.2s, border-color 0.2s, transform 0.18s",
        boxShadow: hover
          ? "0 12px 32px rgba(212,104,142,0.14), 0 4px 12px rgba(0,0,0,0.1)"
          : "0 2px 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)",
        transform: hover ? "translateY(-4px)" : "none",
      }}
    >
      {/* Imagen — clickeable para ver detalle */}
      <div onClick={onDetalle} style={{ height: 166, background: "#f7f8fb", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative", flexShrink: 0, cursor: "pointer" }}>
        {p.imagen_url
          ? <Image src={p.imagen_url} alt={p.nombre} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" style={{ objectFit: "contain", padding: 10, transition: "transform 0.35s", transform: hover ? "scale(1.07)" : "scale(1)" }} />
          : <div style={{ opacity: 0.4 }}><IcoBox /></div>
        }
        {/* Laboratorio — solo si NO hay ítem en carrito para no solapar */}
        {p.laboratorio && enCarrito === 0 && (
          <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(255,255,255,0.95)", color: "#b05070", fontSize: 9.5, fontWeight: 800, padding: "3px 8px", borderRadius: 20, border: "1px solid #f0c8d8", maxWidth: "calc(100% - 44px)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
            {p.laboratorio}
          </div>
        )}
        {/* Favorito */}
        <button onClick={e => { e.stopPropagation(); onToggleFav() }}
          style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", background: esFav ? "#d4688e" : "rgba(255,255,255,0.9)", border: esFav ? "none" : "1px solid #e2e8f0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", transition: "all 0.15s", zIndex: 2 }}>
          {esFav ? "♥" : "♡"}
        </button>
        {/* Check "en carrito" — top-left, reemplaza el badge de lab */}
        {enCarrito > 0 && (
          <div style={{ position: "absolute", top: 8, left: 8, display: "flex", alignItems: "center", gap: 4, background: "#d4688e", borderRadius: 20, padding: "3px 8px 3px 5px", boxShadow: "0 2px 8px rgba(212,104,142,0.5)", zIndex: 2 }}>
            <span style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
              <IcoCheck />
            </span>
            <span style={{ fontSize: 10, fontWeight: 900, color: "white" }}>{enCarrito}</span>
          </div>
        )}
        {badge && (
          <div style={{ position: "absolute", bottom: 8, left: 8, background: badge.bg, color: badge.color, fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 20, border: `1px solid ${badge.border}` }}>
            ⚠ {badge.text}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "12px 13px 14px", flex: 1, display: "flex", flexDirection: "column" }}>
        {p.categoria && (
          <span style={{ fontSize: 9.5, fontWeight: 800, color: "#d4688e", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5, display: "block" }}>
            {p.categoria}
          </span>
        )}
        <p onClick={onDetalle} className="producto-nombre" style={{ margin: "0 0 auto", fontSize: 13, fontWeight: 700, color: "#1a2035", lineHeight: 1.45, paddingBottom: 12, cursor: "pointer" }}>
          {p.nombre}
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
          {tipoCliente === undefined || tipoCliente === null ? (
            <button onClick={e => { e.stopPropagation(); onVerPrecio?.() }}
              style={{ fontSize: 11, fontWeight: 700, color: "#d4688e", background: "#fdf0f5", border: "1px solid #f0c8d8", borderRadius: 7, padding: "5px 10px", cursor: "pointer", whiteSpace: "nowrap" }}>
              Ver precio
            </button>
          ) : tipoCliente === "pendiente" ? (
            <span style={{ fontSize: 12, fontWeight: 700, color: "#92400e" }}>A consultar</span>
          ) : (
            <span style={{ fontSize: 17, fontWeight: 900, color: "#d4688e", letterSpacing: -0.3 }}>{fmt(precioConTipo(p.precio_venta, tipoCliente)!)}</span>
          )}
          {enCarrito > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 2, background: "#fdf0f5", border: "2px solid #d4688e", borderRadius: 10, padding: "2px 4px" }}>
              <button onClick={e => { e.stopPropagation(); onCambiar(-1) }} style={{ width: 26, height: 26, border: "none", borderRadius: 7, background: "#fdf0f5", color: "#be185d", fontWeight: 900, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>−</button>
              <span style={{ fontSize: 13, fontWeight: 900, color: "#be185d", minWidth: 22, textAlign: "center" }}>{enCarrito}</span>
              <button onClick={e => { e.stopPropagation(); onCambiar(1) }} style={{ width: 26, height: 26, border: "none", borderRadius: 7, background: "#d4688e", color: "white", fontWeight: 900, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>+</button>
            </div>
          ) : (
            <button onClick={e => { e.stopPropagation(); onAgregar() }} style={{ background: "#d4688e", color: "white", border: "none", borderRadius: 9, padding: "8px 13px", fontSize: 12, fontWeight: 800, cursor: "pointer", transition: "background 0.15s, transform 0.12s", whiteSpace: "nowrap" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#b05070"; e.currentTarget.style.transform = "scale(1.06)" }}
              onMouseLeave={e => { e.currentTarget.style.background = "#d4688e"; e.currentTarget.style.transform = "scale(1)" }}>
              + Agregar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function TabCategoria({ label, count, activo, onClick }: { label: string; count: number; activo: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "0 4px",
      height: "100%",
      background: "none",
      border: "none",
      borderBottom: `2.5px solid ${activo ? "#d4688e" : "transparent"}`,
      color: activo ? "#d4688e" : "#64748b",
      cursor: "pointer",
      whiteSpace: "nowrap",
      display: "flex", alignItems: "center", gap: 6,
      fontSize: 13, fontWeight: activo ? 800 : 600,
      transition: "all 0.15s",
      flexShrink: 0,
    }}>
      {label}
      <span style={{
        fontSize: 10, fontWeight: 800,
        background: activo ? "#fdf0f5" : "#f1f5f9",
        color: activo ? "#d4688e" : "#94a3b8",
        borderRadius: 20, padding: "1px 7px",
        transition: "all 0.15s",
      }}>
        {count}
      </span>
    </button>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────

export default function Tienda() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const [categoriaActiva, setCategoriaActiva] = useState("")
  const [subcategoriaActiva, setSubcategoriaActiva] = useState("")
  const [orden, setOrden] = useState<Orden>("az")

  const [carrito, setCarrito] = useState<ItemCarrito[]>(() => {
    if (typeof window === "undefined") return []
    try { return JSON.parse(localStorage.getItem("vetix_cart") ?? "[]") } catch { return [] }
  })
  const [carritoOpen, setCarritoOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [pedidoOk, setPedidoOk] = useState(false)
  const [numeroPedido, setNumeroPedido] = useState<number | null>(null)
  const [precioFinal, setPrecioFinal] = useState(0)
  const [pedidoCarrito, setPedidoCarrito] = useState<ItemCarrito[]>([])
  const [enviando, setEnviando] = useState(false)
  const [errPedido, setErrPedido] = useState("")

  const [form, setForm] = useState({ nombre: "", telefono: "", email: "", direccion: "", notas: "" })
  const [errForm, setErrForm] = useState<Record<string, string>>({})
  const [scrollY, setScrollY] = useState(0)

  // ── Detalle producto ─────────────────────────────────────────────────────
  const [productoDetalle, setProductoDetalle] = useState<Producto | null>(null)

  // ── Filtro precio ─────────────────────────────────────────────────────────
  const [precioMin, setPrecioMin] = useState("")
  const [precioMax, setPrecioMax] = useState("")

  // ── Historial pedidos ─────────────────────────────────────────────────────
  const [pedidosOpen, setPedidosOpen] = useState(false)
  const [misPedidos, setMisPedidos] = useState<PedidoHistorial[]>([])
  const [cargandoPedidos, setCargandoPedidos] = useState(false)

  // ── Paginación ────────────────────────────────────────────────────────────
  const [visibles, setVisibles] = useState(48)

  // ── Favoritos (localStorage) ──────────────────────────────────────────────
  const [favoritos, setFavoritos] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set()
    try { return new Set(JSON.parse(localStorage.getItem("vetix_favs") ?? "[]")) } catch { return new Set() }
  })

  // ── Búsqueda con sugerencias + recientes ─────────────────────────────────
  const [searchFocus, setSearchFocus] = useState(false)
  const [busquedasRecientes, setBusquedasRecientes] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("vetix_recent") ?? "[]") } catch { return [] }
  })

  // ── Vista lista / grilla ──────────────────────────────────────────────────
  const [vistaLista, setVistaLista] = useState(false)

  // ── Filtro laboratorio (multi-select) ────────────────────────────────────
  const [laboratoriosFiltro, setLaboratoriosFiltro] = useState<Set<string>>(new Set())
  // ── Dropdown de labs abierto ──────────────────────────────────────────────
  const [labDropdownOpen, setLabDropdownOpen] = useState(false)
  // ── Dropdown de categorías abierto ────────────────────────────────────────
  const [catDropdownOpen, setCatDropdownOpen] = useState(false)

  // ── Recientemente vistos (IDs en localStorage) ───────────────────────────
  const [recientesIds, setRecientesIds] = useState<number[]>(() => {
    if (typeof window === "undefined") return []
    try { return JSON.parse(localStorage.getItem("vetix_recientes") ?? "[]") } catch { return [] }
  })

  // ── Ref para foco desde atajo de teclado "/" ──────────────────────────────
  const searchRef = useRef<HTMLInputElement>(null)

  // ── Banner anuncio ────────────────────────────────────────────────────────
  const [bannerCerrado, setBannerCerrado] = useState(() => {
    if (typeof window === "undefined") return true
    return localStorage.getItem(BANNER_VERSION) === "1"
  })

  // ── Zoom de imagen (lightbox) ─────────────────────────────────────────────
  const [imagenZoom, setImagenZoom] = useState<string | null>(null)

  // ── Edición inline de cantidad en el carrito ───────────────────────────────
  const [cantidadEditando, setCantidadEditando] = useState<{ id: number; valor: string } | null>(null)

  // ── Nota por ítem del carrito ──────────────────────────────────────────────
  const [notaEditando, setNotaEditando] = useState<number | null>(null)

  // ── Animación del botón de carrito al agregar ──────────────────────────────
  const [cartAnimando, setCartAnimando] = useState(false)

  // ── Panel de filtros colapsable ────────────────────────────────────────────
  const [filtrosExpandidos, setFiltrosExpandidos] = useState(true)

  // ── Modo catálogo: true cuando el usuario navega al catálogo explícitamente
  //    (distingue "Inicio" de "Catálogo" aunque no haya filtros activos) ─────
  const [modoCatalogo, setModoCatalogo] = useState(false)
  const [heroQuery, setHeroQuery] = useState("")

  // ── Ref para scroll infinito (sentinel) ───────────────────────────────────
  const sentinelRef = useRef<HTMLDivElement>(null)

  // ── Debounce búsqueda (valor filtrado con 300 ms de delay) ───────────────
  const [busquedaDelay, setBusquedaDelay] = useState("")

  // ── Error de carga / reintento ────────────────────────────────────────────
  const [errorCarga, setErrorCarga] = useState(false)
  const [reintento, setReintento] = useState(0)

  // ── Ref para leer ?producto= de la URL solo una vez ───────────────────────
  const urlProductoLeido = useRef(false)

  // ── Sidebar / auth / modal ────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [usuario, setUsuario] = useState<{ email: string; id: string } | null>(null)
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPass, setLoginPass] = useState("")
  const [loginCargando, setLoginCargando] = useState(false)
  const [loginError, setLoginError] = useState("")
  const [loginModo, setLoginModo] = useState<"login" | "registro">("login")
  // Auth modal + perfil
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null)
  const [tipoCliente, setTipoCliente] = useState<TipoCliente | null>(null)
  // Campos de registro
  const [regNombre, setRegNombre] = useState("")
  const [regApellido, setRegApellido] = useState("")
  const [regTelefono, setRegTelefono] = useState("")
  const [regDireccion, setRegDireccion] = useState("")
  // Editar perfil
  const [editPerfilOpen, setEditPerfilOpen] = useState(false)
  const [editNombre, setEditNombre] = useState("")
  const [editApellido, setEditApellido] = useState("")
  const [editTelefono, setEditTelefono] = useState("")
  const [editDireccion, setEditDireccion] = useState("")
  const [editGuardando, setEditGuardando] = useState(false)
  const [editError, setEditError] = useState("")

  // Cargar productos
  useEffect(() => {
    async function cargar() {
      setCargando(true)
      setErrorCarga(false)
      try {
        let todos: Producto[] = []
        let desde = 0
        while (true) {
          const { data, error } = await supabase
            .from("productos")
            .select("id, nombre, precio_venta, stock, categoria, subcategoria, laboratorio, imagen_url")
            .gt("stock", 0)
            .order("nombre")
            .range(desde, desde + 999)
          if (error || !data || data.length === 0) break
          todos = [...todos, ...data]
          if (data.length < 1000) break
          desde += 1000
        }
        if (todos.length === 0) throw new Error("Sin datos")
        setProductos(todos)
      } catch (e) {
        console.error("Error cargando productos:", e)
        setErrorCarga(true)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reintento])

  // Scroll tracker
  useEffect(() => {
    const fn = () => setScrollY(window.scrollY)
    window.addEventListener("scroll", fn, { passive: true })
    return () => window.removeEventListener("scroll", fn)
  }, [])

  const categorias = useMemo(() => {
    const set = new Set(productos.map(p => p.categoria).filter(Boolean) as string[])
    return [
      ...CATEGORIAS_ORDEN.filter(c => set.has(c)),
      ...[...set].filter(c => !CATEGORIAS_ORDEN.includes(c)).sort()
    ]
  }, [productos])

  const conteoCategoria = useMemo(() => {
    const c: Record<string, number> = {}
    for (const p of productos) if (p.categoria) c[p.categoria] = (c[p.categoria] ?? 0) + 1
    return c
  }, [productos])

  const laboratorios = useMemo(() => {
    const seen = new Map<string, string>()
    for (const p of productos) {
      if (!p.laboratorio) continue
      const clean = p.laboratorio.trim().replace(/\s+/g, " ")
      if (!clean) continue
      // Clave: solo letras españolas y números en minúscula, sin puntuación ni símbolos
      const key = clean
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[^a-zà-ü0-9 ]/g, "")
        .trim()
      if (!seen.has(key)) seen.set(key, clean)
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))
  }, [productos])

  const productosDestacados = useMemo(() => {
    const conImg = productos.filter(p => p.imagen_url)
    const sinImg = productos.filter(p => !p.imagen_url)
    return [...conImg, ...sinImg].slice(0, 8)
  }, [productos])

  const recientesProductos = useMemo(() =>
    recientesIds
      .map(id => productos.find(p => p.id === id))
      .filter((p): p is Producto => p !== undefined)
      .slice(0, 8)
  , [recientesIds, productos])

  const favoritosProductos = useMemo(() =>
    [...favoritos]
      .map(id => productos.find(p => p.id === id))
      .filter((p): p is Producto => p !== undefined)
      .slice(0, 8)
  , [favoritos, productos])

  const productosStockBajo = useMemo(() =>
    productos.filter(p => p.stock > 0 && p.stock <= 10).slice(0, 8)
  , [productos])

  const vistaHome = !cargando && !errorCarga && !busqueda.trim() && !categoriaActiva && !precioMin && !precioMax && laboratoriosFiltro.size === 0 && !modoCatalogo
  const esFiltroFavs = categoriaActiva === "__favs__"

  // Subcategorías disponibles para la categoría activa
  const subcategoriasDeCat = categoriaActiva && !esFiltroFavs
    ? [...new Set(productos.filter(p => p.categoria === categoriaActiva && p.subcategoria).map(p => p.subcategoria!))].sort()
    : []

  // Sugerencias de búsqueda (top 7 coincidencias por nombre)
  const sugerencias = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (q.length < 2) return []
    return productos.filter(p => p.nombre.toLowerCase().includes(q)).slice(0, 7)
  }, [busqueda, productos])

  function ordenar(arr: Producto[]) {
    const s = [...arr]
    if (orden === "az") s.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    else if (orden === "za") s.sort((a, b) => b.nombre.localeCompare(a.nombre, "es"))
    else if (orden === "precio_asc") s.sort((a, b) => a.precio_venta - b.precio_venta)
    else if (orden === "precio_desc") s.sort((a, b) => b.precio_venta - a.precio_venta)
    else if (orden === "stock_asc") s.sort((a, b) => a.stock - b.stock)
    return s
  }

  function filtrarProductos(arr: Producto[]) {
    let result = arr
    if (busquedaDelay.trim()) {
      const palabras = busquedaDelay.trim().toLowerCase().split(/\s+/).filter(Boolean)
      result = result.filter(p => {
        const t = p.nombre.toLowerCase() + " " + (p.laboratorio || "").toLowerCase()
        return palabras.every(w => t.includes(w))
      })
    }
    if (precioMin !== "") result = result.filter(p => p.precio_venta >= Number(precioMin))
    if (precioMax !== "") result = result.filter(p => p.precio_venta <= Number(precioMax))
    if (laboratoriosFiltro.size > 0) {
      const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase().replace(/[^a-zà-ü0-9 ]/g, "").trim()
      const labsNorm = new Set([...laboratoriosFiltro].map(norm))
      result = result.filter(p => p.laboratorio && labsNorm.has(norm(p.laboratorio)))
    }
    return result
  }

  const secciones = useMemo(() => {
    // Vista especial: favoritos
    if (categoriaActiva === "__favs__") {
      const favIds = favoritos
      const items = ordenar(filtrarProductos(productos.filter(p => favIds.has(p.id))))
      return items.length > 0 ? [{ cat: "Mis favoritos", items }] : []
    }
    const grupos: { cat: string; items: Producto[] }[] = []
    const catsAMostrar = categoriaActiva ? [categoriaActiva] : categorias
    for (const cat of catsAMostrar) {
      let base = productos.filter(p => p.categoria === cat)
      if (subcategoriaActiva) base = base.filter(p => p.subcategoria === subcategoriaActiva)
      const items = ordenar(filtrarProductos(base))
      if (items.length > 0) grupos.push({ cat, items })
    }
    if (!categoriaActiva) {
      const sinCat = ordenar(filtrarProductos(productos.filter(p => !p.categoria)))
      if (sinCat.length > 0) grupos.push({ cat: "Otros", items: sinCat })
    }
    return grupos
  }, [productos, categorias, categoriaActiva, subcategoriaActiva, busquedaDelay, precioMin, precioMax, laboratoriosFiltro, orden, favoritos])

  const totalFiltrados = secciones.reduce((s, g) => s + g.items.length, 0)
  const totalItems = carrito.reduce((s, i) => s + i.cantidad, 0)
  const tienePrecios = tipoCliente === "veterinario" || tipoCliente === "productor"
  const totalPrecio = carrito.reduce((s, i) => {
    const precio = precioConTipo(i.producto.precio_venta, tipoCliente) ?? i.producto.precio_venta
    return s + precio * i.cantidad
  }, 0)

  // Sincronizar carrito con localStorage
  useEffect(() => {
    localStorage.setItem("vetix_cart", JSON.stringify(carrito))
  }, [carrito])

  // Actualizar precios del carrito cuando cargan los productos y quitar los sin stock
  useEffect(() => {
    if (productos.length === 0) return
    setCarrito(prev => prev.reduce<ItemCarrito[]>((acc, item) => {
      const actual = productos.find(p => p.id === item.producto.id)
      if (!actual || actual.stock <= 0) return acc
      acc.push({ ...item, producto: actual })
      return acc
    }, []))
  }, [productos])

  // Escape para cerrar modales
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Atajo "/" → enfocar búsqueda (solo si no hay ningún input/modal activo)
      if (
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault()
        searchRef.current?.focus()
        return
      }
      if (e.key !== "Escape") return
      if (imagenZoom) { setImagenZoom(null); return }
      if (productoDetalle) { setProductoDetalle(null); return }
      if (pedidosOpen) { setPedidosOpen(false); return }
      if (catModalOpen) { setCatModalOpen(false); return }
      if (authModalOpen) { setAuthModalOpen(false); return }
      if (editPerfilOpen) { setEditPerfilOpen(false); return }
      if (sidebarOpen) { setSidebarOpen(false); return }
      if (carritoOpen) { setCarritoOpen(false); return }
      if (checkoutOpen) { setCheckoutOpen(false); return }
      if (labDropdownOpen) { setLabDropdownOpen(false); return }
      if (catDropdownOpen) { setCatDropdownOpen(false); return }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [imagenZoom, productoDetalle, pedidosOpen, catModalOpen, authModalOpen, editPerfilOpen, sidebarOpen, carritoOpen, checkoutOpen, labDropdownOpen, catDropdownOpen])

  // Reset subcategoría cuando cambia la categoría principal
  useEffect(() => { setSubcategoriaActiva("") }, [categoriaActiva])

  // Reset paginación cuando cambian los filtros
  useEffect(() => { setVisibles(48) }, [busquedaDelay, categoriaActiva, subcategoriaActiva, precioMin, precioMax, laboratoriosFiltro, orden])

  // Scroll infinito — cuando el sentinel entra en pantalla cargamos más
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) setVisibles(v => v + 48) },
      { rootMargin: "200px" }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [secciones])

  // Auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUsuario({ email: session.user.email!, id: session.user.id })
        loadPerfil(session.user.id)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUsuario({ email: session.user.email!, id: session.user.id })
        loadPerfil(session.user.id)
      } else {
        setUsuario(null)
        setPerfil(null)
        setTipoCliente(null)
      }
    })
    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounce: aplicar filtro 300 ms después de la última tecla
  useEffect(() => {
    if (!busqueda.trim()) { setBusquedaDelay(""); return }
    const t = setTimeout(() => setBusquedaDelay(busqueda), 300)
    return () => clearTimeout(t)
  }, [busqueda])

  // Pre-rellenar el checkout con datos del último pedido guardado
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("vetix_cliente") ?? "null")
      if (saved?.nombre || saved?.telefono) {
        setForm(f => ({
          ...f,
          nombre: saved.nombre || f.nombre,
          telefono: saved.telefono || f.telefono,
          email: saved.email || f.email,
        }))
      }
    } catch {}
  }, [])

  // Registrar producto visto recientemente
  useEffect(() => {
    if (!productoDetalle) return
    setRecientesIds(prev => {
      const next = [productoDetalle.id, ...prev.filter(id => id !== productoDetalle.id)].slice(0, 12)
      localStorage.setItem("vetix_recientes", JSON.stringify(next))
      return next
    })
  }, [productoDetalle])

  // Abrir un producto si la URL tiene ?producto=ID (solo al cargar por primera vez)
  useEffect(() => {
    if (urlProductoLeido.current || productos.length === 0) return
    urlProductoLeido.current = true
    const params = new URLSearchParams(window.location.search)
    const id = params.get("producto")
    if (!id) return
    const prod = productos.find(p => p.id === Number(id))
    if (prod) setProductoDetalle(prod)
  }, [productos])

  // Leer filtros de la URL al montar (una sola vez)
  const urlFiltrosLeidos = useRef(false)
  useEffect(() => {
    if (urlFiltrosLeidos.current) return
    urlFiltrosLeidos.current = true
    const p = new URLSearchParams(window.location.search)
    const q   = p.get("q")
    const cat = p.get("cat")
    const min = p.get("min")
    const max = p.get("max")
    const labs = p.get("labs")
    if (q)   { setBusqueda(q); setBusquedaDelay(q) }
    if (cat) { setCategoriaActiva(cat) }
    if (min) { setPrecioMin(min) }
    if (max) { setPrecioMax(max) }
    if (labs) {
      const lista = labs.split(",").map(s => s.trim()).filter(Boolean)
      if (lista.length) setLaboratoriosFiltro(new Set(lista))
    }
    if (q || cat || min || max || labs) setModoCatalogo(true)
  }, [])

  // Escribir filtros en la URL cuando cambian
  useEffect(() => {
    if (!urlFiltrosLeidos.current) return
    const p = new URLSearchParams()
    if (busquedaDelay.trim()) p.set("q", busquedaDelay.trim())
    if (categoriaActiva && categoriaActiva !== "__favs__") p.set("cat", categoriaActiva)
    if (precioMin) p.set("min", precioMin)
    if (precioMax) p.set("max", precioMax)
    if (laboratoriosFiltro.size > 0) p.set("labs", [...laboratoriosFiltro].join(","))
    const qs = p.toString()
    const nueva = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    window.history.replaceState(null, "", nueva)
  }, [busquedaDelay, categoriaActiva, precioMin, precioMax, laboratoriosFiltro])

  function irACategoria(cat: string) {
    setCategoriaActiva(cat)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function irAInicio() {
    setModoCatalogo(false)
    setCategoriaActiva("")
    setBusqueda("")
    setBusquedaDelay("")
    setPrecioMin("")
    setPrecioMax("")
    setLaboratoriosFiltro(new Set())
    setSidebarOpen(false)
    setCatModalOpen(false)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function verCatalogo(cat = "") {
    setModoCatalogo(true)
    setCategoriaActiva(cat)
    setBusqueda("")
    setBusquedaDelay("")
    setPrecioMin("")
    setPrecioMax("")
    setLaboratoriosFiltro(new Set())
    setSidebarOpen(false)
    setCatModalOpen(false)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function guardarBusquedaReciente(q: string) {
    if (!q.trim() || q.trim().length < 2) return
    setBusquedasRecientes(prev => {
      const next = [q.trim(), ...prev.filter(r => r.toLowerCase() !== q.trim().toLowerCase())].slice(0, 5)
      localStorage.setItem("vetix_recent", JSON.stringify(next))
      return next
    })
  }

  function agregarTodosFavs() {
    let count = 0
    for (const p of favoritosProductos) {
      if (!carrito.find(i => i.producto.id === p.id)) { agregar(p); count++ }
    }
    mostrarToast(count > 0
      ? `${count} favorito${count !== 1 ? "s" : ""} agregado${count !== 1 ? "s" : ""} al carrito`
      : "Ya están todos en el carrito")
  }

  function cerrarBanner() {
    setBannerCerrado(true)
    localStorage.setItem(BANNER_VERSION, "1")
  }

  function copiarLink(id: number) {
    const url = `${window.location.origin}/producto/${id}`
    navigator.clipboard.writeText(url)
      .then(() => mostrarToast("¡Link copiado al portapapeles!"))
      .catch(() => mostrarToast("Link copiado"))
  }

  function toggleFavorito(id: number) {
    setFavoritos(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      localStorage.setItem("vetix_favs", JSON.stringify([...next]))
      return next
    })
  }

  function exportarCSV() {
    const encabezado = ["Nombre", "Categoría", "Laboratorio", "Precio"].join(";")
    const filas = productos.map(p =>
      [
        `"${(p.nombre ?? "").replace(/"/g, '""')}"`,
        `"${(p.categoria ?? "").replace(/"/g, '""')}"`,
        `"${(p.laboratorio ?? "").replace(/"/g, '""')}"`,
        String(p.precio_venta).replace(".", ","),
      ].join(";")
    )
    const csv = "﻿" + [encabezado, ...filas].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `lista-precios-vetix-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  async function cargarMisPedidos() {
    if (!usuario) return
    setCargandoPedidos(true)
    // Busca por usuario_id (pedidos nuevos) O por email (pedidos anteriores al login)
    const { data } = await supabase
      .from("pedidos")
      .select("id, created_at, estado, total, pedido_items(producto_id, nombre_producto, cantidad, precio_unitario)")
      .or(`usuario_id.eq.${usuario.id},cliente_email.eq.${usuario.email}`)
      .order("created_at", { ascending: false })
      .limit(20)
    setCargandoPedidos(false)
    setMisPedidos((data as PedidoHistorial[]) ?? [])
  }

  async function recuperarContrasena() {
    if (!loginEmail.trim()) { setLoginError("Ingresá tu email para recuperar la contraseña"); return }
    setLoginCargando(true); setLoginError("")
    const { error } = await supabase.auth.resetPasswordForEmail(loginEmail.trim(), {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/reset-password`,
    })
    setLoginCargando(false)
    if (error) setLoginError("No se pudo enviar el email. Verificá que sea correcto.")
    else { mostrarToast("📧 Email de recuperación enviado — revisá tu casilla"); setAuthModalOpen(false) }
  }

  async function loadPerfil(userId: string) {
    const { data } = await supabase
      .from("tienda_perfiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()
    if (!data) return
    const p = data as PerfilUsuario

    // Re-verificar tipo_cliente contra clientes (el admin puede haberlo asignado
    // después del registro, o cambiado). Siempre gana el valor de clientes.
    const { data: clienteRow } = await supabase
      .from("clientes")
      .select("tipo_cliente")
      .eq("email_tienda", p.email.toLowerCase())
      .maybeSingle()

    const TIPOS_VALIDOS: TipoCliente[] = ["veterinario", "productor", "pendiente"]
    const tipoDeClientes: TipoCliente | null = clienteRow?.tipo_cliente && TIPOS_VALIDOS.includes(clienteRow.tipo_cliente)
      ? clienteRow.tipo_cliente as TipoCliente
      : null
    const tipoFinal: TipoCliente = tipoDeClientes ?? (TIPOS_VALIDOS.includes(p.tipo_cliente) ? p.tipo_cliente : "pendiente")

    // Si cambió, actualizar tienda_perfiles para la próxima vez
    if (tipoFinal !== p.tipo_cliente) {
      await supabase.from("tienda_perfiles").update({ tipo_cliente: tipoFinal }).eq("id", userId)
      p.tipo_cliente = tipoFinal
    }

    setPerfil(p)
    setTipoCliente(tipoFinal)
    // Pre-rellenar checkout con datos del perfil
    setForm(f => ({
      ...f,
      nombre: `${p.nombre} ${p.apellido}`.trim() || f.nombre,
      telefono: p.telefono || f.telefono,
      email: p.email || f.email,
      direccion: p.direccion || f.direccion,
    }))
  }

  async function iniciarSesion() {
    if (!loginEmail.trim() || !loginPass.trim()) { setLoginError("Completá todos los campos"); return }
    setLoginCargando(true); setLoginError("")
    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail.trim(), password: loginPass })
    setLoginCargando(false)
    if (error) { setLoginError("Email o contraseña incorrectos"); return }
    if (data.user) await loadPerfil(data.user.id)
    setLoginEmail(""); setLoginPass("")
    setAuthModalOpen(false)
    mostrarToast("¡Sesión iniciada!")
  }

  async function registrar() {
    if (!loginEmail.trim() || !loginPass.trim() || !regNombre.trim() || !regApellido.trim() || !regTelefono.trim()) {
      setLoginError("Completá los campos obligatorios (*)"); return
    }
    setLoginCargando(true); setLoginError("")

    // 1. Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: loginEmail.trim(),
      password: loginPass,
    })
    if (authError || !authData.user) {
      setLoginCargando(false)
      setLoginError(authError?.message ?? "Error al registrarse")
      return
    }

    // 2. Buscar tipo_cliente en la tabla clientes (controlado por el admin)
    const { data: clienteData } = await supabase
      .from("clientes")
      .select("tipo_cliente")
      .eq("email_tienda", loginEmail.trim().toLowerCase())
      .maybeSingle()
    const tipoRaw = clienteData?.tipo_cliente ?? "pendiente"
    const tipo: TipoCliente = (["veterinario", "productor", "pendiente"] as TipoCliente[]).includes(tipoRaw)
      ? tipoRaw as TipoCliente : "pendiente"

    // 3. Insertar perfil
    await supabase.from("tienda_perfiles").upsert({
      id: authData.user.id,
      nombre: regNombre.trim(),
      apellido: regApellido.trim(),
      email: loginEmail.trim(),
      telefono: regTelefono.trim(),
      direccion: regDireccion.trim() || null,
      tipo_cliente: tipo,
    })

    setLoginCargando(false)
    // Limpiar campos
    setRegNombre(""); setRegApellido(""); setRegTelefono(""); setRegDireccion("")
    setLoginEmail(""); setLoginPass("")
    setAuthModalOpen(false)
    mostrarToast("¡Cuenta creada! Si pedimos confirmar tu email, revisá tu casilla.")
  }

  async function cerrarSesion() {
    await supabase.auth.signOut()
    setUsuario(null)
    setPerfil(null)
    setTipoCliente(null)
    setSidebarOpen(false)
  }

  function abrirEditarPerfil() {
    setEditNombre(perfil?.nombre ?? "")
    setEditApellido(perfil?.apellido ?? "")
    setEditTelefono(perfil?.telefono ?? "")
    setEditDireccion(perfil?.direccion ?? "")
    setEditError("")
    setEditPerfilOpen(true)
  }

  async function guardarPerfil() {
    if (!usuario) return
    if (!editNombre.trim() || !editApellido.trim() || !editTelefono.trim()) {
      setEditError("Nombre, apellido y teléfono son obligatorios"); return
    }
    setEditGuardando(true); setEditError("")
    const { error } = await supabase.from("tienda_perfiles").upsert({
      id: usuario.id,
      email: usuario.email ?? "",
      nombre: editNombre.trim(),
      apellido: editApellido.trim(),
      telefono: editTelefono.trim(),
      direccion: editDireccion.trim() || null,
      tipo_cliente: perfil?.tipo_cliente ?? "pendiente",
    }, { onConflict: "id" })
    setEditGuardando(false)
    if (error) { setEditError("Error al guardar. Intentá de nuevo."); return }
    // Actualizar estado local
    setPerfil(p => p ? { ...p, nombre: editNombre.trim(), apellido: editApellido.trim(), telefono: editTelefono.trim(), direccion: editDireccion.trim() } : p)
    setForm(f => ({
      ...f,
      nombre: `${editNombre.trim()} ${editApellido.trim()}`.trim(),
      telefono: editTelefono.trim(),
      direccion: editDireccion.trim(),
    }))
    setEditPerfilOpen(false)
    mostrarToast("Perfil actualizado correctamente")
  }

  function mostrarToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2400)
  }

  const agregar = useCallback((p: Producto) => {
    setCarrito(prev => {
      const idx = prev.findIndex(i => i.producto.id === p.id)
      if (idx >= 0) {
        const n = [...prev]; n[idx] = { ...n[idx], cantidad: n[idx].cantidad + 1 }; return n
      }
      return [...prev, { producto: p, cantidad: 1 }]
    })
    setCartAnimando(true)
    mostrarToast("Producto agregado al carrito")
  }, [])

  const cambiar = useCallback((id: number, delta: number) => {
    setCarrito(prev => prev.reduce<ItemCarrito[]>((acc, i) => {
      if (i.producto.id !== id) { acc.push(i); return acc }
      const c = i.cantidad + delta
      if (c > 0) acc.push({ ...i, cantidad: c })
      return acc
    }, []))
  }, [])

  const quitar = useCallback((id: number) => setCarrito(prev => prev.filter(i => i.producto.id !== id)), [])

  const setNota = useCallback((id: number, nota: string) => {
    setCarrito(prev => prev.map(i => i.producto.id === id ? { ...i, nota: nota.trim() || undefined } : i))
  }, [])

  function setField(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }))
    if (errForm[k]) setErrForm(e => ({ ...e, [k]: "" }))
  }

  async function enviar() {
    const e: Record<string, string> = {}
    if (!form.nombre.trim()) e.nombre = "Campo requerido"
    if (!form.telefono.trim()) e.telefono = "Campo requerido"
    if (Object.keys(e).length) { setErrForm(e); return }
    setErrForm({}); setErrPedido(""); setEnviando(true)

    const notasItems = carrito.filter(i => i.nota).map(i => `• ${i.producto.nombre}: ${i.nota}`).join("\n")
    const notasFinal = [form.notas.trim(), notasItems ? `Notas por producto:\n${notasItems}` : ""].filter(Boolean).join("\n\n") || null

    const { data: pedido, error } = await supabase
      .from("pedidos")
      .insert({
        cliente_nombre: form.nombre.trim(),
        cliente_email: form.email.trim() || usuario?.email || null,
        cliente_telefono: form.telefono.trim(),
        cliente_direccion: form.direccion.trim() || null,
        notas: notasFinal,
        total: totalPrecio,
        estado: "pendiente",
        usuario_id: usuario?.id ?? null,
      })
      .select().single()

    if (error || !pedido) {
      console.error("Error al insertar pedido:", error)
      setEnviando(false)
      setErrPedido("Error al enviar el pedido: " + (error?.message ?? "sin respuesta del servidor"))
      return
    }

    const { error: errItems } = await supabase.from("pedido_items").insert(
      carrito.map(i => {
        const pu = precioConTipo(i.producto.precio_venta, tipoCliente) ?? i.producto.precio_venta
        return {
          pedido_id: pedido.id, producto_id: i.producto.id,
          nombre_producto: i.producto.nombre, precio_unitario: pu,
          cantidad: i.cantidad, subtotal: pu * i.cantidad,
        }
      })
    )
    if (errItems) {
      console.error("Error al insertar pedido_items:", errItems)
      setEnviando(false)
      setErrPedido("Error al guardar los productos del pedido: " + errItems.message)
      return
    }

    const total = totalPrecio
    setEnviando(false); setNumeroPedido(pedido.id); setPrecioFinal(total)
    setPedidoCarrito(carrito); setPedidoOk(true); setCarrito([])
    // Guardar datos del cliente para pre-rellenar la próxima vez
    localStorage.setItem("vetix_cliente", JSON.stringify({
      nombre: form.nombre.trim(),
      telefono: form.telefono.trim(),
      email: form.email.trim(),
    }))
    // Resetear solo notas; mantener datos del perfil para la próxima compra
    setForm({
      nombre: perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : "",
      telefono: perfil?.telefono ?? "",
      email: perfil?.email ?? usuario?.email ?? "",
      direccion: perfil?.direccion ?? "",
      notas: "",
    })
  }

  function waLink() {
    if (!WHATSAPP || !numeroPedido) return "#"
    const lineas = pedidoCarrito.length > 0
      ? pedidoCarrito.map(i => `• ${i.producto.nombre} x${i.cantidad} — ${fmt(i.producto.precio_venta * i.cantidad)}`).join("\n")
      : ""
    const msg = [
      `Hola! Acabo de hacer el pedido N°${String(numeroPedido).padStart(4, "0")} en la tienda online.`,
      lineas,
      `*Total estimado: ${fmt(precioFinal)}*`,
      `Quedo a la espera de la confirmación.`,
    ].filter(Boolean).join("\n\n")
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`
  }

  function textoCarritoWA() {
    const lineas = carrito.map(i => {
      const precio = precioConTipo(i.producto.precio_venta, tipoCliente) ?? i.producto.precio_venta
      let linea = `• ${i.producto.nombre} x${i.cantidad} — ${fmt(precio * i.cantidad)}`
      if (i.nota) linea += ` _(${i.nota})_`
      return linea
    }).join("\n")
    return `Hola! Me gustaría consultar precios para el siguiente pedido:\n\n${lineas}\n\n*Total estimado: ${fmt(totalPrecio)}*\n\nQuedo a la espera de confirmación.`
  }

  function repetirPedido(pedido: PedidoHistorial) {
    let agregados = 0
    for (const item of pedido.pedido_items ?? []) {
      const prod = productos.find(p =>
        (item.producto_id != null && p.id === item.producto_id) ||
        p.nombre === item.nombre_producto
      )
      if (!prod || prod.stock <= 0) continue
      agregar(prod)
      if (item.cantidad > 1) cambiar(prod.id, item.cantidad - 1)
      agregados++
    }
    if (agregados > 0) {
      mostrarToast(`${agregados} producto${agregados !== 1 ? "s" : ""} agregado${agregados !== 1 ? "s" : ""} al carrito`)
      setPedidosOpen(false)
      setTimeout(() => setCarritoOpen(true), 200)
    } else {
      mostrarToast("No hay productos disponibles del pedido anterior")
    }
  }

  function imprimirCarrito() {
    const fecha = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })
    const lineas = carrito.map(i => {
      const pu = precioConTipo(i.producto.precio_venta, tipoCliente) ?? i.producto.precio_venta
      return `
      <tr>
        <td style="padding:9px 12px;border-bottom:1px solid #eee;font-size:13px">${i.producto.nombre}${i.producto.laboratorio ? `<br><span style="font-size:11px;color:#b05070;font-weight:600">${i.producto.laboratorio}</span>` : ""}${i.nota ? `<br><span style="font-size:11px;color:#64748b;font-style:italic">${i.nota}</span>` : ""}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #eee;text-align:center;font-size:13px">${i.cantidad}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #eee;text-align:right;font-size:13px">${fmt(pu)}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #eee;text-align:right;font-size:13px;font-weight:700;color:#d4688e">${fmt(pu * i.cantidad)}</td>
      </tr>`
    }).join("")
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Pedido VETIX — ${fecha}</title>
<style>
  *{box-sizing:border-box}body{font-family:system-ui,sans-serif;margin:0;padding:32px;color:#111;max-width:800px;margin:0 auto;padding:32px}
  .top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #d4688e;padding-bottom:14px;margin-bottom:24px}
  h1{margin:0;font-size:22px;font-weight:900;color:#1a2035}p.sub{margin:4px 0 0;font-size:12px;color:#64748b}
  .date{font-size:13px;color:#64748b;text-align:right}
  table{width:100%;border-collapse:collapse}
  th{background:#0f172a;color:white;padding:9px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
  th:nth-child(2){text-align:center}th:nth-child(3),th:nth-child(4){text-align:right}
  tfoot td{padding:12px;font-size:15px;font-weight:900;border-top:2px solid #1a2035}
  .footer{margin-top:28px;font-size:11px;color:#94a3b8;text-align:center;border-top:1px solid #eee;padding-top:14px}
  @media print{body{padding:16px}.no-print{display:none}}
</style></head><body>
<div class="top">
  <div><h1>VETIX Distribuidora</h1><p class="sub">Lista de pedido — precios de referencia</p>${perfil ? `<p class="sub" style="margin-top:2px;color:#1a2035;font-weight:700">${perfil.nombre} ${perfil.apellido}</p>` : ""}</div>
  <div class="date">${fecha}</div>
</div>
<table>
  <thead><tr><th>Producto</th><th>Cant.</th><th>Precio unit.</th><th>Subtotal</th></tr></thead>
  <tbody>${lineas}</tbody>
  <tfoot><tr>
    <td colspan="3" style="text-align:right;color:#64748b;font-weight:600;font-size:13px">Total estimado</td>
    <td style="color:#d4688e;text-align:right">${fmt(totalPrecio)}</td>
  </tr></tfoot>
</table>
<div class="footer">Precios de referencia — sujetos a confirmación al coordinar. VETIX Distribuidora Veterinaria.</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`
    const win = window.open("", "_blank", "width=900,height=700")
    if (win) { win.document.write(html); win.document.close() }
  }

  // ── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: vistaHome ? "#c8c8c8" : "#1a2035" }}>

      {/* ── BANNER DE ANUNCIO ──────────────────────────────────────────────── */}
      {BANNER_TEXTO && !bannerCerrado && (
        <div style={{
          background: "linear-gradient(90deg, #b05070, #d4688e, #b05070)",
          backgroundSize: "200% auto",
          color: "white",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1.4,
        }}>
          <span style={{ flex: 1, textAlign: "center" }}>{BANNER_TEXTO}</span>
          <button onClick={cerrarBanner}
            title="Cerrar"
            style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 26, height: 26, cursor: "pointer", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0, lineHeight: 1 }}>
            ×
          </button>
        </div>
      )}

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header style={{
        background: "white",
        position: "sticky", top: 0, zIndex: 40,
        borderBottom: "1px solid #e8edf5",
        boxShadow: "0 2px 12px rgba(15,23,42,0.07)",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 20px", height: 78, display: "flex", alignItems: "center", gap: 20 }}>

          {/* Hamburger */}
          <button onClick={() => setSidebarOpen(true)}
            style={{ width: 38, height: 38, borderRadius: 9, background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#374151", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, flexShrink: 0, padding: 0, transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#e2e8f0")}
            onMouseLeave={e => (e.currentTarget.style.background = "#f1f5f9")}>
            <span style={{ display: "block", width: 16, height: 2, background: "currentColor", borderRadius: 2 }}/>
            <span style={{ display: "block", width: 16, height: 2, background: "currentColor", borderRadius: 2 }}/>
            <span style={{ display: "block", width: 16, height: 2, background: "currentColor", borderRadius: 2 }}/>
          </button>

          {/* Logo — PNG fondo blanco se funde con el header blanco */}
          <LogoMarca height={70} />

          {/* Search desktop */}
          <div className="header-search" style={{ flex: 1, maxWidth: 500, position: "relative" }}>
            <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none", zIndex: 1 }}><IcoSearch /></span>
            <input
              ref={searchRef}
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar productos, laboratorios... ( / )"
              style={{ width: "100%", paddingLeft: 38, paddingRight: busqueda ? 34 : 14, height: 40, borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none", background: "#f3f1ee", color: "#1a2035", boxSizing: "border-box", transition: "border-color 0.15s, background 0.15s" }}
              onFocus={e => { e.target.style.borderColor = "#d4688e"; e.target.style.background = "white"; setSearchFocus(true) }}
              onBlur={e => { e.target.style.borderColor = "#e2e8f0"; e.target.style.background = "#f3f1ee"; setTimeout(() => setSearchFocus(false), 180) }}
              onKeyDown={e => { if (e.key === "Enter" && busqueda.trim()) guardarBusquedaReciente(busqueda) }}
            />
            {busqueda && (
              <button onClick={() => setBusqueda("")} style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 14, padding: 3, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>✕</button>
            )}
            {/* Dropdown búsquedas recientes */}
            {searchFocus && !busqueda && busquedasRecientes.length > 0 && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#e8e8e8", border: "1.5px solid #e2e8f0", borderRadius: 11, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", zIndex: 100, overflow: "hidden" }}>
                <div style={{ padding: "8px 12px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>Búsquedas recientes</span>
                  <button onClick={() => { setBusquedasRecientes([]); localStorage.removeItem("vetix_recent") }}
                    style={{ background: "none", border: "none", fontSize: 10, color: "#94a3b8", cursor: "pointer", fontWeight: 700 }}>Limpiar</button>
                </div>
                {busquedasRecientes.map(rec => (
                  <button key={rec} onClick={() => { setBusqueda(rec); guardarBusquedaReciente(rec); setSearchFocus(false) }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "8px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#374151", textAlign: "left", transition: "background 0.1s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#e2e2e2")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>↩</span>
                    {rec}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ flex: 1 }} />

{/* Login / Usuario */}
          {usuario ? (
            <button onClick={() => setSidebarOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 10, background: "#e2e2e2", border: "1px solid #e2e8f0", color: "#1a2035", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.borderColor = "#c7d2e0" }}
              onMouseLeave={e => { e.currentTarget.style.background = "#e2e2e2"; e.currentTarget.style.borderColor = "#e2e8f0" }}>
              <span style={{ width: 24, height: 24, borderRadius: "50%", background: "linear-gradient(135deg,#d4688e,#b05070)", color: "white", fontWeight: 900, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {(perfil ? perfil.nombre : usuario.email)[0].toUpperCase()}
              </span>
              <span className="wa-text">{perfil ? perfil.nombre : usuario.email.split("@")[0]}</span>
            </button>
          ) : (
            <button onClick={() => { setLoginModo("login"); setLoginError(""); setAuthModalOpen(true) }}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: "#e2e2e2", border: "1px solid #e2e8f0", color: "#1a2035", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.borderColor = "#c7d2e0" }}
              onMouseLeave={e => { e.currentTarget.style.background = "#e2e2e2"; e.currentTarget.style.borderColor = "#e2e8f0" }}>
              <svg width="15" height="15" fill="none" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
              <span className="wa-text">Iniciar sesión</span>
            </button>
          )}

          {/* Cart */}
          <button
            onClick={() => setCarritoOpen(true)}
            className={cartAnimando ? "cart-pop" : ""}
            onAnimationEnd={() => setCartAnimando(false)}
            onMouseEnter={e => { e.currentTarget.style.background = "#b05070"; e.currentTarget.style.transform = "scale(1.05)" }}
            onMouseLeave={e => { e.currentTarget.style.background = "#d4688e"; e.currentTarget.style.transform = "scale(1)" }}
            style={{
              display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
              background: "#d4688e",
              color: "white",
              border: "none", borderRadius: 10, padding: "9px 16px", cursor: "pointer",
              fontSize: 13, fontWeight: 800,
              boxShadow: totalItems > 0 ? "0 4px 16px rgba(212,104,142,0.45)" : "0 2px 8px rgba(212,104,142,0.25)",
              transition: "background 0.2s, box-shadow 0.2s, transform 0.12s",
            }}>
            <IcoCart size={17} />
            <span className="cart-text">Carrito</span>
            {totalItems > 0 && (
              <span style={{ background: "rgba(255,255,255,0.25)", borderRadius: 20, padding: "1px 9px", fontSize: 11, fontWeight: 900 }}>
                {totalItems}
              </span>
            )}
          </button>
        </div>

        {/* Search mobile */}
        <div className="header-search-mobile" style={{ display: "none", padding: "0 16px 12px" }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }}><IcoSearch /></span>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar productos..."
              style={{ width: "100%", paddingLeft: 34, paddingRight: 14, height: 38, borderRadius: 9, border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none", background: "#f0f4fb", color: "#1a2035", boxSizing: "border-box" }}
              onFocus={e => { e.target.style.borderColor = "#d4688e"; e.target.style.background = "white" }}
              onBlur={e => { e.target.style.borderColor = "#e2e8f0"; e.target.style.background = "#f0f4fb" }} />
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════
           HOME — carousel + laboratorios + destacados
      ══════════════════════════════════════════════════════════════════ */}
      {vistaHome && (
        <div>

          {/* ── HERO ─────────────────────────────────────────────────── */}
          <div style={{ background: "#1a2035" }}>
            {/* Barra de stats */}
            <div style={{ background: "linear-gradient(90deg, #b05070, #d4688e, #c97b9e, #b05070)", backgroundSize: "200% 100%", padding: "9px 24px", display: "flex", justifyContent: "center", gap: 36, flexWrap: "wrap" }}>
              {[
                { n: `+${productos.length}`, label: "productos" },
                { n: `+${laboratorios.length}`, label: "laboratorios" },
                { n: categorias.length.toString(), label: "categorías" },
                { n: "24 hs", label: "atención online" },
              ].map(st => (
                <div key={st.label} style={{ display: "flex", alignItems: "center", gap: 6, color: "white", fontSize: 12, fontWeight: 600 }}>
                  <strong style={{ fontSize: 15, fontWeight: 900 }}>{st.n}</strong>{st.label}
                </div>
              ))}
            </div>
            {/* Cuerpo del hero */}
            <div style={{ padding: "52px 24px 56px", textAlign: "center", maxWidth: 680, margin: "0 auto" }}>
              <h1 style={{ margin: "0 0 10px", fontSize: "clamp(26px, 4vw, 44px)", fontWeight: 900, color: "white", lineHeight: 1.2 }}>
                Tu distribuidora veterinaria <span style={{ color: "#f0c8d8" }}>online</span>
              </h1>
              {/* Buscador hero */}
              <div style={{ position: "relative", maxWidth: 520, margin: "0 auto 26px" }}>
                <input
                  value={heroQuery}
                  onChange={e => setHeroQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      const q = heroQuery.trim()
                      if (q) { guardarBusquedaReciente(q); setBusqueda(q); setBusquedaDelay(q) }
                      setModoCatalogo(true)
                      window.scrollTo({ top: 0, behavior: "smooth" })
                    }
                  }}
                  placeholder="Buscá antibióticos, vacunas, alimentos..."
                  style={{ width: "100%", padding: "15px 140px 15px 20px", borderRadius: 13, border: "1.5px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.07)", color: "white", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                />
                <button
                  onClick={() => {
                    const q = heroQuery.trim()
                    if (q) { guardarBusquedaReciente(q); setBusqueda(q); setBusquedaDelay(q) }
                    setModoCatalogo(true)
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }}
                  style={{ position: "absolute", right: 6, top: 6, bottom: 6, background: "#d4688e", color: "white", border: "none", borderRadius: 9, padding: "0 20px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                  Buscar
                </button>
              </div>
            </div>
          </div>

          {/* ── VENTAJAS ───────────────────────────────────────────────────── */}
          <div style={{ background: "linear-gradient(90deg, #b05070, #d4688e, #c97b9e, #b05070)", backgroundSize: "200% 100%", padding: "9px 24px", display: "flex", justifyContent: "center", gap: 36, flexWrap: "wrap" }}>
            {[
              { texto: "✓ Precios al por mayor" },
              { texto: "✓ Envíos coordinados" },
              { texto: "✓ Catálogo actualizado" },
              { texto: "✓ Atención personalizada" },
            ].map(v => (
              <span key={v.texto} style={{ fontSize: 12, color: "white", fontWeight: 700, whiteSpace: "nowrap" }}>{v.texto}</span>
            ))}
          </div>


          {/* ── RECIENTEMENTE VISTOS ──────────────────────────────────────── */}
          {recientesProductos.length > 0 && (
            <div style={{ background: "#e8e8e8", padding: "28px 0 32px", borderBottom: "1px solid #eaecf2" }}>
              <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 20px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h2 style={{ margin: "0 0 3px", fontSize: 18, fontWeight: 900, color: "#1a2035" }}>Vistos recientemente</h2>
                  <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Continuá desde donde dejaste</p>
                </div>
                <button
                  onClick={() => { setRecientesIds([]); localStorage.removeItem("vetix_recientes") }}
                  style={{ background: "none", border: "none", fontSize: 12, color: "#94a3b8", cursor: "pointer", fontWeight: 600 }}>
                  Borrar historial
                </button>
              </div>
              <div style={{ overflowX: "auto", paddingLeft: 20 }}>
                <div style={{ display: "flex", gap: 14, paddingRight: 20, paddingBottom: 4 }}>
                  {recientesProductos.map(p => (
                    <div key={p.id} style={{ width: 200, flexShrink: 0 }}>
                      <TarjetaProducto p={p}
                        enCarrito={carrito.find(i => i.producto.id === p.id)?.cantidad ?? 0}
                        onAgregar={() => agregar(p)}
                        onCambiar={d => cambiar(p.id, d)}
                        onDetalle={() => setProductoDetalle(p)}
                        esFav={favoritos.has(p.id)}
                        onToggleFav={() => toggleFavorito(p.id)}
                        tipoCliente={tipoCliente}
                        onVerPrecio={() => { setLoginModo("login"); setLoginError(""); setAuthModalOpen(true) }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── MIS FAVORITOS ─────────────────────────────────────────────── */}
          {favoritosProductos.length > 0 && (
            <div style={{ background: "#fff8fb", padding: "28px 0 32px", borderBottom: "1px solid #fdf0f5" }}>
              <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 20px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h2 style={{ margin: "0 0 3px", fontSize: 18, fontWeight: 900, color: "#1a2035" }}>
                    <span style={{ color: "#d4688e" }}>♥</span> Mis favoritos
                  </h2>
                  <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                    {favoritos.size} producto{favoritos.size !== 1 ? "s" : ""} guardado{favoritos.size !== 1 ? "s" : ""}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={agregarTodosFavs}
                    style={{ padding: "8px 16px", borderRadius: 9, background: "#d4688e", border: "none", color: "white", fontSize: 12, fontWeight: 800, cursor: "pointer", boxShadow: "0 3px 10px rgba(212,104,142,0.3)" }}>
                    + Agregar todos al carrito
                  </button>
                  <button onClick={() => { setModoCatalogo(true); setBusqueda(""); setBusquedaDelay(""); setCategoriaActiva("__favs__") }}
                    style={{ padding: "8px 14px", borderRadius: 9, background: "#e8e8e8", border: "1.5px solid #f0c8d8", color: "#d4688e", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Ver todos →
                  </button>
                </div>
              </div>
              <div style={{ overflowX: "auto", paddingLeft: 20 }}>
                <div style={{ display: "flex", gap: 14, paddingRight: 20, paddingBottom: 4 }}>
                  {favoritosProductos.map(p => (
                    <div key={p.id} style={{ width: 200, flexShrink: 0 }}>
                      <TarjetaProducto p={p}
                        enCarrito={carrito.find(i => i.producto.id === p.id)?.cantidad ?? 0}
                        onAgregar={() => agregar(p)}
                        onCambiar={d => cambiar(p.id, d)}
                        onDetalle={() => setProductoDetalle(p)}
                        esFav={true}
                        onToggleFav={() => toggleFavorito(p.id)}
                        tipoCliente={tipoCliente}
                        onVerPrecio={() => { setLoginModo("login"); setLoginError(""); setAuthModalOpen(true) }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}


          {/* ── CÓMO FUNCIONA ─────────────────────────────────────────────── */}
          <div style={{ background: "#0f172a", padding: "44px 20px" }}>
            <div style={{ maxWidth: 1280, margin: "0 auto" }}>
              <div style={{ textAlign: "center", marginBottom: 32 }}>
                <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 900, color: "white" }}>¿Cómo hacer un pedido?</h2>
                <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Simple, rápido y sin complicaciones</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
                {[
                  { n: "1", titulo: "Explorás el catálogo", desc: "Navegá por categorías, buscá por nombre o laboratorio y agregá los productos al carrito." },
                  { n: "2", titulo: "Confirmás el pedido", desc: "Completás tu nombre y teléfono. Sin registro obligatorio. El pedido llega al instante." },
                  { n: "3", titulo: "Te contactamos", desc: "Nos comunicamos para coordinar precio final, forma de pago y entrega o retiro." },
                ].map(step => (
                  <div key={step.n} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "26px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#d4688e", color: "white", fontWeight: 900, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {step.n}
                    </div>
                    <div>
                      <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 800, color: "white" }}>{step.titulo}</p>
                      <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.65 }}>{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── CATEGORÍAS ────────────────────────────────────────────────── */}
          {categorias.length > 0 && (
            <div style={{ background: "#1a2035", padding: "32px 20px" }}>
              <div style={{ maxWidth: 1280, margin: "0 auto" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <h2 style={{ margin: "0 0 4px", fontSize: 19, fontWeight: 900, color: "white" }}>Categorías</h2>
                    <p style={{ margin: 0, fontSize: 13, color: "#94b8d8" }}>{categorias.length} categorías disponibles</p>
                  </div>
                  <button onClick={() => setCatModalOpen(true)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 11, background: "#d4688e", color: "white", border: "none", fontSize: 13, fontWeight: 800, cursor: "pointer", transition: "background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#b05070")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#d4688e")}>
                    Ver todas las categorías →
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
                  {categorias.slice(0, 8).map(cat => {
                    const est = CAT_ESTILO[cat] ?? CAT_DEFAULT
                    return (
                      <button key={cat} onClick={() => verCatalogo(cat)}
                        style={{ background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.12)", borderRadius: 11, padding: "14px 16px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12, transition: "all 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "#d4688e"; e.currentTarget.style.background = "rgba(212,104,142,0.18)" }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.background = "rgba(255,255,255,0.07)" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "white", lineHeight: 1.3 }}>{cat}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── PRODUCTOS DESTACADOS ───────────────────────────────────────── */}
          <div style={{ background: "#1a2035", padding: "32px 20px 40px" }}>
            <div style={{ maxWidth: 1280, margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: "white" }}>Productos destacados</h2>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94b8d8" }}>Una selección de nuestros productos</p>
                </div>
                <button onClick={() => verCatalogo("")}
                  style={{ padding: "9px 20px", borderRadius: 10, background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.15)", fontSize: 13, fontWeight: 700, color: "white", cursor: "pointer" }}>
                  Ver todos →
                </button>
              </div>
              <div className="grid-productos" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                {productosDestacados.map(p => (
                  <TarjetaProducto key={p.id} p={p}
                    enCarrito={carrito.find(i => i.producto.id === p.id)?.cantidad ?? 0}
                    onAgregar={() => agregar(p)}
                    onCambiar={d => cambiar(p.id, d)}
                    onDetalle={() => setProductoDetalle(p)}
                    esFav={favoritos.has(p.id)} onToggleFav={() => toggleFavorito(p.id)}
                    tipoCliente={tipoCliente}
                    onVerPrecio={() => { setLoginModo("login"); setLoginError(""); setAuthModalOpen(true) }}
                  />
                ))}
              </div>
              <div style={{ textAlign: "center", marginTop: 30 }}>
                <button onClick={() => verCatalogo("")}
                  style={{ background: "#d4688e", color: "white", border: "none", borderRadius: 13, padding: "14px 36px", fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 18px rgba(212,104,142,0.4)" }}>
                  Ver catálogo completo ({productos.length.toLocaleString("es-AR")} productos) →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
           CATÁLOGO — category tabs + grilla completa
      ══════════════════════════════════════════════════════════════════ */}

      {/* Loader (solo mientras carga) */}
      {cargando && (
        <main style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 20px 80px" }}>
          <div className="skeleton" style={{ height: 24, width: 180, borderRadius: 8, marginBottom: 20 }} />
          <div className="grid-productos" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </main>
      )}

      {/* ── ERROR DE CARGA ────────────────────────────────────────────────── */}
      {!cargando && errorCarga && (
        <div style={{ textAlign: "center", padding: "80px 20px" }}>
          <div style={{ fontSize: 52, marginBottom: 18 }}>📡</div>
          <p style={{ fontSize: 18, fontWeight: 900, color: "#1a2035", margin: "0 0 8px" }}>No se pudo cargar el catálogo</p>
          <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 28px", lineHeight: 1.6 }}>
            Verificá tu conexión a internet<br/>e intentá de nuevo
          </p>
          <button onClick={() => setReintento(r => r + 1)}
            style={{ background: "#d4688e", color: "white", border: "none", borderRadius: 13, padding: "13px 32px", fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 16px rgba(212,104,142,0.4)" }}>
            ↻ Reintentar
          </button>
        </div>
      )}

      {/* Catálogo activo (busqueda o categoría seleccionada) */}
      {!vistaHome && !cargando && !errorCarga && (
        <>
          <main style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 20px 80px" }}>

            {/* Breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              <button onClick={() => irAInicio()}
                style={{ background: "none", border: "none", padding: 0, fontSize: 13, color: "#94b8d8", cursor: "pointer", fontWeight: 600, transition: "color 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#d4688e")}
                onMouseLeave={e => (e.currentTarget.style.color = "#94b8d8")}>
                ← Inicio
              </button>
              <span style={{ color: "#3d5270", fontSize: 13 }}>›</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#94b8d8" }}>Catálogo</span>
              {(categoriaActiva || esFiltroFavs || busquedaDelay) && (
                <>
                  <span style={{ color: "#3d5270", fontSize: 13 }}>›</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>
                    {esFiltroFavs ? "Mis favoritos" : categoriaActiva || `"${busquedaDelay}"`}
                  </span>
                </>
              )}
            </div>

            {totalFiltrados === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 20px" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
                <p style={{ fontSize: 17, fontWeight: 800, color: "white", margin: "0 0 8px" }}>
                  {busqueda ? `Sin resultados para "${busqueda}"` : "Sin productos disponibles"}
                </p>
                <p style={{ fontSize: 14, color: "#94b8d8", margin: "0 0 24px" }}>
                  {busqueda ? "Probá con otro término" : "Volvé en unos momentos"}
                </p>
                <button onClick={() => irAInicio()}
                  style={{ background: "#d4688e", color: "white", border: "none", borderRadius: 12, padding: "11px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  ← Volver al inicio
                </button>
              </div>
            ) : (
              <>
                {(() => {
                  const filtrosActivos = [precioMin, precioMax].filter(Boolean).length + laboratoriosFiltro.size + (categoriaActiva ? 1 : 0)
                  return (
                <div style={{ marginBottom: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* Fila principal */}
                  <div className="sort-bar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <p style={{ margin: 0, color: "#94b8d8", fontSize: 13 }}>
                      <b style={{ color: "white" }}>{totalFiltrados.toLocaleString("es-AR")}</b> producto{totalFiltrados !== 1 ? "s" : ""}
                      {busquedaDelay && <> para <b style={{ color: "#d4688e" }}>&quot;{busquedaDelay}&quot;</b></>}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {busqueda && (
                        <button onClick={() => { setBusqueda(""); setBusquedaDelay("") }} style={{ background: "#e8e8e8", border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 11px", fontSize: 12, fontWeight: 700, color: "#374151", cursor: "pointer" }}>✕ Limpiar</button>
                      )}
                      <button
                        onClick={() => setFiltrosExpandidos(v => !v)}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", border: `1.5px solid ${filtrosActivos > 0 ? "#f0c8d8" : "#e2e8f0"}`, borderRadius: 9, background: filtrosActivos > 0 ? "#fdf0f5" : "white", color: filtrosActivos > 0 ? "#d4688e" : "#374151", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" }}>
                        Filtros {filtrosExpandidos ? "▲" : "▼"}
                        {filtrosActivos > 0 && <span style={{ background: "#d4688e", color: "white", borderRadius: "50%", width: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900 }}>{filtrosActivos}</span>}
                      </button>
                      <select value={orden} onChange={e => setOrden(e.target.value as Orden)}
                        style={{ padding: "7px 11px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: 13, fontWeight: 600, outline: "none", background: "#e8e8e8", color: "#374151", cursor: "pointer" }}>
                        <option value="az">Nombre A → Z</option>
                        <option value="za">Nombre Z → A</option>
                        <option value="precio_asc">Precio: menor primero</option>
                        <option value="precio_desc">Precio: mayor primero</option>
                        <option value="stock_asc">⚠ Últimas unidades primero</option>
                      </select>
                    </div>
                  </div>
                  {/* Fila filtros secundarios — colapsable */}
                  {filtrosExpandidos && <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>

                    {/* Categorías — dropdown single-select */}
                    <div style={{ position: "relative" }}>
                      <button
                        onClick={() => { setCatDropdownOpen(v => !v); setLabDropdownOpen(false) }}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", border: `1.5px solid ${categoriaActiva ? "#f0c8d8" : "#e2e8f0"}`, borderRadius: 8, fontSize: 12, fontWeight: 600, background: categoriaActiva ? "#fdf0f5" : "white", color: categoriaActiva ? "#d4688e" : "#374151", cursor: "pointer", maxWidth: 220, whiteSpace: "nowrap", overflow: "hidden" }}>
                        {categoriaActiva ? `${categoriaActiva} ▾` : "Categorías ▾"}
                      </button>
                      {catDropdownOpen && (
                        <>
                          <div onClick={() => setCatDropdownOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 99 }} />
                          <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, background: "#e8e8e8", border: "1.5px solid #e2e8f0", borderRadius: 11, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", zIndex: 100, minWidth: 230, maxHeight: 320, overflowY: "auto", padding: "6px 0" }}>
                            <div style={{ padding: "6px 12px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>Categorías</span>
                              {categoriaActiva && (
                                <button onClick={() => { setCategoriaActiva(""); setCatDropdownOpen(false) }} style={{ background: "none", border: "none", fontSize: 10, color: "#d4688e", fontWeight: 700, cursor: "pointer" }}>Limpiar</button>
                              )}
                            </div>
                            {/* Todas */}
                            <button onClick={() => { setCategoriaActiva(""); setCatDropdownOpen(false) }}
                              style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "7px 12px", background: categoriaActiva === "" ? "#fdf0f5" : "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: categoriaActiva === "" ? 700 : 500, color: categoriaActiva === "" ? "#d4688e" : "#374151", textAlign: "left" }}
                              onMouseEnter={e => { if (categoriaActiva !== "") e.currentTarget.style.background = "#e2e2e2" }}
                              onMouseLeave={e => { if (categoriaActiva !== "") e.currentTarget.style.background = "none" }}>
                              <span style={{ width: 15, height: 15, borderRadius: 4, border: `2px solid ${categoriaActiva === "" ? "#d4688e" : "#d1d5db"}`, background: categoriaActiva === "" ? "#d4688e" : "white", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                {categoriaActiva === "" && <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5"><path d="M2 6l3 3 5-5"/></svg>}
                              </span>
                              Todas las categorías
                            </button>
                            {categorias.map(cat => {
                              const est = CAT_ESTILO[cat] ?? CAT_DEFAULT
                              const sel = categoriaActiva === cat
                              return (
                                <button key={cat} onClick={() => { setCategoriaActiva(cat); setCatDropdownOpen(false) }}
                                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "7px 12px", background: sel ? "#fdf0f5" : "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: sel ? 700 : 500, color: sel ? "#d4688e" : "#374151", textAlign: "left" }}
                                  onMouseEnter={e => { if (!sel) e.currentTarget.style.background = "#e2e2e2" }}
                                  onMouseLeave={e => { if (!sel) e.currentTarget.style.background = "none" }}>
                                  <span style={{ width: 15, height: 15, borderRadius: 4, border: `2px solid ${sel ? "#d4688e" : "#d1d5db"}`, background: sel ? "#d4688e" : "white", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    {sel && <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5"><path d="M2 6l3 3 5-5"/></svg>}
                                  </span>
                                  {cat}
                                </button>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Laboratorio — dropdown multi-select */}
                    <div style={{ position: "relative" }}>
                      <button
                        onClick={() => { setLabDropdownOpen(v => !v); setCatDropdownOpen(false) }}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", border: `1.5px solid ${laboratoriosFiltro.size > 0 ? "#f0c8d8" : "#e2e8f0"}`, borderRadius: 8, fontSize: 12, fontWeight: 600, background: laboratoriosFiltro.size > 0 ? "#fdf0f5" : "white", color: laboratoriosFiltro.size > 0 ? "#d4688e" : "#374151", cursor: "pointer", maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden" }}>
                        {laboratoriosFiltro.size === 0
                          ? "Laboratorio ▾"
                          : laboratoriosFiltro.size === 1
                            ? `${[...laboratoriosFiltro][0]} ▾`
                            : `${laboratoriosFiltro.size} labs ▾`}
                      </button>
                      {labDropdownOpen && (
                        <>
                          <div onClick={() => setLabDropdownOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 99 }} />
                          <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, background: "#e8e8e8", border: "1.5px solid #e2e8f0", borderRadius: 11, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", zIndex: 100, minWidth: 220, maxHeight: 260, overflowY: "auto", padding: "6px 0" }}>
                            <div style={{ padding: "6px 12px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>Laboratorios</span>
                              {laboratoriosFiltro.size > 0 && (
                                <button onClick={() => setLaboratoriosFiltro(new Set())} style={{ background: "none", border: "none", fontSize: 10, color: "#d4688e", fontWeight: 700, cursor: "pointer" }}>Limpiar</button>
                              )}
                            </div>
                            {laboratorios.map(lab => {
                              const sel = laboratoriosFiltro.has(lab)
                              return (
                                <button key={lab} onClick={() => {
                                  setLaboratoriosFiltro(prev => {
                                    const next = new Set(prev)
                                    sel ? next.delete(lab) : next.add(lab)
                                    return next
                                  })
                                }}
                                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "7px 12px", background: sel ? "#fdf0f5" : "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: sel ? 700 : 500, color: sel ? "#d4688e" : "#374151", textAlign: "left" }}
                                  onMouseEnter={e => { if (!sel) e.currentTarget.style.background = "#e2e2e2" }}
                                  onMouseLeave={e => { if (!sel) e.currentTarget.style.background = "none" }}>
                                  <span style={{ width: 15, height: 15, borderRadius: 4, border: `2px solid ${sel ? "#d4688e" : "#d1d5db"}`, background: sel ? "#d4688e" : "white", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    {sel && <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5"><path d="M2 6l3 3 5-5"/></svg>}
                                  </span>
                                  {lab}
                                </button>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Precio mín/máx */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Precio:</span>
                      <input type="number" placeholder="Mín $" value={precioMin} onChange={e => setPrecioMin(e.target.value)}
                        style={{ width: 82, padding: "6px 8px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 12, outline: "none", color: "#1a2035" }}
                        onFocus={e => (e.target.style.borderColor = "#d4688e")}
                        onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
                      <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>
                      <input type="number" placeholder="Máx $" value={precioMax} onChange={e => setPrecioMax(e.target.value)}
                        style={{ width: 82, padding: "6px 8px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 12, outline: "none", color: "#1a2035" }}
                        onFocus={e => (e.target.style.borderColor = "#d4688e")}
                        onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
                    </div>

                    {/* Limpiar filtros */}
                    {(precioMin || precioMax || laboratoriosFiltro.size > 0 || categoriaActiva) && (
                      <button onClick={() => { setPrecioMin(""); setPrecioMax(""); setLaboratoriosFiltro(new Set()); setCategoriaActiva("") }}
                        style={{ background: "#fdf0f5", border: "1px solid #f0c8d8", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, color: "#d4688e", cursor: "pointer" }}>
                        ✕ Limpiar filtros
                      </button>
                    )}

                    {/* Toggle vista */}
                    <div style={{ marginLeft: "auto", display: "flex", background: "#f1f5f9", borderRadius: 8, padding: 3, gap: 2 }}>
                      {[{ v: false, icon: "⊞", label: "Grilla" }, { v: true, icon: "≡", label: "Lista" }].map(opt => (
                        <button key={opt.label} onClick={() => setVistaLista(opt.v)}
                          style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: vistaLista === opt.v ? "white" : "transparent", color: vistaLista === opt.v ? "#1a2035" : "#94a3b8", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: vistaLista === opt.v ? "0 1px 4px rgba(0,0,0,0.1)" : "none", transition: "all 0.15s", gap: 4, display: "flex", alignItems: "center" }}>
                          {opt.icon} {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>}
                </div>
                  )
                })()}

                {/* Chips de filtros activos */}
                {(laboratoriosFiltro.size > 0 || precioMin || precioMax || busqueda || esFiltroFavs) && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                    {busquedaDelay && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fdf0f5", border: "1px solid #f0c8d8", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700, color: "#d4688e" }}>
                        &quot;{busquedaDelay}&quot;
                        <button onClick={() => { setBusqueda(""); setBusquedaDelay("") }} style={{ background: "none", border: "none", cursor: "pointer", color: "#d4688e", fontSize: 14, lineHeight: 1, padding: 0, display: "flex" }}>×</button>
                      </div>
                    )}
                    {[...laboratoriosFiltro].map(lab => (
                      <div key={lab} style={{ display: "flex", alignItems: "center", gap: 6, background: "#fdf0f5", border: "1px solid #f0c8d8", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700, color: "#d4688e" }}>
                        🔬 {lab}
                        <button onClick={() => setLaboratoriosFiltro(prev => { const n = new Set(prev); n.delete(lab); return n })} style={{ background: "none", border: "none", cursor: "pointer", color: "#d4688e", fontSize: 14, lineHeight: 1, padding: 0, display: "flex" }}>×</button>
                      </div>
                    ))}
                    {(precioMin || precioMax) && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fdf0f5", border: "1px solid #f0c8d8", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700, color: "#d4688e" }}>
                        Precio: {precioMin ? `$${precioMin}` : "0"} — {precioMax ? `$${precioMax}` : "∞"}
                        <button onClick={() => { setPrecioMin(""); setPrecioMax("") }} style={{ background: "none", border: "none", cursor: "pointer", color: "#d4688e", fontSize: 14, lineHeight: 1, padding: 0, display: "flex" }}>×</button>
                      </div>
                    )}
                    {esFiltroFavs && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fdf0f5", border: "1px solid #f0c8d8", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700, color: "#d4688e" }}>
                        ♥ Mis favoritos
                        <button onClick={() => setCategoriaActiva("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#d4688e", fontSize: 14, lineHeight: 1, padding: 0, display: "flex" }}>×</button>
                      </div>
                    )}
                  </div>
                )}

                {/* Chips de subcategoría — aparecen cuando hay subcategorías para la categoría activa */}
                {subcategoriasDeCat.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginRight: 2 }}>Subcategoría:</span>
                    <button
                      onClick={() => setSubcategoriaActiva("")}
                      style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: subcategoriaActiva === "" ? 800 : 600, border: `1.5px solid ${subcategoriaActiva === "" ? "#d4688e" : "#e2e8f0"}`, background: subcategoriaActiva === "" ? "#fdf0f5" : "white", color: subcategoriaActiva === "" ? "#d4688e" : "#64748b", cursor: "pointer" }}>
                      Todas
                    </button>
                    {subcategoriasDeCat.map(sub => (
                      <button key={sub} onClick={() => setSubcategoriaActiva(sub === subcategoriaActiva ? "" : sub)}
                        style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: sub === subcategoriaActiva ? 800 : 600, border: `1.5px solid ${sub === subcategoriaActiva ? "#d4688e" : "#e2e8f0"}`, background: sub === subcategoriaActiva ? "#fdf0f5" : "white", color: sub === subcategoriaActiva ? "#d4688e" : "#64748b", cursor: "pointer" }}>
                        {sub}
                      </button>
                    ))}
                  </div>
                )}

                {(() => {
                  const renderProps = (p: Producto) => ({
                    p,
                    enCarrito: carrito.find(i => i.producto.id === p.id)?.cantidad ?? 0,
                    onAgregar: () => agregar(p),
                    onCambiar: (d: number) => cambiar(p.id, d),
                    onDetalle: () => setProductoDetalle(p),
                    esFav: favoritos.has(p.id),
                    searchQuery: busquedaDelay || undefined,
                    onToggleFav: () => toggleFavorito(p.id),
                    tipoCliente,
                    onVerPrecio: () => { setLoginModo("login"); setLoginError(""); setAuthModalOpen(true) },
                  })

                  // Sentinel para scroll infinito + botón explícito
                  const Sentinel = ({ todos, pagina }: { todos: Producto[]; pagina: Producto[] }) =>
                    todos.length > pagina.length ? (
                      <div ref={sentinelRef} style={{ padding: "32px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                          Mostrando <b style={{ color: "#1a2035" }}>{pagina.length}</b> de <b style={{ color: "#1a2035" }}>{todos.length}</b> productos
                        </p>
                        <button
                          onClick={() => setVisibles(v => v + 48)}
                          style={{ padding: "11px 28px", background: "#d4688e", color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: 0.2 }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#b05070")}
                          onMouseLeave={e => (e.currentTarget.style.background = "#d4688e")}
                        >
                          Cargar más productos
                        </button>
                      </div>
                    ) : (
                      <div style={{ padding: "24px 0", textAlign: "center" }}>
                        <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>
                          Mostrando todos los <b style={{ color: "#1a2035" }}>{todos.length}</b> productos
                        </p>
                      </div>
                    )

                  if (categoriaActiva === "" || esFiltroFavs) {
                    const todos = secciones.flatMap(({ items }) => items)
                    const pagina = todos.slice(0, visibles)
                    return (
                      <>
                        {vistaLista ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {pagina.map(p => <FilaListaProducto key={p.id} {...renderProps(p)} />)}
                          </div>
                        ) : (
                          <div className="grid-productos" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                            {pagina.map(p => <TarjetaProducto key={p.id} {...renderProps(p)} />)}
                          </div>
                        )}
                        <Sentinel todos={todos} pagina={pagina} />
                      </>
                    )
                  }

                  return secciones.map(({ cat, items }) => (
                    <section key={cat} style={{ marginBottom: 48 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                        <div style={{ width: 4, height: 22, background: "#d4688e", borderRadius: 4 }}/>
                        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#1a2035" }}>{cat}</h2>
                        <span style={{ fontSize: 11, fontWeight: 800, background: "#fdf0f5", color: "#d4688e", padding: "3px 10px", borderRadius: 20, border: "1px solid #f0c8d8" }}>
                          {items.length} {items.length === 1 ? "producto" : "productos"}
                        </span>
                        <div style={{ flex: 1, height: 1, background: "linear-gradient(to right, #e2e8f0, transparent)" }}/>
                      </div>
                      {vistaLista ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {items.map(p => <FilaListaProducto key={p.id} {...renderProps(p)} />)}
                        </div>
                      ) : (
                        <div className="grid-productos" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                          {items.map(p => <TarjetaProducto key={p.id} {...renderProps(p)} />)}
                        </div>
                      )}
                    </section>
                  ))
                })()}
              </>
            )}
          </main>
        </>
      )}

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer style={{ background: "#0d1120", color: "#94a3b8", padding: "52px 20px 28px", borderTop: "1px solid #1a2035" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div className="footer-cols" style={{ display: "flex", gap: 48, justifyContent: "space-between", flexWrap: "wrap", marginBottom: 40 }}>

            {/* Sobre nosotros */}
            <div style={{ maxWidth: 280 }}>
              <div style={{ marginBottom: 16 }}>
                <LogoMarca height={38} />
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.75, margin: "0 0 14px", color: "#475569" }}>
                Distribuidora veterinaria mayorista. Medicamentos, alimentos, accesorios y más para la salud animal.
                Pedidos online con atención personalizada y coordinación de entrega.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { v: "Productos de calidad certificada" },
                  { v: "Atención personalizada" },
                  { v: "Stock actualizado diariamente" },
                ].map(item => (
                  <div key={item.v} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#475569" }}>
                    <span style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(212,104,142,0.15)", border: "1px solid rgba(212,104,142,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#d4688e" strokeWidth="3"><path d="M20 6 9 17l-5-5"/></svg>
                    </span>
                    {item.v}
                  </div>
                ))}
              </div>
            </div>

            {/* Contacto */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 800, color: "#334155", letterSpacing: 1.5, textTransform: "uppercase", margin: "0 0 16px" }}>Contacto</p>
              {WHATSAPP && (
                <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer"
                  style={{ display: "flex", alignItems: "center", gap: 8, color: "#4ade80", textDecoration: "none", fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                  <IcoWA size={15} /> WhatsApp
                </a>
              )}
              <p style={{ fontSize: 13, color: "#475569", margin: "0 0 4px" }}>Almirante Brown 620</p>
              <p style={{ fontSize: 13, color: "#475569", margin: "0 0 6px" }}>Pedidos online las 24 hs</p>
              <p style={{ fontSize: 13, color: "#475569", margin: "0 0 16px" }}>Te contactamos para coordinar</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => verCatalogo("")}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 9, background: "rgba(212,104,142,0.1)", border: "1px solid rgba(212,104,142,0.25)", color: "#d4688e", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  Ver catálogo →
                </button>
                <button onClick={exportarCSV}
                  style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 9, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  ⬇ Lista de precios (.csv)
                </button>
              </div>
            </div>

            {/* Condiciones de compra */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 800, color: "#334155", letterSpacing: 1.5, textTransform: "uppercase", margin: "0 0 16px" }}>Condiciones de compra</p>
              {[
                { label: "Precios", val: "De referencia — se confirman al coordinar" },
                { label: "Pago", val: "A convenir al confirmar el pedido" },
                { label: "Entrega", val: "Retiro en local o envío a coordinar" },
                { label: "Pedido mínimo", val: "A consultar según producto" },
                { label: "Stock", val: "Actualizado — sujeto a disponibilidad" },
              ].map(item => (
                <div key={item.label} style={{ marginBottom: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#334155", textTransform: "uppercase", letterSpacing: 0.5 }}>{item.label}</span>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#475569", lineHeight: 1.5 }}>{item.val}</p>
                </div>
              ))}
            </div>

          </div>

          <div style={{ borderTop: "1px solid #1a2035", paddingTop: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#334155" }}>© {new Date().getFullYear()} VETIX Distribuidora. Todos los derechos reservados.</p>
            <p style={{ margin: 0, fontSize: 12, color: "#263248" }}>Tienda online mayorista</p>
          </div>
        </div>
      </footer>

      {/* ── TOAST ──────────────────────────────────────────────────────────── */}
      {toast && <Toast mensaje={toast} />}

      {/* ── FAB mobile ─────────────────────────────────────────────────────── */}
      {totalItems > 0 && !carritoOpen && !checkoutOpen && !pedidoOk && (
        <div className="fab-mobile" style={{ position: "fixed", bottom: 18, left: "50%", transform: "translateX(-50%)", zIndex: 45 }}>
          <button onClick={() => setCarritoOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 10, background: "#d4688e", color: "white", border: "none", borderRadius: 50, padding: "13px 24px", fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: "0 6px 28px rgba(212,104,142,0.55)", whiteSpace: "nowrap" }}>
            <IcoCart size={17} />
            Ver carrito{tienePrecios ? ` · ${fmt(totalPrecio)}` : ""}
            <span style={{ background: "rgba(255,255,255,0.25)", borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 900 }}>{totalItems}</span>
          </button>
        </div>
      )}

      {/* ── SCROLL TOP ─────────────────────────────────────────────────────── */}
      {scrollY > 400 && (
        <button className="scroll-top-anim" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          style={{ position: "fixed", bottom: 22, right: 22, width: 42, height: 42, borderRadius: "50%", background: "#d4688e", color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(212,104,142,0.45)", zIndex: 44, fontSize: 17 }}>
          ↑
        </button>
      )}

      {/* ── WA FLOTANTE ────────────────────────────────────────────────────── */}
      {WHATSAPP && !carritoOpen && (
        <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer"
          style={{ position: "fixed", bottom: 22, left: 22, zIndex: 44, display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "#16a34a", color: "white", borderRadius: 24, textDecoration: "none", fontSize: 13, fontWeight: 700, boxShadow: "0 4px 18px rgba(22,163,74,0.45)", transition: "transform 0.15s, box-shadow 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(22,163,74,0.55)" }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 18px rgba(22,163,74,0.45)" }}>
          <IcoWA size={17} />
          <span>Consultar</span>
        </a>
      )}

      {/* ── CARRITO DRAWER ─────────────────────────────────────────────────── */}
      {carritoOpen && (
        <>
          <div className="overlay-anim" onClick={() => setCarritoOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(10,15,28,0.6)", zIndex: 50, backdropFilter: "blur(3px)" }} />
          <div className="cart-drawer-anim" style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(440px, 100vw)", background: "#e8e8e8", zIndex: 51, display: "flex", flexDirection: "column", boxShadow: "-8px 0 48px rgba(0,0,0,0.25)" }}>

            <div style={{ padding: "20px 22px 16px", borderBottom: "1px solid #f1f5f9", background: "#0f172a" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ margin: "0 0 3px", fontSize: 18, fontWeight: 900, color: "white" }}>Tu carrito</h2>
                  <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                    {totalItems} ítem{totalItems !== 1 ? "s" : ""}{tienePrecios && <> · <b style={{ color: "#d4688e" }}>{fmt(totalPrecio)}</b></>}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {carrito.length > 0 && (
                    <>
                      <button onClick={imprimirCarrito}
                        title="Imprimir lista"
                        style={{ fontSize: 11, fontWeight: 700, color: "#64748b", background: "none", border: "1px solid #1e293b", borderRadius: 7, padding: "5px 9px", cursor: "pointer" }}>
                        🖨
                      </button>
                      <button onClick={() => { if (confirm("¿Vaciar el carrito?")) setCarrito([]) }}
                        style={{ fontSize: 11, fontWeight: 700, color: "#64748b", background: "none", border: "1px solid #1e293b", borderRadius: 7, padding: "5px 9px", cursor: "pointer" }}>
                        Vaciar
                      </button>
                    </>
                  )}
                  <button onClick={() => setCarritoOpen(false)} style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #1e293b", background: "#1e293b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
                    <IcoClose />
                  </button>
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
              {carrito.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "52px 24px 40px", gap: 0 }}>
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18, fontSize: 28 }}>🛒</div>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "#1a2035", margin: "0 0 6px", textAlign: "center" }}>Tu carrito está vacío</p>
                  <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 28px", textAlign: "center", lineHeight: 1.6 }}>
                    Explorá el catálogo y agregá los productos que necesitás
                  </p>
                  <button onClick={() => { setCarritoOpen(false); verCatalogo("") }}
                    style={{ background: "#d4688e", color: "white", border: "none", borderRadius: 10, padding: "11px 26px", fontSize: 13, fontWeight: 800, cursor: "pointer", boxShadow: "0 3px 12px rgba(212,104,142,0.3)", marginBottom: 12 }}>
                    Ver catálogo →
                  </button>
                  {categorias.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 8 }}>
                      {categorias.slice(0, 4).map(cat => (
                        <button key={cat} onClick={() => { setCarritoOpen(false); verCatalogo(cat) }}
                          style={{ padding: "5px 12px", borderRadius: 20, background: "#e8e8e8", border: "1.5px solid #e2e8f0", fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer" }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = "#d4688e"; e.currentTarget.style.color = "#d4688e" }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#374151" }}>
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {carrito.map(item => (
                    <div key={item.producto.id} style={{ display: "flex", gap: 12, padding: 12, background: "#e2e2e2", borderRadius: 12, border: "1px solid #eaecf2" }}>
                      <div style={{ width: 60, height: 60, background: "#e8e8e8", borderRadius: 9, border: "1px solid #eaecf2", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
                        {item.producto.imagen_url
                          ? <Image src={item.producto.imagen_url} alt="" fill sizes="60px" style={{ objectFit: "contain", padding: 4 }} />
                          : <span style={{ fontSize: 22 }}>📦</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 700, color: "#1a2035", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}>
                          {item.producto.nombre}
                        </p>
                        {item.producto.laboratorio && <p style={{ margin: "0 0 7px", fontSize: 10, color: "#b05070", fontWeight: 700 }}>{item.producto.laboratorio}</p>}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 2, background: "#e8e8e8", border: "1.5px solid #eaecf2", borderRadius: 8, padding: "2px 3px" }}>
                              <button onClick={() => cambiar(item.producto.id, -1)} style={{ width: 24, height: 24, border: "none", background: "#f1f5f9", borderRadius: 5, cursor: "pointer", fontWeight: 900, color: "#374151", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                              {cantidadEditando?.id === item.producto.id ? (
                                <input
                                  type="number" min="1" max="9999"
                                  value={cantidadEditando.valor}
                                  autoFocus
                                  onChange={e => setCantidadEditando(p => p && ({ ...p, valor: e.target.value }))}
                                  onBlur={() => {
                                    const n = parseInt(cantidadEditando?.valor ?? "")
                                    if (!isNaN(n) && n > 0) cambiar(item.producto.id, n - item.cantidad)
                                    else if (!isNaN(n) && n <= 0) quitar(item.producto.id)
                                    setCantidadEditando(null)
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                                    if (e.key === "Escape") setCantidadEditando(null)
                                  }}
                                  style={{ width: 38, textAlign: "center", fontSize: 13, fontWeight: 900, color: "#d4688e", border: "1.5px solid #d4688e", borderRadius: 5, outline: "none", padding: "1px 2px", background: "#fdf0f5" }}
                                />
                              ) : (
                                <span
                                  onClick={() => setCantidadEditando({ id: item.producto.id, valor: String(item.cantidad) })}
                                  title="Clic para editar cantidad"
                                  style={{ width: 26, textAlign: "center", fontSize: 13, fontWeight: 900, color: "#1a2035", cursor: "text", borderBottom: "1px dashed #cbd5e1" }}>
                                  {item.cantidad}
                                </span>
                              )}
                              <button onClick={() => cambiar(item.producto.id, 1)} style={{ width: 24, height: 24, border: "none", background: "#d4688e", borderRadius: 5, cursor: "pointer", fontWeight: 900, color: "white", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                            </div>
                            <button onClick={() => quitar(item.producto.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 11, fontWeight: 700, padding: "0 4px" }}>Quitar</button>
                          </div>
                          {tienePrecios && (
                            <span style={{ fontWeight: 900, fontSize: 14, color: "#d4688e" }}>
                              {fmt((precioConTipo(item.producto.precio_venta, tipoCliente) ?? item.producto.precio_venta) * item.cantidad)}
                            </span>
                          )}
                        </div>
                        {item.cantidad >= 10 && WHATSAPP && (
                          <a href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hola, consulto precio especial por ${item.cantidad} unidades de ${item.producto.nombre}`)}`}
                            target="_blank" rel="noopener noreferrer"
                            style={{ display: "block", fontSize: 10, color: "#16a34a", fontWeight: 700, textDecoration: "none", marginTop: 3 }}>
                            💬 Consultá precio especial por volumen →
                          </a>
                        )}
                        {/* Nota por ítem */}
                        {notaEditando === item.producto.id ? (
                          <div style={{ marginTop: 6 }}>
                            <textarea
                              autoFocus
                              value={item.nota ?? ""}
                              onChange={e => setNota(item.producto.id, e.target.value)}
                              onBlur={() => setNotaEditando(null)}
                              onKeyDown={e => { if (e.key === "Escape") setNotaEditando(null) }}
                              rows={2}
                              placeholder="Nota para este ítem (variante, aclaración...)"
                              style={{ width: "100%", padding: "6px 8px", borderRadius: 7, border: "1.5px solid #d4688e", fontSize: 11, outline: "none", resize: "none", boxSizing: "border-box", color: "#374151", background: "#fff8fb" }}
                            />
                          </div>
                        ) : (
                          <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 5, minHeight: 16 }}>
                            <button
                              onClick={() => setNotaEditando(item.producto.id)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 10, fontWeight: 700, padding: 0, display: "flex", alignItems: "center", gap: 3, flexShrink: 0, lineHeight: 1 }}>
                              📝 {item.nota ? "Editar nota" : "Agregar nota"}
                            </button>
                            {item.nota && (
                              <span style={{ fontSize: 10, color: "#64748b", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                                {item.nota}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {carrito.length > 0 && (
              <div style={{ padding: "14px 20px 20px", borderTop: "1px solid #f1f5f9" }}>
                <div style={{ background: "#e2e2e2", borderRadius: 11, padding: "12px 14px", marginBottom: 12, border: "1px solid #eaecf2" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6b7280" }}>
                    <span>Subtotal ({totalItems} ítems)</span>
                    <span style={{ fontWeight: 800, color: "#1a2035" }}>{tienePrecios ? fmt(totalPrecio) : "A confirmar"}</span>
                  </div>
                  <p style={{ fontSize: 11, color: "#94a3b8", margin: "6px 0 0", lineHeight: 1.5 }}>Los precios se confirman al coordinar el pedido con nosotros.</p>
                </div>
                {WHATSAPP && (
                  <a href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(textoCarritoWA())}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 11, background: "rgba(37,211,102,0.08)", border: "1.5px solid rgba(37,211,102,0.25)", color: "#16a34a", textDecoration: "none", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                    <IcoWA size={15}/> Consultar precios por WhatsApp
                  </a>
                )}
                <button onClick={() => {
                  if (perfil) {
                    setForm(f => ({
                      notas: f.notas,
                      nombre: `${perfil.nombre} ${perfil.apellido}`.trim() || f.nombre,
                      telefono: perfil.telefono || f.telefono,
                      email: perfil.email || usuario?.email || f.email,
                      direccion: perfil.direccion || f.direccion,
                    }))
                  } else if (usuario?.email && !form.email) {
                    setField("email", usuario.email)
                  }
                  setCarritoOpen(false); setCheckoutOpen(true)
                }}
                  style={{ width: "100%", padding: "14px", background: "#d4688e", color: "white", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 900, cursor: "pointer", boxShadow: "0 4px 18px rgba(212,104,142,0.45)", letterSpacing: 0.3 }}>
                  Confirmar pedido →
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── CHECKOUT MODAL ─────────────────────────────────────────────────── */}
      {checkoutOpen && !pedidoOk && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,15,28,0.65)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#e8e8e8", borderRadius: 22, width: "100%", maxWidth: 520, maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 32px 80px rgba(0,0,0,0.4)" }}>

            <div style={{ padding: "22px 24px 16px", borderBottom: "1px solid #f1f5f9", background: "#0f172a" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ margin: "0 0 4px", fontSize: 19, fontWeight: 900, color: "white" }}>Completar pedido</h2>
                  <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                    {totalItems} producto{totalItems !== 1 ? "s" : ""}{tienePrecios && <> · <b style={{ color: "#d4688e" }}>{fmt(totalPrecio)}</b></>}
                  </p>
                </div>
                <button onClick={() => setCheckoutOpen(false)} style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #1e293b", background: "#1e293b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", flexShrink: 0 }}>
                  <IcoClose />
                </button>
              </div>
            </div>

            <div style={{ padding: "18px 24px", overflowY: "auto", flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "#374151", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.6 }}>Nombre completo *</label>
                  <input type="text" placeholder="Tu nombre y apellido" value={form.nombre} onChange={e => setField("nombre", e.target.value)}
                    style={{ width: "100%", padding: "10px 13px", borderRadius: 10, border: `1.5px solid ${errForm.nombre ? "#ef4444" : "#e2e8f0"}`, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = errForm.nombre ? "#ef4444" : "#d4688e")}
                    onBlur={e => (e.target.style.borderColor = errForm.nombre ? "#ef4444" : "#e2e8f0")}
                  />
                  {errForm.nombre && <p style={{ color: "#ef4444", fontSize: 11, margin: "3px 0 0", fontWeight: 600 }}>{errForm.nombre}</p>}
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "#374151", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.6 }}>Teléfono / WA *</label>
                  <input type="tel" placeholder="11 1234-5678" value={form.telefono} onChange={e => setField("telefono", e.target.value)}
                    style={{ width: "100%", padding: "10px 13px", borderRadius: 10, border: `1.5px solid ${errForm.telefono ? "#ef4444" : "#e2e8f0"}`, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = errForm.telefono ? "#ef4444" : "#d4688e")}
                    onBlur={e => (e.target.style.borderColor = errForm.telefono ? "#ef4444" : "#e2e8f0")}
                  />
                  {errForm.telefono && <p style={{ color: "#ef4444", fontSize: 11, margin: "3px 0 0", fontWeight: 600 }}>{errForm.telefono}</p>}
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "#374151", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.6 }}>
                    Email <span style={{ color: "#9ca3af", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(opcional)</span>
                  </label>
                  <input type="email" placeholder="tu@email.com" value={form.email} onChange={e => setField("email", e.target.value)}
                    style={{ width: "100%", padding: "10px 13px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = "#d4688e")}
                    onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "#374151", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.6 }}>
                    Dirección <span style={{ color: "#9ca3af", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(opcional)</span>
                  </label>
                  <input type="text" placeholder="Calle, número, localidad" value={form.direccion} onChange={e => setField("direccion", e.target.value)}
                    style={{ width: "100%", padding: "10px 13px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = "#d4688e")}
                    onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "#374151", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.6 }}>
                    Notas <span style={{ color: "#9ca3af", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(opcional)</span>
                  </label>
                  <textarea placeholder="Horario de entrega, aclaraciones..." value={form.notas} onChange={e => setField("notas", e.target.value)} rows={2}
                    style={{ width: "100%", padding: "10px 13px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = "#d4688e")}
                    onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                  />
                </div>
              </div>

              {/* Resumen */}
              <div style={{ marginTop: 18, background: "#e2e2e2", borderRadius: 13, padding: 15, border: "1px solid #eaecf2" }}>
                <p style={{ margin: "0 0 10px", fontSize: 10.5, fontWeight: 800, color: "#374151", textTransform: "uppercase", letterSpacing: 0.8 }}>Resumen del pedido</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {carrito.map(i => (
                    <div key={i.producto.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, color: "#374151" }}>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {i.producto.nombre} <span style={{ color: "#9ca3af" }}>×{i.cantidad}</span>
                      </span>
                      <span style={{ fontWeight: 700, flexShrink: 0 }}>
                        {fmt((precioConTipo(i.producto.precio_venta, tipoCliente) ?? i.producto.precio_venta) * i.cantidad)}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: "1px solid #e2e8f0", marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 800, color: "#1a2035", fontSize: 14 }}>{tienePrecios ? "Total estimado" : "Total"}</span>
                  <span style={{ fontWeight: 900, fontSize: 20, color: "#d4688e" }}>{tienePrecios ? fmt(totalPrecio) : "A confirmar"}</span>
                </div>
              </div>

              {errPedido && (
                <div style={{ marginTop: 10, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 9, padding: "10px 13px", fontSize: 13, color: "#dc2626", fontWeight: 600 }}>
                  ⚠ {errPedido}
                </div>
              )}
            </div>

            <div style={{ padding: "14px 24px 20px", borderTop: "1px solid #f1f5f9" }}>
              <button onClick={enviar} disabled={enviando}
                style={{ width: "100%", padding: "15px", fontSize: 15, fontWeight: 900, background: enviando ? "#f9a8d4" : "#d4688e", color: "white", border: "none", borderRadius: 13, cursor: enviando ? "not-allowed" : "pointer", boxShadow: enviando ? "none" : "0 4px 18px rgba(212,104,142,0.45)", letterSpacing: 0.3 }}>
                {enviando ? "Enviando pedido..." : "✓  Confirmar pedido"}
              </button>
              <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", margin: "7px 0 0", lineHeight: 1.5 }}>
                Te contactaremos para coordinar el pago y la entrega
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DETALLE PRODUCTO ─────────────────────────────────────────── */}
      {productoDetalle && (() => {
        const p = productoDetalle
        const enCarrito = carrito.find(i => i.producto.id === p.id)?.cantidad ?? 0
        const stockBajo = p.stock > 0 && p.stock <= 10
        const badgeDetalle = stockLabel(p.stock)
        return (
          <div className="overlay-anim" style={{ position: "fixed", inset: 0, background: "rgba(10,15,28,0.7)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}
            onClick={e => { if (e.target === e.currentTarget) setProductoDetalle(null) }}>
            <div className="modal-scale-anim" style={{ background: "#e8e8e8", borderRadius: 22, width: "100%", maxWidth: 620, maxHeight: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 32px 80px rgba(0,0,0,0.4)", overflow: "hidden" }}>

              {/* Header */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {p.categoria && <span style={{ fontSize: 10, fontWeight: 800, background: "#fdf0f5", color: "#d4688e", padding: "3px 10px", borderRadius: 20, border: "1px solid #f0c8d8" }}>{p.categoria}</span>}
                  {p.laboratorio && <span style={{ fontSize: 10, fontWeight: 800, background: "#fdf0f5", color: "#b05070", padding: "3px 10px", borderRadius: 20, border: "1px solid #f0c8d8" }}>{p.laboratorio}</span>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => copiarLink(p.id)} title="Copiar link del producto"
                    style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #e2e8f0", background: "#e2e2e2", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", flexShrink: 0, transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#d4688e"; e.currentTarget.style.color = "#d4688e" }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#64748b" }}>
                    <IcoShare size={14} />
                  </button>
                  <button onClick={() => setProductoDetalle(null)} style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #e2e8f0", background: "#e2e2e2", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", flexShrink: 0 }}>
                    <IcoClose />
                  </button>
                </div>
              </div>

              {/* Cuerpo */}
              <div style={{ overflowY: "auto", flex: 1 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>

                  {/* Imagen */}
                  <div
                    onClick={() => p.imagen_url && setImagenZoom(p.imagen_url)}
                    style={{ background: "#f7f8fb", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 260, position: "relative", borderRight: "1px solid #f1f5f9", cursor: p.imagen_url ? "zoom-in" : "default", overflow: "hidden" }}>
                    {p.imagen_url
                      ? <Image src={p.imagen_url} alt={p.nombre} fill sizes="(max-width: 640px) 90vw, 310px" style={{ objectFit: "contain", padding: 16, transition: "transform 0.2s", pointerEvents: "none" }} />
                      : <div style={{ opacity: 0.3 }}><IcoBox /></div>
                    }
                    {p.imagen_url && (
                      <div style={{ position: "absolute", bottom: 10, right: 10, background: "rgba(0,0,0,0.45)", borderRadius: 8, padding: "4px 8px", display: "flex", alignItems: "center", gap: 5, color: "white", fontSize: 11, fontWeight: 600, pointerEvents: "none" }}>
                        <IcoZoom size={12} /> Ampliar
                      </div>
                    )}
                    {badgeDetalle && (
                      <div style={{ position: "absolute", bottom: 12, left: 12, background: badgeDetalle.bg, color: badgeDetalle.color, fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 20, border: `1px solid ${badgeDetalle.border}` }}>
                        ⚠ {badgeDetalle.text}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ padding: "24px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
                    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "#1a2035", lineHeight: 1.4 }}>{p.nombre}</h2>

                    <div>
                      {tipoCliente === null ? (
                        <>
                          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>Precio</p>
                          <button onClick={() => { setProductoDetalle(null); setLoginModo("login"); setLoginError(""); setAuthModalOpen(true) }}
                            style={{ padding: "10px 18px", background: "#d4688e", color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                            Iniciá sesión para ver el precio
                          </button>
                        </>
                      ) : tipoCliente === "pendiente" ? (
                        <>
                          <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>Precio</p>
                          <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#92400e" }}>A consultar</p>
                          <p style={{ margin: "5px 0 0", fontSize: 11, color: "#94a3b8" }}>Consultá a VETIX para conocer tu precio</p>
                        </>
                      ) : (
                        <>
                          <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>
                            Precio
                          </p>
                          <p style={{ margin: 0, fontSize: 30, fontWeight: 900, color: "#d4688e", lineHeight: 1 }}>
                            {fmt(precioConTipo(p.precio_venta, tipoCliente)!)}
                          </p>
                          <p style={{ margin: "5px 0 0", fontSize: 11, color: "#94a3b8" }}>Precio sujeto a confirmación</p>
                        </>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 7, background: "#e2e2e2", borderRadius: 10, padding: "12px 14px", border: "1px solid #eaecf2" }}>
                      {p.laboratorio && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <span style={{ color: "#64748b", fontWeight: 600 }}>Laboratorio</span>
                          <span style={{ color: "#1a2035", fontWeight: 700 }}>{p.laboratorio}</span>
                        </div>
                      )}
                      {p.categoria && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <span style={{ color: "#64748b", fontWeight: 600 }}>Categoría</span>
                          <span style={{ color: "#1a2035", fontWeight: 700 }}>{p.categoria}</span>
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "#64748b", fontWeight: 600 }}>Disponibilidad</span>
                        <span style={{ color: badgeDetalle ? badgeDetalle.color : "#16a34a", fontWeight: 700 }}>
                          {badgeDetalle ? `⚠ ${badgeDetalle.text}` : "✓ En stock"}
                        </span>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: "auto" }}>
                      {enCarrito > 0 ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 0, background: "#fdf0f5", border: "2px solid #d4688e", borderRadius: 11, overflow: "hidden" }}>
                          <button onClick={() => cambiar(p.id, -1)} style={{ flex: 1, padding: "11px 0", border: "none", background: "transparent", color: "#be185d", fontWeight: 900, cursor: "pointer", fontSize: 20, lineHeight: 1 }}>−</button>
                          <span style={{ fontSize: 15, fontWeight: 900, color: "#be185d", minWidth: 40, textAlign: "center" }}>{enCarrito}</span>
                          <button onClick={() => cambiar(p.id, 1)} style={{ flex: 1, padding: "11px 0", border: "none", background: "#d4688e", color: "white", fontWeight: 900, cursor: "pointer", fontSize: 20, lineHeight: 1 }}>+</button>
                        </div>
                      ) : (
                        <button onClick={() => { agregar(p) }} style={{ width: "100%", padding: "12px", background: "#d4688e", color: "white", border: "none", borderRadius: 11, fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 14px rgba(212,104,142,0.35)" }}>
                          + Agregar al carrito
                        </button>
                      )}
                      {WHATSAPP && (
                        <a href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hola, consulto por: ${p.nombre}`)}`} target="_blank" rel="noopener noreferrer"
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", background: "rgba(37,211,102,0.08)", border: "1.5px solid rgba(37,211,102,0.25)", borderRadius: 11, color: "#16a34a", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
                          <IcoWA size={15} /> Consultar por WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Productos relacionados */}
                {(() => {
                  const relacionados = productos
                    .filter(r => r.id !== p.id && (r.categoria === p.categoria || r.laboratorio === p.laboratorio))
                    .slice(0, 4)
                  if (relacionados.length === 0) return null
                  return (
                    <div style={{ borderTop: "1px solid #f1f5f9", padding: "16px 20px 20px" }}>
                      <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8 }}>
                        Productos relacionados
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {relacionados.map(r => (
                          <button key={r.id} onClick={() => setProductoDetalle(r)}
                            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 9, background: "#e2e2e2", border: "1px solid #eaecf2", cursor: "pointer", textAlign: "left", transition: "background 0.15s" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "#fdf0f5")}
                            onMouseLeave={e => (e.currentTarget.style.background = "#e2e2e2")}>
                            <div style={{ width: 38, height: 38, background: "#e8e8e8", borderRadius: 7, flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #eaecf2", position: "relative" }}>
                              {r.imagen_url
                                ? <Image src={r.imagen_url} alt="" fill sizes="38px" style={{ objectFit: "contain", padding: 3 }} />
                                : <span style={{ fontSize: 18, opacity: 0.3 }}>📦</span>}
                            </div>
                            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#1a2035", lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}>
                              {r.nombre}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 900, color: "#d4688e", flexShrink: 0 }}>
                              {tipoCliente && tipoCliente !== "pendiente" ? fmt(precioConTipo(r.precio_venta, tipoCliente)!) : "—"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── SIDEBAR IZQUIERDO ──────────────────────────────────────────────── */}
      {sidebarOpen && (
        <>
          <div className="overlay-anim" onClick={() => setSidebarOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(10,15,28,0.6)", zIndex: 50, backdropFilter: "blur(3px)" }} />
          <div className="sidebar-anim" style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: "min(320px, 90vw)", background: "#0f172a", zIndex: 51, display: "flex", flexDirection: "column", boxShadow: "8px 0 48px rgba(0,0,0,0.35)", overflowY: "auto" }}>

            {/* Header del sidebar */}
            <div style={{ padding: "18px 20px 16px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <LogoMarca />
              <button onClick={() => setSidebarOpen(false)}
                style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #1e293b", background: "#1e293b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
                <IcoClose />
              </button>
            </div>

            {/* Navegación */}
            <div style={{ padding: "16px 14px 8px" }}>
              <p style={{ fontSize: 9.5, fontWeight: 800, color: "#334155", letterSpacing: 1.5, textTransform: "uppercase", margin: "0 0 10px", paddingLeft: 6 }}>Navegación</p>
              {[
                { label: "Inicio", action: () => irAInicio() },
                { label: "Catálogo completo", action: () => verCatalogo("") },
                { label: "Categorías", action: () => { setSidebarOpen(false); setCatModalOpen(true) } },
                ...(favoritos.size > 0 ? [{ label: `Mis favoritos (${favoritos.size})`, action: () => { setSidebarOpen(false); setBusqueda(""); setCategoriaActiva("__favs__") } }] : []),
                ...(usuario ? [{ label: "Mis pedidos", action: () => { setSidebarOpen(false); cargarMisPedidos(); setPedidosOpen(true) } }] : []),
                { label: "Descargar lista de precios", action: () => { exportarCSV(); setSidebarOpen(false) } },
              ].map(item => (
                <button key={item.label} onClick={item.action}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 9, background: "transparent", border: "none", color: "#94a3b8", fontSize: 13.5, fontWeight: 600, cursor: "pointer", textAlign: "left", transition: "color 0.15s, background 0.15s", letterSpacing: 0.1 }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#1e293b"; e.currentTarget.style.color = "white" }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94a3b8" }}>
                  {item.label}
                  <span style={{ fontSize: 11, opacity: 0.4 }}>›</span>
                </button>
              ))}
            </div>

            {/* Categorías rápidas en sidebar */}
            {categorias.length > 0 && (
              <div style={{ padding: "8px 14px", borderTop: "1px solid #1e293b" }}>
                <p style={{ fontSize: 9.5, fontWeight: 800, color: "#334155", letterSpacing: 1.5, textTransform: "uppercase", margin: "10px 0 10px", paddingLeft: 6 }}>Categorías populares</p>
                {categorias.slice(0, 6).map(cat => {
                  const est = CAT_ESTILO[cat] ?? CAT_DEFAULT
                  return (
                    <button key={cat} onClick={() => verCatalogo(cat)}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9, background: "transparent", border: "none", color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left", transition: "background 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#1e293b")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      {cat}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Auth section */}
            <div style={{ padding: "12px 14px 20px", borderTop: "1px solid #1e293b", marginTop: "auto" }}>
              <p style={{ fontSize: 9.5, fontWeight: 800, color: "#334155", letterSpacing: 1.5, textTransform: "uppercase", margin: "10px 0 14px", paddingLeft: 6 }}>Mi cuenta</p>

              {usuario ? (
                <div style={{ padding: "14px 16px", background: "#0a1120", borderRadius: 13, border: "1px solid #1e293b" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#d4688e,#b05070)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 900, fontSize: 16, flexShrink: 0 }}>
                      {(perfil ? perfil.nombre : usuario.email)[0].toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      {perfil && (
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {perfil.nombre} {perfil.apellido}
                        </p>
                      )}
                      <p style={{ margin: perfil ? "1px 0 0" : 0, fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{usuario.email}</p>
                      <p style={{ margin: "3px 0 0", fontSize: 10, color: "#4ade80", fontWeight: 600 }}>● Sesión activa</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 7 }}>
                    <button onClick={e => { e.stopPropagation(); abrirEditarPerfil() }}
                      style={{ flex: 1, padding: "9px", borderRadius: 9, background: "#1e293b", border: "1px solid #2d3a55", color: "#94a3b8", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      Editar perfil
                    </button>
                    <button onClick={cerrarSesion}
                      style={{ flex: 1, padding: "9px", borderRadius: 9, background: "#1e293b", border: "1px solid #2d3a55", color: "#94a3b8", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      Cerrar sesión
                    </button>
                  </div>
                  {ADMIN_EMAIL && usuario?.email === ADMIN_EMAIL && (
                    <a href="/admin"
                      style={{ display: "block", textAlign: "center", padding: "9px", borderRadius: 9, background: "#d4688e", color: "white", fontSize: 12, fontWeight: 800, textDecoration: "none", marginTop: 2 }}>
                      ⚙ Panel Admin
                    </a>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button onClick={() => { setLoginModo("login"); setLoginError(""); setSidebarOpen(false); setAuthModalOpen(true) }}
                    style={{ width: "100%", padding: "11px", borderRadius: 10, background: "#d4688e", color: "white", border: "none", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                    Iniciar sesión
                  </button>
                  <button onClick={() => { setLoginModo("registro"); setLoginError(""); setSidebarOpen(false); setAuthModalOpen(true) }}
                    style={{ width: "100%", padding: "11px", borderRadius: 10, background: "transparent", color: "#64748b", border: "1px solid #1e293b", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    Crear cuenta
                  </button>
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "#334155", textAlign: "center", lineHeight: 1.5 }}>
                    Iniciá sesión para ver los precios según tu perfil
                  </p>
                </div>
              )}
            </div>

          </div>
        </>
      )}

      {/* ── MODAL MIS PEDIDOS ────────────────────────────────────────────────── */}
      {pedidosOpen && (
        <div className="overlay-anim" style={{ position: "fixed", inset: 0, background: "rgba(10,15,28,0.7)", zIndex: 55, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setPedidosOpen(false) }}>
          <div className="modal-scale-anim" style={{ background: "#e8e8e8", borderRadius: 22, width: "100%", maxWidth: 580, maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 32px 80px rgba(0,0,0,0.4)", overflow: "hidden" }}>

            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f1f5f9", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                <h2 style={{ margin: "0 0 3px", fontSize: 18, fontWeight: 900, color: "white" }}>Mis pedidos</h2>
                <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>{usuario?.email}</p>
              </div>
              <button onClick={() => setPedidosOpen(false)} style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #1e293b", background: "#1e293b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", flexShrink: 0 }}>
                <IcoClose />
              </button>
            </div>

            <div style={{ overflowY: "auto", flex: 1, padding: "16px 20px" }}>
              {cargandoPedidos ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 12 }} />)}
                </div>
              ) : misPedidos.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px" }}>
                  <div style={{ fontSize: 48, marginBottom: 14 }}>📋</div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#374151", margin: "0 0 6px" }}>Sin pedidos aún</p>
                  <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>Tus pedidos aparecerán acá una vez que los hagas con este email</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {misPedidos.map(pedido => {
                    const fecha = new Date(pedido.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
                    const estadoColor: Record<string, string> = { pendiente: "#f59e0b", confirmado: "#3b82f6", entregado: "#16a34a", cancelado: "#ef4444" }
                    const color = estadoColor[pedido.estado] ?? "#64748b"
                    return (
                      <details key={pedido.id} style={{ background: "#e2e2e2", border: "1px solid #eaecf2", borderRadius: 13, overflow: "hidden" }}>
                        <summary style={{ padding: "14px 16px", cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 800, color: "#1a2035" }}>Pedido #{String(pedido.id).padStart(4, "0")}</span>
                              <span style={{ fontSize: 10, fontWeight: 800, color, background: `${color}18`, border: `1px solid ${color}40`, borderRadius: 20, padding: "1px 8px", textTransform: "capitalize" }}>{pedido.estado}</span>
                            </div>
                            <span style={{ fontSize: 12, color: "#64748b" }}>{fecha}</span>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: "#d4688e" }}>{fmt(pedido.total)}</p>
                            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8" }}>{pedido.pedido_items?.length ?? 0} ítem{(pedido.pedido_items?.length ?? 0) !== 1 ? "s" : ""}</p>
                          </div>
                        </summary>
                        {pedido.pedido_items && pedido.pedido_items.length > 0 && (
                          <div style={{ padding: "0 16px 16px", borderTop: "1px solid #eaecf2" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 12, marginBottom: 12 }}>
                              {pedido.pedido_items.map((item, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#374151" }}>
                                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{item.nombre_producto} <span style={{ color: "#94a3b8" }}>×{item.cantidad}</span></span>
                                  <span style={{ fontWeight: 700, flexShrink: 0 }}>{fmt(item.precio_unitario * item.cantidad)}</span>
                                </div>
                              ))}
                            </div>
                            <button onClick={() => repetirPedido(pedido)}
                              style={{ width: "100%", padding: "9px", borderRadius: 9, background: "#fdf0f5", border: "1.5px solid #f0c8d8", color: "#d4688e", fontSize: 12, fontWeight: 800, cursor: "pointer", transition: "background 0.15s" }}
                              onMouseEnter={e => (e.currentTarget.style.background = "#fdf0f5")}
                              onMouseLeave={e => (e.currentTarget.style.background = "#fdf0f5")}>
                              ↺ Repetir este pedido
                            </button>
                          </div>
                        )}
                      </details>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CATEGORÍAS ─────────────────────────────────────────────────── */}
      {catModalOpen && (
        <div className="overlay-anim" style={{ position: "fixed", inset: 0, background: "rgba(10,15,28,0.7)", zIndex: 55, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setCatModalOpen(false) }}>
          <div className="modal-scale-anim" style={{ background: "#e8e8e8", borderRadius: 22, width: "100%", maxWidth: 680, maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 32px 80px rgba(0,0,0,0.4)", overflow: "hidden" }}>

            {/* Header */}
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0f172a", flexShrink: 0 }}>
              <div>
                <h2 style={{ margin: "0 0 3px", fontSize: 18, fontWeight: 900, color: "white" }}>Todas las categorías</h2>
                <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>{categorias.length} categorías · {productos.length.toLocaleString("es-AR")} productos</p>
              </div>
              <button onClick={() => setCatModalOpen(false)}
                style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #1e293b", background: "#1e293b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", flexShrink: 0 }}>
                <IcoClose />
              </button>
            </div>

            {/* Grid */}
            <div style={{ overflowY: "auto", padding: "20px 20px 24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 8 }}>
                {categorias.map(cat => {
                  const est = CAT_ESTILO[cat] ?? CAT_DEFAULT
                  return (
                    <button key={cat} onClick={() => verCatalogo(cat)}
                      style={{ background: "#e8e8e8", border: "1.5px solid #e8ecf2", borderRadius: 10, padding: "12px 14px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 11, transition: "border-color 0.15s, background 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "#d4688e"; e.currentTarget.style.background = "#fff8fb" }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "#e8ecf2"; e.currentTarget.style.background = "white" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1a2035", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL EDITAR PERFIL ────────────────────────────────────────────── */}
      {editPerfilOpen && (
        <div className="overlay-anim" style={{ position: "fixed", inset: 0, background: "rgba(10,15,28,0.72)", zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setEditPerfilOpen(false) }}>
          <div className="modal-scale-anim" style={{ background: "#e8e8e8", borderRadius: 22, width: "100%", maxWidth: 420, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.45)" }}>

            <div style={{ padding: "20px 24px 16px", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ margin: "0 0 2px", fontSize: 17, fontWeight: 900, color: "white" }}>Editar perfil</h2>
                <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Actualizá tus datos de contacto</p>
              </div>
              <button onClick={() => setEditPerfilOpen(false)}
                style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #1e293b", background: "#1e293b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", flexShrink: 0 }}>
                <IcoClose />
              </button>
            </div>

            <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "#374151", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.6 }}>Nombre *</label>
                  <input type="text" value={editNombre} onChange={e => setEditNombre(e.target.value)}
                    style={{ width: "100%", padding: "10px 13px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = "#d4688e")}
                    onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "#374151", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.6 }}>Apellido *</label>
                  <input type="text" value={editApellido} onChange={e => setEditApellido(e.target.value)}
                    style={{ width: "100%", padding: "10px 13px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = "#d4688e")}
                    onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "#374151", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.6 }}>Teléfono / WA *</label>
                <input type="tel" value={editTelefono} onChange={e => setEditTelefono(e.target.value)}
                  style={{ width: "100%", padding: "10px 13px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                  onFocus={e => (e.target.style.borderColor = "#d4688e")}
                  onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "#374151", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.6 }}>
                  Dirección <span style={{ fontWeight: 400, textTransform: "none", fontSize: 10, color: "#9ca3af" }}>(opcional)</span>
                </label>
                <input type="text" value={editDireccion} onChange={e => setEditDireccion(e.target.value)}
                  style={{ width: "100%", padding: "10px 13px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                  onFocus={e => (e.target.style.borderColor = "#d4688e")}
                  onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
              </div>
              {editError && (
                <p style={{ margin: 0, fontSize: 12, color: "#dc2626", fontWeight: 600, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px" }}>
                  ⚠ {editError}
                </p>
              )}
              <button onClick={guardarPerfil} disabled={editGuardando}
                style={{ width: "100%", padding: "13px", background: editGuardando ? "#f9a8d4" : "#d4688e", color: "white", border: "none", borderRadius: 11, fontSize: 14, fontWeight: 900, cursor: editGuardando ? "not-allowed" : "pointer", boxShadow: editGuardando ? "none" : "0 4px 16px rgba(212,104,142,0.4)", marginTop: 4 }}>
                {editGuardando ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL AUTH ─────────────────────────────────────────────────────── */}
      {authModalOpen && (
        <div className="overlay-anim" style={{ position: "fixed", inset: 0, background: "rgba(10,15,28,0.72)", zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setAuthModalOpen(false) }}>
          <div className="modal-scale-anim" style={{ background: "#e8e8e8", borderRadius: 22, width: "100%", maxWidth: 460, maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 32px 80px rgba(0,0,0,0.45)" }}>

            {/* Header */}
            <div style={{ padding: "22px 24px 18px", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ margin: "0 0 3px", fontSize: 18, fontWeight: 900, color: "white" }}>
                  {loginModo === "login" ? "Iniciar sesión" : "Crear cuenta"}
                </h2>
                <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                  {loginModo === "login" ? "Para ver tus precios personalizados" : "Registrate para acceder a precios"}
                </p>
              </div>
              <button onClick={() => setAuthModalOpen(false)}
                style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #1e293b", background: "#1e293b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", flexShrink: 0 }}>
                <IcoClose />
              </button>
            </div>

            {/* Tabs */}
            <div style={{ padding: "14px 24px 0", display: "flex", gap: 0, background: "#e2e2e2", borderBottom: "1px solid #e2e8f0" }}>
              {(["login", "registro"] as const).map(modo => (
                <button key={modo} onClick={() => { setLoginModo(modo); setLoginError("") }}
                  style={{ padding: "10px 20px", border: "none", background: "transparent", borderBottom: `2.5px solid ${loginModo === modo ? "#d4688e" : "transparent"}`, color: loginModo === modo ? "#d4688e" : "#64748b", fontSize: 13, fontWeight: loginModo === modo ? 800 : 600, cursor: "pointer", transition: "all 0.15s", marginBottom: -1 }}>
                  {modo === "login" ? "Ingresar" : "Registrarse"}
                </button>
              ))}
            </div>

            {/* Formulario */}
            <div style={{ padding: "20px 24px 24px", overflowY: "auto", flex: 1 }}>

              {loginModo === "login" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "#374151", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.6 }}>Email</label>
                    <input type="email" placeholder="tu@email.com" value={loginEmail}
                      onChange={e => { setLoginEmail(e.target.value); setLoginError("") }}
                      onKeyDown={e => e.key === "Enter" && iniciarSesion()}
                      style={{ width: "100%", padding: "10px 13px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                      onFocus={e => (e.target.style.borderColor = "#d4688e")}
                      onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "#374151", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.6 }}>Contraseña</label>
                    <input type="password" placeholder="••••••••" value={loginPass}
                      onChange={e => { setLoginPass(e.target.value); setLoginError("") }}
                      onKeyDown={e => e.key === "Enter" && iniciarSesion()}
                      style={{ width: "100%", padding: "10px 13px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                      onFocus={e => (e.target.style.borderColor = "#d4688e")}
                      onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                    />
                  </div>
                  {loginError && (
                    <p style={{ margin: 0, fontSize: 12, color: "#dc2626", fontWeight: 600, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px" }}>
                      ⚠ {loginError}
                    </p>
                  )}
                  <button onClick={iniciarSesion} disabled={loginCargando}
                    style={{ width: "100%", padding: "13px", background: loginCargando ? "#f9a8d4" : "#d4688e", color: "white", border: "none", borderRadius: 11, fontSize: 14, fontWeight: 900, cursor: loginCargando ? "not-allowed" : "pointer", boxShadow: loginCargando ? "none" : "0 4px 16px rgba(212,104,142,0.4)", marginTop: 4 }}>
                    {loginCargando ? "Ingresando..." : "Ingresar"}
                  </button>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                    <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                      ¿No tenés cuenta?{" "}
                      <button onClick={() => { setLoginModo("registro"); setLoginError("") }}
                        style={{ background: "none", border: "none", color: "#d4688e", fontWeight: 700, cursor: "pointer", fontSize: 12, padding: 0 }}>
                        Registrate acá
                      </button>
                    </p>
                    <button onClick={recuperarContrasena} disabled={loginCargando}
                      style={{ background: "none", border: "none", color: "#94a3b8", fontWeight: 600, cursor: "pointer", fontSize: 12, padding: 0, textDecoration: "underline" }}>
                      Olvidé mi contraseña
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "#374151", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.6 }}>Nombre *</label>
                      <input type="text" placeholder="Juan" value={regNombre}
                        onChange={e => { setRegNombre(e.target.value); setLoginError("") }}
                        style={{ width: "100%", padding: "10px 13px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                        onFocus={e => (e.target.style.borderColor = "#d4688e")}
                        onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "#374151", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.6 }}>Apellido *</label>
                      <input type="text" placeholder="Pérez" value={regApellido}
                        onChange={e => { setRegApellido(e.target.value); setLoginError("") }}
                        style={{ width: "100%", padding: "10px 13px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                        onFocus={e => (e.target.style.borderColor = "#d4688e")}
                        onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "#374151", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.6 }}>Email *</label>
                    <input type="email" placeholder="tu@email.com" value={loginEmail}
                      onChange={e => { setLoginEmail(e.target.value); setLoginError("") }}
                      style={{ width: "100%", padding: "10px 13px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                      onFocus={e => (e.target.style.borderColor = "#d4688e")}
                      onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "#374151", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.6 }}>Contraseña *</label>
                    <input type="password" placeholder="Mínimo 6 caracteres" value={loginPass}
                      onChange={e => { setLoginPass(e.target.value); setLoginError("") }}
                      style={{ width: "100%", padding: "10px 13px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                      onFocus={e => (e.target.style.borderColor = "#d4688e")}
                      onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "#374151", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.6 }}>Teléfono / WA *</label>
                    <input type="tel" placeholder="11 1234-5678" value={regTelefono}
                      onChange={e => { setRegTelefono(e.target.value); setLoginError("") }}
                      style={{ width: "100%", padding: "10px 13px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                      onFocus={e => (e.target.style.borderColor = "#d4688e")}
                      onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "#374151", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.6 }}>
                      Dirección <span style={{ fontWeight: 400, textTransform: "none", fontSize: 10, color: "#9ca3af" }}>(opcional)</span>
                    </label>
                    <input type="text" placeholder="Calle, número, localidad" value={regDireccion}
                      onChange={e => setRegDireccion(e.target.value)}
                      style={{ width: "100%", padding: "10px 13px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                      onFocus={e => (e.target.style.borderColor = "#d4688e")}
                      onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                    />
                  </div>
                  {loginError && (
                    <p style={{ margin: 0, fontSize: 12, color: "#dc2626", fontWeight: 600, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px" }}>
                      ⚠ {loginError}
                    </p>
                  )}
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 9, padding: "10px 13px", fontSize: 11, color: "#166534", lineHeight: 1.5 }}>
                    Los precios los asigna el equipo VETIX, verás los precios al iniciar sesión.
                  </div>
                  <button onClick={registrar} disabled={loginCargando}
                    style={{ width: "100%", padding: "13px", background: loginCargando ? "#f9a8d4" : "#d4688e", color: "white", border: "none", borderRadius: 11, fontSize: 14, fontWeight: 900, cursor: loginCargando ? "not-allowed" : "pointer", boxShadow: loginCargando ? "none" : "0 4px 16px rgba(212,104,142,0.4)" }}>
                    {loginCargando ? "Creando cuenta..." : "Crear cuenta"}
                  </button>
                  <p style={{ margin: 0, fontSize: 12, color: "#64748b", textAlign: "center" }}>
                    ¿Ya tenés cuenta?{" "}
                    <button onClick={() => { setLoginModo("login"); setLoginError("") }}
                      style={{ background: "none", border: "none", color: "#d4688e", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                      Iniciá sesión
                    </button>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── LIGHTBOX IMAGEN ────────────────────────────────────────────────── */}
      {imagenZoom && (
        <div
          onClick={() => setImagenZoom(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.93)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, cursor: "zoom-out" }}>
          <div
            className="modal-scale-anim"
            style={{ position: "relative", width: "min(700px, 90vw)", height: "min(700px, 85vh)", borderRadius: 12, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.6)", pointerEvents: "none" }}>
            <Image
              src={imagenZoom}
              alt="Producto ampliado"
              fill
              sizes="min(700px, 90vw)"
              style={{ objectFit: "contain" }}
              priority
            />
          </div>
          <button
            onClick={() => setImagenZoom(null)}
            style={{ position: "absolute", top: 18, right: 18, width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, lineHeight: 1 }}>
            ×
          </button>
          <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 20, padding: "6px 16px", color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
            Presioná Escape o hacé clic para cerrar
          </div>
        </div>
      )}

      {/* ── PEDIDO OK ──────────────────────────────────────────────────────── */}
      {pedidoOk && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,15,28,0.75)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#e8e8e8", borderRadius: 26, padding: "46px 34px 38px", maxWidth: 400, width: "100%", textAlign: "center", boxShadow: "0 32px 80px rgba(0,0,0,0.45)" }}>
            <div style={{ width: 72, height: 72, background: "#f0fdf4", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", border: "2.5px solid #86efac" }}>
              <svg width="30" height="30" fill="none" strokeWidth="2.5" viewBox="0 0 24 24" stroke="#16a34a"><path d="M20 6 9 17l-5-5" /></svg>
            </div>
            <h2 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#1a2035" }}>¡Pedido enviado!</h2>
            {numeroPedido && (
              <div style={{ display: "inline-block", background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 9, padding: "5px 16px", margin: "0 0 14px" }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#15803d", letterSpacing: 1 }}>PEDIDO N° {String(numeroPedido).padStart(4, "0")}</span>
              </div>
            )}
            <p style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.65, margin: "0 0 26px" }}>
              Recibimos tu pedido correctamente.<br />
              Nos comunicaremos a la brevedad para<br />coordinar el pago y la entrega.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {WHATSAPP && (
                <a href={waLink()} target="_blank" rel="noopener noreferrer"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#22c55e", color: "white", borderRadius: 13, padding: "13px 22px", fontSize: 14, fontWeight: 800, textDecoration: "none", boxShadow: "0 4px 14px rgba(34,197,94,0.35)" }}>
                  <IcoWA /> Contactar por WhatsApp
                </a>
              )}
              <button onClick={() => { setPedidoOk(false); setCheckoutOpen(false) }}
                style={{ background: "#d4688e", color: "white", border: "none", borderRadius: 13, padding: "13px 22px", fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 14px rgba(212,104,142,0.35)" }}>
                Seguir comprando
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
