-- 1. Crear la tabla hs_object_types
CREATE TABLE IF NOT EXISTS public.hs_object_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    inspection_frequency_days INTEGER DEFAULT 30,
    icon_name TEXT DEFAULT 'ShieldAlert',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar RLS (Row Level Security) y crear política pública temporal para acceso total
ALTER TABLE public.hs_object_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users or public" ON public.hs_object_types
    FOR ALL USING (true) WITH CHECK (true);

-- 3. Insertar los Tipos de Objetos Predefinidos (Seed Data)
INSERT INTO public.hs_object_types (id, name, code, description, inspection_frequency_days, icon_name)
VALUES 
    ('EXT', 'Extintor PQS / CO2', 'EXT', 'Extintores portátiles de polvo químico seco o CO2', 30, 'ShieldAlert'),
    ('BOT', 'Botiquín de Primeros Auxilios', 'BOT', 'Estaciones de primeros auxilios fijas y portátiles', 15, 'Cross'),
    ('HID', 'Nicho Hidrante', 'HID', 'Gabinete con manguera, lanza y válvula de incendio', 30, 'Flame'),
    ('DUCH', 'Ducha y Lavaojos de Emergencia', 'DUCH', 'Estaciones lavaojos y duchas de descontaminación', 7, 'Droplet'),
    ('CAM', 'Camilla de Emergencia', 'CAM', 'Camilla rígida con sujetadores y cuello ortopédico', 30, 'Activity')
ON CONFLICT (id) DO NOTHING;
