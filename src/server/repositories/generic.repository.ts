import { getCachedData, setCachedData, invalidateCache } from "../cache/cache.service.js";
import { readFromSupabase, writeToSupabase, deleteFromSupabase, ReadOptions } from "../services/supabase.service.js";
import { normalizeUniqueIds, getIdColumnAndKey } from "../utils/mappings.js";

export class GenericRepository {
  static async findAll(tableName: string, options?: ReadOptions): Promise<any[]> {
    let cacheKey = tableName;
    if (options && Object.keys(options).length > 0) {
      cacheKey = `${tableName}_${JSON.stringify(options)}`;
    }
    
    const cached = getCachedData(tableName, cacheKey);
    if (cached !== null) return cached;

    const dbData = await readFromSupabase(tableName, options);
    const normalized = normalizeUniqueIds(tableName, dbData || []);
    
    setCachedData(tableName, normalized, cacheKey);
    return normalized;
  }

  static async create(tableName: string, item: any): Promise<void> {
    const { clientKey } = getIdColumnAndKey(tableName);
    const idValue = item[clientKey];
    await writeToSupabase(tableName, "insert", clientKey, idValue, item);
    invalidateCache(tableName);
  }

  static async update(tableName: string, targetId: string, item: any): Promise<void> {
    const { clientKey } = getIdColumnAndKey(tableName);
    await writeToSupabase(tableName, "update", clientKey, targetId, item);
    invalidateCache(tableName);
  }

  static async delete(tableName: string, targetId: string): Promise<boolean> {
    const { clientKey } = getIdColumnAndKey(tableName);
    const deleted = await deleteFromSupabase(tableName, clientKey, targetId);
    if (deleted) {
      invalidateCache(tableName);
    }
    return deleted;
  }
}
