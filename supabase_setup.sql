
-- 1. Agregar columnas de logística a la tabla merchants
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS ready_for_admin BOOLEAN DEFAULT false;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS admin_received BOOLEAN DEFAULT false;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS admin_received_at TIMESTAMPTZ;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS delivery_count INTEGER DEFAULT 0;

-- 2. Asegurar que el campo status sea consistente con el balance
-- (Opcional, pero ayuda a la lógica de secretaría)
CREATE OR REPLACE FUNCTION update_merchant_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.balance <= 0 THEN
    NEW.status := 'PAID';
  ELSIF NEW.balance < NEW.total_debt THEN
    NEW.status := 'PARTIAL';
  ELSE
    NEW.status := 'PENDING';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_update_status ON merchants;
CREATE TRIGGER tr_update_status
BEFORE INSERT OR UPDATE OF balance, total_debt ON merchants
FOR EACH ROW EXECUTE FUNCTION update_merchant_status();

-- 3. Configurar RLS (Row Level Security) para permitir actualizaciones de logística
-- Permitir que usuarios con rol SECRETARY o ADMIN actualicen ready_for_admin
DROP POLICY IF EXISTS "Permitir actualización de logística a Secretaria y Admin" ON merchants;
CREATE POLICY "Permitir actualización de logística a Secretaria y Admin" 
ON merchants 
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (
  -- Solo permitir a secretaría cambiar campos específicos de logística
  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'SECRETARY' OR role = 'ADMIN')))
);

-- 4. Índices para mejorar la velocidad de búsqueda de logística
CREATE INDEX IF NOT EXISTS idx_merchants_logistics ON merchants(ready_for_admin, admin_received);
