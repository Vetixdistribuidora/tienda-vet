"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Image from "next/image"

export default function ResetPassword() {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)
  const router = useRouter()

  // Supabase dispara PASSWORD_RECOVERY cuando el usuario llega desde el link del email
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true)
    })
    // Si ya hay sesión activa con token de recovery en la URL, también activar
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleReset() {
    setError("")
    if (!password.trim()) { setError("Ingresá una contraseña nueva"); return }
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres"); return }
    if (password !== confirm) { setError("Las contraseñas no coinciden"); return }
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError("No se pudo actualizar la contraseña. Pedí un nuevo link de recuperación."); return }
    setDone(true)
    setTimeout(() => router.push("/"), 3500)
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#e8e4df",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        background: "white",
        borderRadius: 22,
        width: "100%",
        maxWidth: 420,
        boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
        overflow: "hidden",
      }}>

        {/* Header */}
        <div style={{ padding: "28px 32px 22px", background: "#0f172a", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <Image src="/logo vetix.jpeg" alt="VETIX" height={44} width={176} style={{ height: 44, width: "auto" }} priority />
          </div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "white" }}>
            {done ? "¡Contraseña actualizada!" : "Nueva contraseña"}
          </h1>
          <p style={{ margin: "5px 0 0", fontSize: 13, color: "#64748b" }}>
            {done ? "Redirigiendo al inicio..." : "Elegí una contraseña segura para tu cuenta"}
          </p>
        </div>

        {/* Cuerpo */}
        <div style={{ padding: "28px 32px 32px" }}>
          {done ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 64, height: 64, background: "#f0fdf4", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: "2px solid #86efac" }}>
                <svg width="28" height="28" fill="none" strokeWidth="2.5" viewBox="0 0 24 24" stroke="#16a34a">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#1a2035", margin: "0 0 6px" }}>
                Tu contraseña fue actualizada
              </p>
              <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
                En unos segundos te redirigimos a la tienda.
              </p>
            </div>
          ) : !ready ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #d4688e", borderTopColor: "transparent", margin: "0 auto 16px", animation: "spin 0.8s linear infinite" }} />
              <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Verificando el link de recuperación...</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "#374151", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 }}>
                  Nueva contraseña
                </label>
                <input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleReset()}
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                  onFocus={e => (e.target.style.borderColor = "#d4688e")}
                  onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "#374151", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 }}>
                  Repetir contraseña
                </label>
                <input
                  type="password"
                  placeholder="Repetí la contraseña"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleReset()}
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                  onFocus={e => (e.target.style.borderColor = "#d4688e")}
                  onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                />
              </div>
              {error && (
                <p style={{ margin: 0, fontSize: 12, color: "#dc2626", fontWeight: 600, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "9px 13px" }}>
                  ⚠ {error}
                </p>
              )}
              <button
                onClick={handleReset}
                disabled={loading}
                style={{ width: "100%", padding: "13px", background: loading ? "#f9a8d4" : "#d4688e", color: "white", border: "none", borderRadius: 11, fontSize: 14, fontWeight: 900, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 4px 16px rgba(212,104,142,0.4)", marginTop: 4 }}>
                {loading ? "Guardando..." : "Guardar nueva contraseña"}
              </button>
              <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
                <a href="/" style={{ color: "#d4688e", fontWeight: 600, textDecoration: "none" }}>← Volver a la tienda</a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
