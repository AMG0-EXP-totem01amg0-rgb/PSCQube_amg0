import { GenericRepository } from "./generic.repository.js";

export class ProductionRepository extends GenericRepository {
  static async findAllProduction(): Promise<any[]> {
    return GenericRepository.findAll("PRODUCCIONV2");
  }

  static async findDetailsAll(): Promise<any[]> {
    return GenericRepository.findAll("DETALLES_PRODUCCIONV2");
  }

  static async findNozzlesAll(): Promise<any[]> {
    return GenericRepository.findAll("PAROS_BOQUILLASV2");
  }
}
