import type { Metadata } from "next"
import "./globals.css"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "VETIX — Tienda Veterinaria Online",
    template: "%s | VETIX Distribuidora",
  },
  description:
    "Distribuidora veterinaria al por mayor. Medicamentos, vacunas, alimentos balanceados, antiparasitarios y más. Pedidos online las 24 hs — te contactamos para coordinar.",
  keywords: [
    "distribuidora veterinaria",
    "productos veterinarios",
    "medicamentos veterinarios",
    "vacunas animales",
    "alimento balanceado mayorista",
    "antiparasitarios",
    "pet shop mayorista",
    "VETIX",
  ],
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: SITE_URL,
    siteName: "VETIX Distribuidora Veterinaria",
    title: "VETIX — Tienda Veterinaria Online",
    description:
      "Distribuidora veterinaria al por mayor. Medicamentos, vacunas, alimentos y accesorios. Pedidos online las 24 hs.",
    images: [
      {
        url: `${SITE_URL}/logo.png`,
        width: 800,
        height: 200,
        alt: "VETIX Distribuidora Veterinaria",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "VETIX — Tienda Veterinaria Online",
    description: "Distribuidora veterinaria al por mayor. Pedidos online las 24 hs.",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    icon: { url: "/logo.png", type: "image/png" },
    apple: "/logo.png",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#d4688e" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="VETIX" />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          background: "#c8c8c8",
        }}
      >
        {children}
      </body>
    </html>
  )
}
