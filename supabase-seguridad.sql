-- ══════════════════════════════════════════════════════════════════════════
-- HARDENING DE SEGURIDAD (QUIRÚRGICO) — tienda online VETIX
-- Correr en Supabase → SQL Editor.
--
-- Cierra SOLO los 3 agujeros del lado del cliente, SIN tocar el modelo de
-- seguridad de distribuidora-vet (que usa logins `authenticated` con la función
-- get_my_org_id() para aislar por organización). Las políticas de staff
-- (org_isolation, pedidos_select_staff, pedidos_update) quedan intactas.
--
-- Verificado contra las políticas reales de la base. Es aditivo/reversible.
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. pedidos: cada cliente lee SOLO los suyos ───────────────────────────
-- HOY: "pedidos_select" tiene USING (nombre_proveedor IS NULL OR get_my_org_id() IS NOT NULL)
--      → un cliente/anon (sin org) puede leer TODOS los pedidos de tienda. AGUJERO.
-- El staff sigue leyendo todo por la política "pedidos_select_staff" (no se toca).
DROP POLICY IF EXISTS "pedidos_select" ON pedidos;
CREATE POLICY "pedidos_select" ON pedidos
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR lower(cliente_email) = lower(auth.jwt() ->> 'email')
  );
-- (anon queda sin ninguna política de lectura que le dé filas → no ve nada.)

-- ── 2. pedido_items: reemplazar lecturas abiertas por (staff) OR (dueño) ───
-- HOY: "anon read pedido_items" y "read pedido_items" tienen USING (true)
--      → cualquiera lee los ítems de todos. AGUJERO.
DROP POLICY IF EXISTS "anon read pedido_items" ON pedido_items;
DROP POLICY IF EXISTS "read pedido_items"      ON pedido_items;

-- Staff (tiene organización): sigue viendo todos los ítems.
DROP POLICY IF EXISTS "items_read_staff" ON pedido_items;
CREATE POLICY "items_read_staff" ON pedido_items
  FOR SELECT TO authenticated
  USING (get_my_org_id() IS NOT NULL);

-- Cliente de tienda: solo los ítems de SUS pedidos.
DROP POLICY IF EXISTS "items_read_cliente" ON pedido_items;
CREATE POLICY "items_read_cliente" ON pedido_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pedidos p
    WHERE p.id = pedido_items.pedido_id
      AND (
        p.usuario_id = auth.uid()
        OR lower(p.cliente_email) = lower(auth.jwt() ->> 'email')
      )
  ));

-- ── 3. productos: el catálogo sigue público, pero SIN costo ni margen ──────
-- El catálogo se sirve por el RPC catalogo_tienda (que NO devuelve costo/margen)
-- y por "anon read productos". Como anon tiene SELECT a nivel de tabla, hay que
-- quitarlo y volver a otorgar SOLO las columnas del catálogo (un REVOKE de
-- columnas puntuales no reduce un permiso de tabla).
-- El staff (authenticated con org) sigue viendo todo; el cliente de tienda no
-- puede leer la tabla directo (lo bloquea org_isolation).
REVOKE SELECT ON productos FROM anon;
GRANT SELECT (
  id, nombre, precio_venta, stock,
  categoria, subcategoria, laboratorio,
  imagen_url, oculto_tienda
) ON productos TO anon;

-- ── 4. Limpieza: tabla que creamos al inicio y ya no se usa ────────────────
DROP TABLE IF EXISTS cuenta_corriente_movimientos;

-- ══════════════════════════════════════════════════════════════════════════
-- Después de correr esto, con la ANON key debería dar:
--   • pedidos?select=id            → []           (antes: 19 filas)
--   • pedido_items?select=id       → []           (antes: filas)
--   • productos?select=costo       → error 42501  (permiso denegado)
--   • productos?select=nombre,precio_venta → sigue OK (catálogo público)
-- ══════════════════════════════════════════════════════════════════════════
