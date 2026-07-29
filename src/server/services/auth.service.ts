import { getSupabaseClient } from "./supabase.service.js";

export class AuthService {
  static async validateUserEmail(email: string): Promise<any | null> {
    if (!email) return null;
    const cleanEmail = email.trim().toLowerCase();
    
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return null;

      // Consulta directa a Supabase buscando por email o email2
      const { data, error } = await supabase
        .from("USUARIOSV2")
        .select("*")
        .or(`email.ilike.${cleanEmail},email2.ilike.${cleanEmail}`)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error validating user email:", error.message);
        return null;
      }

      return data || null;
    } catch (err) {
      console.error("Unexpected error in validateUserEmail:", err);
      return null;
    }
  }
}
