# Rediseño de Vista de Planes de Acción y Modal

## User Review Required

Documentación de los cambios estructurales solicitados para la vista de Planes de Acción:
1. **Navegación**: Se eliminará el selector desplegable de estados. La navegación entre "Críticos", "En Proceso" y "Resueltos" se hará exclusivamente haciendo clic en las 3 tarjetas (KPI) superiores.
2. **Vista Críticos (Agrupada)**: En lugar de una lista plana, los planes Críticos se agruparán por **Tipo de Objeto** (Ej. Extintor, Botiquín) y mostrarán métricas extraídas de la inspección original (Total de preguntas, Cuántas fallaron, Cuántas fueron críticas). Al hacer clic en un objeto, se desplegarán sus tareas correspondientes.
3. **Edición de Fecha Límite**: En el Modal de Acción, se añadirá un campo para poder modificar la Fecha Límite (Due Date) asignada a la tarea.

## Proposed Changes

### 1. `src/components/hs/HSModuleView.tsx`

#### [MODIFY] HSModuleView.tsx
- Pasar las props adicionales `inspections`, `objects` y `objectTypes` al componente `HSActionPlansView` para poder calcular las métricas (total de preguntas de la inspección original y poder agrupar por tipo de activo).
- Pasar una nueva función `onUpdatePlan` para actualizar fechas.

### 2. `src/components/hs/useHSModule.ts`

#### [MODIFY] useHSModule.ts
- Actualizar la función `updateActionPlanStatus` para que soporte la actualización del campo `due_date` (Fecha Límite) en Supabase y en el estado local.

### 3. `src/components/hs/action-plans/HSActionPlansView.tsx`

#### [MODIFY] HSActionPlansView.tsx
- **Filtros**: Eliminar el `<select>` de estados. Mantener solo el filtro de fecha.
- **Vista Críticos**: Si el filtro activo es "CRITICAL", procesar los `criticalPlans` para agruparlos por `objectTypeId` utilizando la prop `objects` y `objectTypes`.
- Calcular para cada objeto el total de preguntas (buscando la inspección con `inspectionId`), cuántas fallaron (NO_OK) y cuántas fueron críticas.
- Renderizar esta información en una tabla agrupada con filas expandibles.

### 4. `src/components/hs/action-plans/ActionPlanModal.tsx`

#### [MODIFY] ActionPlanModal.tsx
- En el Bloque 2 (Plan de Acción y Resolución), agregar un campo `<input type="date">` vinculado al estado local `dueDate`.
- Al guardar (En Proceso / Resuelto), enviar la nueva fecha seleccionada para que se actualice en la base de datos.

## Verification Plan

- Navegar al Tab de Planes de Acción.
- Verificar que el dropdown de estados ya no está, y que las 3 tarjetas sirven de navegación.
- Hacer clic en "Críticos" y validar que se visualiza la tabla agrupada por tipo de activo con la estadística correcta.
- Abrir un plan crítico, modificar la Fecha Límite, guardar y verificar en el Kanban/Lista que la fecha se haya actualizado correctamente.
