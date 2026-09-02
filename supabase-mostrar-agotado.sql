-- ══════════════════════════════════════════════════════════════════════════
-- Marca "mostrar aunque no haya stock" por producto (vitrina)
-- Correr en Supabase → SQL Editor. Aditivo y seguro.
--
-- Arranca en FALSE para TODOS los productos → la tienda queda igual que ahora,
-- no aparece nada nuevo. Solo los que marques como true (desde el admin) se
-- van a mostrar siempre, con su cartel "Sin stock".
-- No toca el RPC catalogo_tienda ni el RLS.
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS mostrar_agotado BOOLEAN DEFAULT false;
