
-- ... (mismo contenido anterior) ...

-- 12. COLUMNAS LOGÍSTICAS EN MERCHANTS
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS admin_received BOOLEAN DEFAULT FALSE;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS admin_received_at TIMESTAMPTZ;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS delivery_count INTEGER DEFAULT 0;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS note TEXT;

-- Actualizar políticas si es necesario para permitir a secretaria editar solo estos campos
