import { GenericRepository } from "./generic.repository.js";

export class ParosRepository extends GenericRepository {
  static async findAllParos(): Promise<any[]> {
    return GenericRepository.findAll("PAROSV2");
  }
}
