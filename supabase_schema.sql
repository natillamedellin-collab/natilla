-- ============================================================
-- NATILLA MEDELLÍN v2 — Ejecutar en Supabase SQL Editor
-- ============================================================

-- Configuración del negocio
CREATE TABLE IF NOT EXISTS configuracion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_negocio TEXT DEFAULT 'Natilla Medellín',
  nit TEXT,
  direccion TEXT,
  telefono TEXT,
  email TEXT,
  mensaje TEXT DEFAULT 'Calidad, frescura y cumplimiento',
  whatsapp TEXT DEFAULT '573195122754',
  logo_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Productos
CREATE TABLE IF NOT EXISTS productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  imagen_url TEXT,
  activo BOOLEAN DEFAULT true,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Domiciliarios
CREATE TABLE IF NOT EXISTS domiciliarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  telefono TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consecutivo SERIAL,
  email TEXT,
  nombre_empresa TEXT NOT NULL,
  tipo_documento TEXT,
  numero_documento TEXT,
  nombre_contacto TEXT NOT NULL,
  telefono TEXT NOT NULL,
  direccion TEXT NOT NULL,
  fecha_entrega DATE NOT NULL,
  hora_entrega TIME,
  observaciones TEXT,
  tiene_anticipo BOOLEAN DEFAULT false,
  estado TEXT DEFAULT 'Recibido' CHECK (estado IN ('Recibido','En producción','Despachado','Entregado','Cancelado')),
  domiciliario_id UUID REFERENCES domiciliarios(id),
  fecha_registro TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Items de cada pedido
CREATE TABLE IF NOT EXISTS pedido_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES productos(id),
  nombre_producto TEXT NOT NULL,
  cantidad INTEGER NOT NULL,
  precio_unitario NUMERIC(12,2) DEFAULT 0,
  subtotal NUMERIC(12,2) DEFAULT 0
);

-- Pagos
CREATE TABLE IF NOT EXISTS pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  tipo TEXT CHECK (tipo IN ('Anticipo','Pago Normal')) NOT NULL,
  metodo TEXT CHECK (metodo IN ('Efectivo','Transferencia')) NOT NULL,
  monto NUMERIC(12,2) NOT NULL,
  referencia TEXT,
  nota TEXT,
  fecha_pago TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos(fecha_entrega);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_items_pedido ON pedido_items(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pagos_pedido ON pagos(pedido_id);

-- RLS
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE domiciliarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all" ON configuracion FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON productos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON domiciliarios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON pedidos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON pedido_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON pagos FOR ALL USING (true) WITH CHECK (true);

-- Supabase Storage bucket para imágenes de productos
INSERT INTO storage.buckets (id, name, public) VALUES ('productos', 'productos', true) ON CONFLICT DO NOTHING;
CREATE POLICY "public_storage" ON storage.objects FOR ALL USING (bucket_id = 'productos') WITH CHECK (bucket_id = 'productos');

-- Datos iniciales
INSERT INTO configuracion (nombre_negocio, nit, direccion, telefono, email, whatsapp, mensaje)
VALUES ('Natilla Medellín','437492238','Diagonal 32 # 34D sur 31','3203711380','natillamedellin@gmail.com','573195122754','Calidad, frescura y cumplimiento. ¡Gracias por preferirnos!')
ON CONFLICT DO NOTHING;

INSERT INTO domiciliarios (nombre) VALUES ('ACLX') ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, orden) VALUES
  ('Combo 200g Natilla','Natilla tradicional porción personal',1),
  ('Combo Bolsa','Natilla + fresas con crema en bolsa',2),
  ('Fresas con Crema 200g','Fresas frescas con crema porción personal',3),
  ('Manjar Blanco 100g','Combo manjar blanco porción 100g',4),
  ('Manjar + Natilla 100g','Combo doble porción 100g',5),
  ('Combo 10 Hojuelas','Natilla en presentación de 10 hojuelas',6),
  ('Natilla 500g','Natilla mediana para 2-3 personas',7),
  ('Natilla 1kg','Natilla familiar',8),
  ('Fresas con Crema 500g','Fresas con crema porción mediana',9),
  ('Fresas con Crema 1kg','Fresas con crema porción familiar',10)
ON CONFLICT DO NOTHING;
