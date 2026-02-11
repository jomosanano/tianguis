
-- ... (mismo contenido anterior) ...

-- 11. TABLA DE CONFIGURACIÓN GLOBAL
CREATE TABLE IF NOT EXISTS system_settings (
    id TEXT PRIMARY KEY DEFAULT 'global_config',
    logo_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar fila inicial si no existe
INSERT INTO system_settings (id) VALUES ('global_config') ON CONFLICT DO NOTHING;

-- Habilitar RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acceso público lectura" ON system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Solo admin actualiza" ON system_settings FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
