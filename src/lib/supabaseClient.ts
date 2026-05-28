import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export async function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (supabaseInstance) return supabaseInstance;

  try {
    const res = await fetch('/api/auth/supabase/config');
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.supabaseUrl && data.supabaseKey) {
        // Sanitize Url to prevent invalid paths
        let url = data.supabaseUrl.trim().replace(/\/+$/, "");
        if (url.toLowerCase().endsWith("/rest/v1")) {
          url = url.slice(0, -8);
        }
        url = url.trim().replace(/\/+$/, "");

        supabaseInstance = createClient(url, data.supabaseKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true // Process URL hashes from Supabase OAuth
          }
        });
        return supabaseInstance;
      }
    }
  } catch (error) {
    console.warn("[Supabase Client Initialization Server Config Warning]", error);
  }

  // Fallback to client-side bundle environment variables
  const metaEnv = (import.meta as any).env || {};
  const envUrl = (metaEnv.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const envKey = metaEnv.VITE_SUPABASE_ANON_KEY || metaEnv.VITE_SUPABASE_KEY;

  if (envUrl && envKey) {
    try {
      let url = envUrl;
      if (url.toLowerCase().endsWith("/rest/v1")) {
        url = url.slice(0, -8);
      }
      url = url.trim().replace(/\/+$/, "");

      supabaseInstance = createClient(url, envKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      return supabaseInstance;
    } catch (e) {
      console.error("[Supabase Client Env Fallback Error]", e);
    }
  }

  return null;
}
