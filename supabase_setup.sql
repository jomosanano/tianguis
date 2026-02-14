
-- 1. Asegurar que la columna de reset existe en comerciantes
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS balance_reset_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Añadir columna de archivado en abonos
ALTER TABLE abonos ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- 3. Función maestra de recalculación REFORZADA
CREATE OR REPLACE FUNCTION sync_merchant_debt_and_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_merchant_id UUID;
  v_reset_date TIMESTAMPTZ;
  v_costo_zonas NUMERIC;
  v_total_abonos_activos NUMERIC;
BEGIN
  -- Determinar el ID del comerciante afectado
  v_merchant_id := COALESCE(NEW.merchant_id, OLD.merchant_id);

  -- 1. Obtener la fecha de reset (Punto de Corte)
  SELECT COALESCE(balance_reset_at, created_at) INTO v_reset_date 
  FROM merchants 
  WHERE id = v_merchant_id
  FOR NO KEY UPDATE; -- Bloqueo para evitar lecturas sucias

  -- 2. Calcular la Deuda Total (Zonas)
  SELECT COALESCE(SUM(calculated_cost), 0) INTO v_costo_zonas
  FROM zone_assignments 
  WHERE merchant_id = v_merchant_id;

  -- 3. Calcular Abonos ACTIVOS (No archivados y posteriores al reset)
  SELECT COALESCE(SUM(amount), 0) INTO v_total_abonos_activos
  FROM abonos 
  WHERE merchant_id = v_merchant_id 
  AND archived = false 
  AND date > v_reset_date;

  -- 4. Actualizar el registro del comerciante
  UPDATE merchants 
  SET 
    total_debt = v_costo_zonas,
    balance = v_costo_zonas - v_total_abonos_activos
  WHERE id = v_merchant_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4. Re-vincular triggers
DROP TRIGGER IF EXISTS tr_sync_debt_zones ON zone_assignments;
CREATE TRIGGER tr_sync_debt_zones
AFTER INSERT OR UPDATE OR DELETE ON zone_assignments
FOR EACH ROW EXECUTE FUNCTION sync_merchant_debt_and_balance();

DROP TRIGGER IF EXISTS tr_sync_debt_abonos ON abonos;
CREATE TRIGGER tr_sync_debt_abonos
AFTER INSERT OR UPDATE OR DELETE ON abonos
FOR EACH ROW EXECUTE FUNCTION sync_merchant_debt_and_balance();
