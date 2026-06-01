import type { Metadata } from "next"
import Image from "next/image"

export const metadata: Metadata = {
  title: "Página no encontrada — VETIX",
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#f5f7fb",
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>
      <header style={{ background: "#0f172a", padding: "0 20px", height: 64, display: "flex", alignItems: "center", boxShadow: "0 2px 20px rgba(0,0,0,0.4)" }}>
        <a href={SITE_URL} style={{ display: "inline-flex", alignItems: "center", background: "white", borderRadius: 8, padding: "4px 10px", textDecoration: "none" }}>
          <Image src="/logo.png" alt="VETIX" height={36} width={144} style={{ height: 36, width: "auto" }} priority />
        </a>
      </header>

      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{ textAlign: "center", maxWidth: 440 }}>
          <div style={{ fontSize: 80, marginBottom: 20, lineHeight: 1 }}>🐾</div>
          <h1 style={{ margin: "0 0 10px", fontSize: 32, fontWeight: 900, color: "#1a2035", letterSpacing: -0.5 }}>404</h1>
          <p style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800, color: "#1a2035" }}>Página no encontrada</p>
          <p style={{ margin: "0 0 32px", fontSize: 15, color: "#64748b", lineHeight: 1.65 }}>
            El link que seguiste ya no existe o fue movido.<br />
            Explorá el catálogo para encontrar lo que buscás.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href={SITE_URL}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 26px", background: "#d4688e", color: "white", borderRadius: 12, textDecoration: "none", fontSize: 15, fontWeight: 800, boxShadow: "0 4px 18px rgba(212,104,142,0.4)" }}>
              🛒 Ir a la tienda
            </a>
            <a href="javascript:history.back()"
              style={{ display: "flex", alignItems: "center", padding: "13px 22px", background: "white", color: "#374151", border: "1.5px solid #e2e8f0", borderRadius: 12, textDecoration: "none", fontSize: 15, fontWeight: 700 }}>
              ← Volver
            </a>
          </div>
        </div>
      </main>

      <footer style={{ background: "#0d1120", color: "#475569", textAlign: "center", padding: "18px 20px", fontSize: 13 }}>
        <a href={SITE_URL} style={{ color: "#d4688e", textDecoration: "none", fontWeight: 700 }}>VETIX Distribuidora</a>
        {" — "}Distribuidora veterinaria · Pedidos online 24 hs
      </footer>
    </div>
  )
}
