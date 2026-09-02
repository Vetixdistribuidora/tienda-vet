-- ══════════════════════════════════════════════════════════════════════════
-- FIX: ocultar costo/margen (y demás internos) al rol anónimo en productos
-- Correr en Supabase → SQL Editor.
--
-- Por qué: anon tenía SELECT a NIVEL DE TABLA (todas las columnas), y un
-- REVOKE de columnas puntuales no lo reduce. La forma correcta es quitar el
-- permiso de tabla y volver a otorgar SOLO las columnas del catálogo.
--
-- Columnas internas que quedan ocultas a anon: costo, margen, flete, perdida,
-- excluir_stats, organizacion_id.
-- No toca a `authenticated`: el staff (con organización) sigue viendo todo, y
-- el cliente de tienda igual no puede leer la tabla directo (lo bloquea org_isolation).
-- El catálogo se sirve por el RPC catalogo_tienda y por estas columnas seguras.
-- ══════════════════════════════════════════════════════════════════════════

REVOKE SELECT ON productos FROM anon;

GRANT SELECT (
  id, nombre, precio_venta, stock,
  categoria, subcategoria, laboratorio,
  imagen_url, oculto_tienda
) ON productos TO anon;

-- ── Verificación (con la ANON key, después de correr) ─────────────────────
--   productos?select=nombre,precio_venta  → OK (catálogo)
--   productos?select=costo                → error 42501 permiso denegado
--   productos?select=margen               → error 42501 permiso denegado
