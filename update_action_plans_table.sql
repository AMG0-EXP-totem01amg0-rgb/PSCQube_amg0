ALTER TABLE public.hs_action_plans
ADD COLUMN IF NOT EXISTS checklist_item_id UUID REFERENCES public.hs_checklist_items(id) ON DELETE SET NULL;
