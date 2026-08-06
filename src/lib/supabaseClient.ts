import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export async function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (supabaseInstance) return supabaseInstance;

  const metaEnv = (import.meta as any).env || {};
  const envUrl = metaEnv.VITE_SUPABASE_URL;
  const envKey = metaEnv.VITE_SUPABASE_ANON_KEY;

  if (!envUrl || !envKey) {
    console.warn("Faltan las variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY.");
    return null;
  }

  let url = envUrl.trim().replace(/\/+$/, "");
  if (url.toLowerCase().endsWith("/rest/v1")) {
    url = url.slice(0, -8);
  }
  url = url.trim().replace(/\/+$/, "");

  try {
    supabaseInstance = createClient(url, envKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return supabaseInstance;
  } catch (error) {
    console.error("[Supabase Client Initialization Error]", error);
    return null;
  }
}
