
-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. TABLA DE PERFILES
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    role TEXT CHECK (role IN ('ADMIN', 'SECRETARY', 'DELEGATE')) DEFAULT 'DELEGATE',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLA DE ZONAS
CREATE TABLE IF NOT EXISTS zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    cost_per_meter NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA DE COMERCIANTES
CREATE TABLE IF NOT EXISTS merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name_paterno TEXT NOT NULL,
    last_name_materno TEXT,
    giro TEXT NOT NULL,
    phone TEXT,
    profile_photo_url TEXT,
    ine_photo_url TEXT,
    total_debt NUMERIC DEFAULT 0,
    balance NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'PENDING',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agregar columna full_name de forma segura si no existe
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='merchants' AND column_name='full_name') THEN
        ALTER TABLE merchants ADD COLUMN full_name TEXT GENERATED ALWAYS AS (
          first_name || ' ' || last_name_paterno || ' ' || COALESCE(last_name_materno, '')
        ) STORED;
    END IF;
END $$;

-- 5. TABLA DE ASIGNACIONES
CREATE TABLE IF NOT EXISTS zone_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
    meters NUMERIC NOT NULL DEFAULT 1,
    calculated_cost NUMERIC NOT NULL,
    work_day TEXT DEFAULT 'Diario',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar columna work_day de forma segura
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='zone_assignments' AND column_name='work_day') THEN
        ALTER TABLE zone_assignments ADD COLUMN work_day TEXT DEFAULT 'Diario';
    END IF;
END $$;

-- 6. TABLA DE ABONOS
CREATE TABLE IF NOT EXISTS abonos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    date TIMESTAMPTZ DEFAULT NOW(),
    recorded_by UUID REFERENCES auth.users(id)
);

-- 7. LÓGICA FINANCIERA AUTOMÁTICA (Actualización de balance)
CREATE OR REPLACE FUNCTION refresh_merchant_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_total_debt NUMERIC;
    v_total_paid NUMERIC;
    v_merchant_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN v_merchant_id := OLD.merchant_id;
    ELSE v_merchant_id := NEW.merchant_id;
    END IF;

    SELECT COALESCE(SUM(calculated_cost), 0) INTO v_total_debt FROM zone_assignments WHERE merchant_id = v_merchant_id;
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid FROM abonos WHERE merchant_id = v_merchant_id;

    UPDATE merchants SET 
        total_debt = v_total_debt,
        balance = v_total_debt - v_total_paid,
        status = CASE 
            WHEN (v_total_debt - v_total_paid) <= 0 AND v_total_debt > 0 THEN 'PAID'
            WHEN v_total_paid > 0 THEN 'PARTIAL'
            ELSE 'PENDING'
        END
    WHERE id = v_merchant_id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Re-crear triggers (estos no borran datos)
DROP TRIGGER IF EXISTS trg_recalc_on_assignment ON zone_assignments;
CREATE TRIGGER trg_recalc_on_assignment AFTER INSERT OR UPDATE OR DELETE ON zone_assignments FOR EACH ROW EXECUTE FUNCTION refresh_merchant_balance();

DROP TRIGGER IF EXISTS trg_recalc_on_abono ON abonos;
CREATE TRIGGER trg_recalc_on_abono AFTER INSERT OR UPDATE OR DELETE ON abonos FOR EACH ROW EXECUTE FUNCTION refresh_merchant_balance();

-- 8. TRIGGER DE PERFILES AUTOMÁTICOS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', new.email), 'ADMIN')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. FUNCIÓN RPC PARA DASHBOARD
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_merchants', COUNT(*),
        'total_debt', COALESCE(SUM(total_debt), 0),
        'total_balance', COALESCE(SUM(balance), 0),
        'total_collected', COALESCE(SUM(total_debt - balance), 0)
    ) INTO result
    FROM merchants;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. POLÍTICAS DE SEGURIDAD (RLS)
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE abonos ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Access" ON merchants;
CREATE POLICY "Public Access" ON merchants FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access" ON zones;
CREATE POLICY "Public Access" ON zones FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access" ON zone_assignments;
CREATE POLICY "Public Access" ON zone_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access" ON abonos;
CREATE POLICY "Public Access" ON abonos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access" ON profiles;
CREATE POLICY "Public Access" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 11. POBLAR DATOS INICIALES (Solo si está vacío para evitar duplicados)
INSERT INTO zones (name, cost_per_meter)
SELECT name, cost_per_meter FROM (
    VALUES ('Centro Histórico', 0), ('Mercado Norte', 0), ('Tianguis Domingo', 0)
) AS t(name, cost_per_meter)
WHERE NOT EXISTS (SELECT 1 FROM zones LIMIT 1);

-- 12. PROMOVER USUARIOS EXISTENTES A ADMIN
INSERT INTO public.profiles (id, role, full_name)
SELECT id, 'ADMIN', email
FROM auth.users
ON CONFLICT (id) DO UPDATE SET role = 'ADMIN';
