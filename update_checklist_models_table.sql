-- 1. Agregar control de vencimiento (frecuencia de inspección) a los modelos de checklist
ALTER TABLE public.hs_checklist_models
ADD COLUMN IF NOT EXISTS inspection_frequency_days INTEGER DEFAULT 30;
