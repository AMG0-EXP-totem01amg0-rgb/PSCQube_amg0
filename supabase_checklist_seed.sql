-- LIMPIEZA PREVIA OPCIONAL
-- Descomenta las siguientes líneas si deseas borrar los modelos y preguntas actuales antes de cargar los nuevos:
-- DELETE FROM public.hs_checklist_items;
-- DELETE FROM public.hs_checklist_models;

-- INSERT DE MODELOS DE CHECKLIST
INSERT INTO public.hs_checklist_models (id, object_type_id, name, status)
VALUES 
  -- Extintor
  ('a1000000-0000-0000-0000-000000000001', 'EXT', 'Control Mensual', 'ACTIVE'),
  ('a1000000-0000-0000-0000-000000000002', 'EXT', 'Inspección Trimestral', 'ACTIVE'),
  
  -- Botiquín
  ('a1000000-0000-0000-0000-000000000003', 'BOT', 'Revisión Semanal de Insumos', 'ACTIVE'),
  
  -- Camilla
  ('a1000000-0000-0000-0000-000000000004', 'CAM', 'Control de Estado Mensual', 'ACTIVE'),
  
  -- Nicho Hidrante
  ('a1000000-0000-0000-0000-000000000005', 'HID', 'Inspección General', 'ACTIVE'),
  
  -- Ducha y Lavaojos
  ('a1000000-0000-0000-0000-000000000006', 'DUCH', 'Control de Flujo Semanal', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;


-- INSERT DE ÍTEMS / PREGUNTAS
INSERT INTO public.hs_checklist_items (object_type, checklist_model_id, description, item_order, is_critical, is_enabled)
VALUES
  -- Preguntas: Extintor - Control Mensual
  ('EXT', 'a1000000-0000-0000-0000-000000000001', 'Manómetro indica presión en rango correcto (zona verde)', 1, true, true),
  ('EXT', 'a1000000-0000-0000-0000-000000000001', 'Precinto de seguridad y pasador intactos', 2, true, true),
  ('EXT', 'a1000000-0000-0000-0000-000000000001', 'Manguera y boquilla en buen estado (sin obstrucciones)', 3, false, true),
  ('EXT', 'a1000000-0000-0000-0000-000000000001', 'Etiqueta legible y fecha de vencimiento vigente', 4, false, true),
  ('EXT', 'a1000000-0000-0000-0000-000000000001', 'El extintor está en su ubicación designada y sin obstrucciones', 5, false, true),

  -- Preguntas: Extintor - Inspección Trimestral
  ('EXT', 'a1000000-0000-0000-0000-000000000002', 'Prueba de peso/manga verifica que no hay pérdida de agente', 1, true, true),
  ('EXT', 'a1000000-0000-0000-0000-000000000002', 'Cilindro sin corrosión, abolladuras o desgaste físico', 2, true, true),
  ('EXT', 'a1000000-0000-0000-0000-000000000002', 'Soporte a la pared firme y estable', 3, false, true),
  ('EXT', 'a1000000-0000-0000-0000-000000000002', 'Válvulas y palanca de accionamiento funcionan sin trabas', 4, true, true),

  -- Preguntas: Botiquín - Revisión Semanal
  ('BOT', 'a1000000-0000-0000-0000-000000000003', 'Contiene stock mínimo requerido de vendajes y apósitos', 1, false, true),
  ('BOT', 'a1000000-0000-0000-0000-000000000003', 'Medicamentos (si aplica) dentro de la fecha de caducidad', 2, true, true),
  ('BOT', 'a1000000-0000-0000-0000-000000000003', 'No hay elementos de uso abierto o contaminados', 3, true, true),
  ('BOT', 'a1000000-0000-0000-0000-000000000003', 'El botiquín está cerrado, limpio y de fácil acceso', 4, false, true),

  -- Preguntas: Camilla - Control Mensual
  ('CAM', 'a1000000-0000-0000-0000-000000000004', 'Estructura rígida de la camilla sin fisuras ni daños', 1, true, true),
  ('CAM', 'a1000000-0000-0000-0000-000000000004', 'Correas de sujeción (tipo araña) presentes y sin roturas', 2, true, true),
  ('CAM', 'a1000000-0000-0000-0000-000000000004', 'Cuello ortopédico e inmovilizadores laterales presentes', 3, true, true),
  ('CAM', 'a1000000-0000-0000-0000-000000000004', 'Gabinete protector cerrado y señalizado correctamente', 4, false, true),

  -- Preguntas: Nicho Hidrante - Inspección General
  ('HID', 'a1000000-0000-0000-0000-000000000005', 'Llave de paso (válvula) libre de óxido y de fácil apertura', 1, true, true),
  ('HID', 'a1000000-0000-0000-0000-000000000005', 'Manguera debidamente plegada o enrollada', 2, false, true),
  ('HID', 'a1000000-0000-0000-0000-000000000005', 'Lanza y boquilla conectadas sin daños estructurales', 3, true, true),
  ('HID', 'a1000000-0000-0000-0000-000000000005', 'Vidrio del gabinete intacto y llave de apertura disponible', 4, false, true),

  -- Preguntas: Ducha y Lavaojos - Control de Flujo Semanal
  ('DUCH', 'a1000000-0000-0000-0000-000000000006', 'Presión de agua adecuada al activar el lavaojos', 1, true, true),
  ('DUCH', 'a1000000-0000-0000-0000-000000000006', 'Presión de agua adecuada al activar la ducha', 2, true, true),
  ('DUCH', 'a1000000-0000-0000-0000-000000000006', 'El agua sale limpia (libre de óxido/sedimentos)', 3, true, true),
  ('DUCH', 'a1000000-0000-0000-0000-000000000006', 'El desagüe funciona correctamente sin estancamientos', 4, false, true);
