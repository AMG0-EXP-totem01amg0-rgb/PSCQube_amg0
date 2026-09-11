-- Crear tabla para Modelos de Checklist (Nivel 2)
CREATE TABLE public.hs_checklist_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    object_type_id text NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Modificar tabla hs_checklist_items para incluir referencia opcional al modelo
ALTER TABLE public.hs_checklist_items
ADD COLUMN checklist_model_id uuid REFERENCES public.hs_checklist_models(id) ON DELETE CASCADE;

-- Indexar para optimizar las consultas (opcional pero recomendado)
CREATE INDEX IF NOT EXISTS idx_hs_checklist_models_object_type 
    ON public.hs_checklist_models(object_type_id);

CREATE INDEX IF NOT EXISTS idx_hs_checklist_items_model_id 
    ON public.hs_checklist_items(checklist_model_id);

-- Configurar RLS si está habilitado (Ajustar según necesidad o políticas previas)
-- ALTER TABLE public.hs_checklist_models ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Permitir todo a usuarios autenticados" ON public.hs_checklist_models FOR ALL USING (auth.role() = 'authenticated');
