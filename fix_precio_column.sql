-- ============================================================
-- FIX: Agregar columna de precio a productos
-- Ejecutar en Supabase SQL Editor
-- ============================================================

ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio NUMERIC(12,2) DEFAULT 0;

-- Opcional: asigna precios iniciales a tus productos existentes
-- Ajusta los valores según tu lista de precios real
UPDATE productos SET precio = 8000  WHERE nombre = 'Combo 200g Natilla';
UPDATE productos SET precio = 12000 WHERE nombre = 'Combo Bolsa';
UPDATE productos SET precio = 9000  WHERE nombre = 'Fresas con Crema 200g';
UPDATE productos SET precio = 7000  WHERE nombre = 'Manjar Blanco 100g';
UPDATE productos SET precio = 10000 WHERE nombre = 'Manjar + Natilla 100g';
UPDATE productos SET precio = 25000 WHERE nombre = 'Combo 10 Hojuelas';
UPDATE productos SET precio = 18000 WHERE nombre = 'Natilla 500g';
UPDATE productos SET precio = 32000 WHERE nombre = 'Natilla 1kg';
UPDATE productos SET precio = 20000 WHERE nombre = 'Fresas con Crema 500g';
UPDATE productos SET precio = 36000 WHERE nombre = 'Fresas con Crema 1kg';
