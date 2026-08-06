import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  images: {
    // Servimos las imágenes directo desde Supabase Storage, sin pasar por el
    // optimizador de Vercel. Con miles de productos se superaba la cuota del
    // plan Hobby (error 402 "Payment required") y las fotos dejaban de cargar.
    // Las imágenes ya vienen livianas desde Storage, así que no hace falta optimizar.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
}

export default nextConfig
