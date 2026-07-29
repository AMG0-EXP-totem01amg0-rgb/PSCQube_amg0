import { getCachedData, setCachedData, invalidateCache } from "../cache/cache.service.js";
import { readFromSupabase, writeToSupabase, deleteFromSupabase, getSupabaseClient } from "../services/supabase.service.js";
import { normalizeUniqueIds, getIdColumnAndKey } from "../utils/mappings.js";

export class GenericRepository {
  static async findAll(tableName: string): Promise<any[]> {
    const cached = getCachedData(tableName);
    if (cached !== null) return cached;

    const dbData = await readFromSupabase(tableName);
    const normalized = normalizeUniqueIds(tableName, dbData || []);
    setCachedData(tableName, normalized);
    return normalized;
  }

  static async findById(tableName: string, id: string | number): Promise<any | null> {
    const cached = getCachedData(tableName);
    if (cached !== null) {
      const { clientKey } = getIdColumnAndKey(tableName);
      return cached.find((item: any) => String(item[clientKey]).trim() === String(id).trim()) || null;
    }

    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { sheetCol: dbIdCol } = getIdColumnAndKey(tableName);
    const { data, error } = await supabase
      .from(tableName.toLowerCase())
      .select("*")
      .eq(dbIdCol, id)
      .maybeSingle();

    if (error || !data) return null;
    const normalizedArr = normalizeUniqueIds(tableName, [data]);
    return normalizedArr[0] || null;
  }

  static async create(tableName: string, item: any): Promise<void> {
    const { clientKey } = getIdColumnAndKey(tableName);
    const idValue = item[clientKey];
    await writeToSupabase(tableName, "insert", clientKey, idValue, item);
    
    // Invalidamos la caché para forzar refresco limpio en la próxima lectura
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
