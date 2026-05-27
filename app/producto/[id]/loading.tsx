export default function LoadingProducto() {
  return (
    <div style={{ minHeight: "100vh", background: "#f5f7fb", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>

      {/* Header skeleton */}
      <header style={{ background: "#0f172a", padding: "0 20px", height: 64, display: "flex", alignItems: "center", gap: 16, boxShadow: "0 2px 20px rgba(0,0,0,0.4)" }}>
        <div style={{ width: 120, height: 36, background: "rgba(255,255,255,0.08)", borderRadius: 8 }} />
      </header>

      {/* Breadcrumb skeleton */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "14px 20px 0", display: "flex", gap: 8 }}>
        <div style={{ width: 40, height: 14, background: "#e2e8f0", borderRadius: 4 }} />
        <div style={{ width: 6, height: 14, background: "#e2e8f0", borderRadius: 4 }} />
        <div style={{ width: 100, height: 14, background: "#e2e8f0", borderRadius: 4 }} />
      </div>

      {/* Card skeleton */}
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "20px 20px 60px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: "white", borderRadius: 22, border: "1px solid #eaecf2", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>

          {/* Imagen */}
          <div style={{ background: "#f7f8fb", minHeight: 340, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="skeleton" style={{ width: "70%", height: 220, borderRadius: 12 }} />
          </div>

          {/* Info */}
          <div style={{ padding: "32px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <div className="skeleton" style={{ width: 80, height: 22, borderRadius: 20 }} />
              <div className="skeleton" style={{ width: 70, height: 22, borderRadius: 20 }} />
            </div>
            <div>
              <div className="skeleton" style={{ height: 26, borderRadius: 6, marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 26, width: "70%", borderRadius: 6 }} />
            </div>
            <div>
              <div className="skeleton" style={{ height: 12, width: 120, borderRadius: 4, marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 40, width: 160, borderRadius: 6 }} />
            </div>
            <div style={{ background: "#f8fafc", borderRadius: 12, padding: "14px 16px", border: "1px solid #eaecf2", display: "flex", flexDirection: "column", gap: 10 }}>
              {[90, 100, 80].map((w, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                  <div className="skeleton" style={{ width: `${w * 0.5}%`, height: 13, borderRadius: 4 }} />
                  <div className="skeleton" style={{ width: `${w * 0.4}%`, height: 13, borderRadius: 4 }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: "auto" }}>
              <div className="skeleton" style={{ height: 48, borderRadius: 12 }} />
              <div className="skeleton" style={{ height: 44, borderRadius: 12 }} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
