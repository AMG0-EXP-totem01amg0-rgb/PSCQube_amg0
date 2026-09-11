-- 1. Agregar las nuevas columnas a la tabla hs_objects
ALTER TABLE public.hs_objects
ADD COLUMN IF NOT EXISTS location_detail TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;
