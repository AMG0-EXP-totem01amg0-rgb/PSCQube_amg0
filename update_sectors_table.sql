-- 1. Agregar las nuevas columnas a la tabla sectors
ALTER TABLE public.sectors
ADD COLUMN IF NOT EXISTS responsible_person TEXT,
ADD COLUMN IF NOT EXISTS location_details TEXT;

-- (Opcional) Si ya no vas a usar el código (code) y quieres borrar la columna, descomenta la siguiente línea:
-- ALTER TABLE public.sectors DROP COLUMN IF EXISTS code;
