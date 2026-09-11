-- Agregar columna status a hs_checklist_models si no existe
ALTER TABLE public.hs_checklist_models
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ACTIVE';
