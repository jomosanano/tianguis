
-- 1. Añadir columna de archivado a abonos
ALTER TABLE abonos ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- 2. Añadir columna para guardar rastro de deuda anterior en el comerciante
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS last_cycle_debt DECIMAL(12,2) DEFAULT 0;

-- 3. Función optimizada para calcular saldo ignorando abonos archivados
CREATE OR REPLACE FUNCTION calculate_merchant_balance()
RETURNS TRIGGER AS $$
DECLARE
    total_paid DECIMAL(12,2);
    current_debt DECIMAL(12,2);
BEGIN
    -- Obtener la deuda actual definida en el comerciante
    SELECT total_debt INTO current_debt FROM merchants WHERE id = COALESCE(NEW.merchant_id, OLD.merchant_id);
    
    -- Sumar solo abonos NO archivados
    SELECT COALESCE(SUM(amount), 0) INTO total_paid 
    FROM abonos 
    WHERE merchant_id = COALESCE(NEW.merchant_id, OLD.merchant_id) AND archived = false;

    -- Actualizar el balance del comerciante
    UPDATE merchants 
    SET balance = current_debt - total_paid 
    WHERE id = COALESCE(NEW.merchant_id, OLD.merchant_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Triggers para mantener el balance sincronizado
DROP TRIGGER IF EXISTS tr_refresh_balance_on_abono ON abonos;
CREATE TRIGGER tr_refresh_balance_on_abono
AFTER INSERT OR UPDATE OR DELETE ON abonos
FOR EACH ROW EXECUTE FUNCTION calculate_merchant_balance();

-- 5. Trigger adicional para cuando se cambia la deuda total manualmente
CREATE OR REPLACE FUNCTION refresh_balance_on_debt_change()
RETURNS TRIGGER AS $$
DECLARE
    total_paid DECIMAL(12,2);
BEGIN
    IF (OLD.total_debt IS DISTINCT FROM NEW.total_debt) THEN
        SELECT COALESCE(SUM(amount), 0) INTO total_paid 
        FROM abonos 
        WHERE merchant_id = NEW.id AND archived = false;
        
        NEW.balance := NEW.total_debt - total_paid;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_debt_change ON merchants;
CREATE TRIGGER tr_debt_change
BEFORE UPDATE ON merchants
FOR EACH ROW EXECUTE FUNCTION refresh_balance_on_debt_change();
