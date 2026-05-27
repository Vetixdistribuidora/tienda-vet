-- Agregar columna subcategoria a productos
-- Ejecutar en Supabase → SQL Editor

ALTER TABLE productos ADD COLUMN IF NOT EXISTS subcategoria TEXT;
