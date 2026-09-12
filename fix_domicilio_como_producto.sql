-- ============================================================
-- MIGRACIÓN: Domicilio como producto + soporte imágenes en items
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Agregar columna de imagen a cada item del pedido (para cotizaciones)
ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS imagen_url TEXT;

-- 2. Permitir eliminar productos del catálogo aunque ya se hayan usado en pedidos
ALTER TABLE pedido_items DROP CONSTRAINT IF EXISTS pedido_items_producto_id_fkey;
ALTER TABLE pedido_items ADD CONSTRAINT pedido_items_producto_id_fkey
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE SET NULL;

-- 3. Migrar pedidos existentes: convertir su columna domicilio en un item más
--    (solo para pedidos que aún no tengan un item "Domicilio")
INSERT INTO pedido_items (pedido_id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal)
SELECT p.id, NULL, 'Domicilio', 1, COALESCE(p.domicilio,0), COALESCE(p.domicilio,0)
FROM pedidos p
WHERE NOT EXISTS (
  SELECT 1 FROM pedido_items pi WHERE pi.pedido_id = p.id AND pi.nombre_producto = 'Domicilio'
);

-- 4. (Opcional) La columna pedidos.domicilio ya no se usa desde el código.
--    Se deja en la base de datos por seguridad, no es necesario borrarla.
