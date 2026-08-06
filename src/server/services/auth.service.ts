import { GenericRepository } from "../repositories/generic.repository.js";

export class AuthService {
  static async validateUserEmail(email: string): Promise<any | null> {
    if (!email) return null;
    try {
      const users = await GenericRepository.findAll("USUARIOSV2");
      if (!users || users.length === 0) return null;

      const cleanEmail = email.trim().toLowerCase();

      // Mapa para búsqueda instantánea O(1) por email principal y secundario
      const userByEmailMap = new Map<string, any>();
      for (let i = 0; i < users.length; i++) {
        const u = users[i];
        if (!u) continue;

        if (u.email) {
          const e1 = String(u.email).trim().toLowerCase();
          if (e1 && !userByEmailMap.has(e1)) {
            userByEmailMap.set(e1, u);
          }
        }

        if (u.email2) {
          const e2 = String(u.email2).trim().toLowerCase();
          if (e2 && !userByEmailMap.has(e2)) {
            userByEmailMap.set(e2, u);
          }
        }
      }

      const matched = userByEmailMap.get(cleanEmail);
      return matched || null;
    } catch {
      return null;
    }
  }
}