
-- FUNCIÓN RPC PARA CIERRE DE AUDITORÍA ATÓMICO (Lado del Servidor)
-- Esta función asegura que el saldo se congele y las zonas se borren en una sola operación.
CREATE OR REPLACE FUNCTION close_merchant_audit(p_merchant_id UUID)
RETURNS void AS $$
DECLARE
  v_total_abonado NUMERIC;
  v_current_balance NUMERIC;
BEGIN
  -- 1. Calcular el total abonado histórico real desde la tabla de abonos
  SELECT COALESCE(SUM(amount), 0) INTO v_total_abonado
  FROM abonos
  WHERE merchant_id = p_merchant_id;

  -- 2. Obtener el balance actual del comerciante antes de limpiar
  SELECT balance INTO v_current_balance
  FROM merchants
  WHERE id = p_merchant_id;

  -- 3. Actualizar el comerciante:
  -- - carry_over_debt: Congelamos el saldo pendiente como deuda de arrastre.
  -- - total_debt: Ajustamos sumando lo abonado + el arrastre para mantener coherencia.
  -- - admin_received: Reiniciamos para el nuevo ciclo logístico.
  UPDATE merchants
  SET
    carry_over_debt = v_current_balance,
    total_debt = v_total_abonado + v_current_balance,
    balance = v_current_balance, -- El saldo se mantiene igual pero ahora es puro arrastre
    admin_received = false,
    admin_received_at = NULL
  WHERE id = p_merchant_id;

  -- 4. Eliminar las asignaciones de zona para permitir un nuevo expediente limpio
  DELETE FROM zone_assignments
  WHERE merchant_id = p_merchant_id;

END;
$$ LANGUAGE plpgsql;
