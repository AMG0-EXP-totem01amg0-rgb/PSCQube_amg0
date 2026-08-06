# Migración a Next.js (Vercel)

Para mover esta aplicación a Next.js, sigue estos pasos:

1.  **Instalación inicial:**
    `npx create-next-app@latest my-app --typescript --tailwind --eslint`

2.  **Dependencias:**
    Instala las librerías necesarias en tu nuevo proyecto:
    `npm install recharts date-fns motion clsx tailwind-merge lucide-react`

3.  **Configuración de Estilos:**
    Copia el contenido de `src/index.css` a `app/globals.css`.
    Asegúrate de agregar la configuración del `@theme` en tu archivo `tailwind.config` si usas la versión 3 de Tailwind, o mantén el archivo CSS nuevo si usas la versión 4.

4.  **Componentes Client-Side:**
    Dado que usamos muchos hooks (`useState`, `useMemo`) y librerías interactivas (`recharts`, `motion`), recuerda agregar la directiva `'use client';` al principio de tu archivo `App.tsx` (que en Next.js podrías renombrar a `app/page.tsx` o un componente dentro de `components/Dashboard.tsx`).

5.  **Variables de Entorno en Vercel:**
    Cuando decidas conectar con la base de datos (Supabase o Sheets):
    -   Configura las variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en el dashboard de Vercel.
    -   Utiliza `process.env.NEXT_PUBLIC_...` para exponerlas al cliente (frontend).

6.  **Despliegue:**
    Simplemente conecta tu repositorio de GitHub a Vercel y se desplegará automáticamente.
