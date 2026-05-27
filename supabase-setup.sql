-- ─────────────────────────────────────────────────────────────────────────
-- TABLAS NUEVAS para la tienda online
-- Correr en Supabase → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Pedidos de clientes
CREATE TABLE IF NOT EXISTS pedidos (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  cliente_nombre  TEXT NOT NULL,
  cliente_email   TEXT,
  cliente_telefono TEXT,
  cliente_direccion TEXT,
  notas        TEXT,
  total        NUMERIC(10, 2),
  estado       TEXT DEFAULT 'pendiente'   -- pendiente | confirmado | entregado | cancelado
);

-- 2. Líneas de cada pedido
CREATE TABLE IF NOT EXISTS pedido_items (
  id              BIGSERIAL PRIMARY KEY,
  pedido_id       BIGINT REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id     BIGINT,
  nombre_producto TEXT,
  precio_unitario NUMERIC(10, 2),
  cantidad        INTEGER,
  subtotal        NUMERIC(10, 2)
);

-- ─────────────────────────────────────────────────────────────────────────
-- RLS: permitir inserts anónimos (clientes sin login)
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE pedidos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_items ENABLE ROW LEVEL SECURITY;

-- Clientes pueden crear pedidos
CREATE POLICY "anon insert pedidos"
  ON pedidos FOR INSERT TO anon WITH CHECK (true);

-- Clientes pueden crear ítems de pedido
CREATE POLICY "anon insert pedido_items"
  ON pedido_items FOR INSERT TO anon WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────
-- Si la tabla "productos" tiene RLS habilitado, asegurate de que
-- los usuarios anónimos puedan leer los productos:
-- ─────────────────────────────────────────────────────────────────────────

-- (Ejecutar solo si aún no existe esta policy)
-- CREATE POLICY "anon read productos"
--   ON productos FOR SELECT TO anon USING (true);
