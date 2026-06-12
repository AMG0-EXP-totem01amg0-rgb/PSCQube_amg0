import { GenericRepository } from "../repositories/generic.repository.js";

export class AuthService {
  static async validateUserEmail(email: string): Promise<any | null> {
    if (!email) return null;
    try {
      const users = await GenericRepository.findAll("USUARIOSV2");
      const cleanEmail = email.trim().toLowerCase();
      const matched = users.find((u: any) => 
        (u.email && u.email.trim().toLowerCase() === cleanEmail) ||
        (u.email2 && u.email2.trim().toLowerCase() === cleanEmail)
      );
      return matched || null;
    } catch {
      return null;
    }
  }
}
