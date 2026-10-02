import { Router } from "express";
import { readFromSupabase } from "../services/supabase.service.js";

const router = Router();

let maestrosMemoryCache: any = null;
let maestrosMemoryCacheTimestamp: number = 0;
const MAESTROS_CACHE_TTL = 12 * 60 * 60 * 1000; // 12 horas

router.get("/api/sync/maestros", async (req, res) => {
  res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
  
  try {
    const isForce = req.query.force === 'true';
    const now = Date.now();
    
    if (!isForce && maestrosMemoryCache && (now - maestrosMemoryCacheTimestamp < MAESTROS_CACHE_TTL)) {
      return res.json({
        success: true,
        data: maestrosMemoryCache
      });
    }

    const [
      turnos,
      paletizadoras,
      ensacadoras,
      hacs,
      causas,
      materiales,
      capacidades,
      usuarios,
      empresas,
      puntoscarga,
      proveedoresbolsa,
      vehiculos,
      parametrosbalanza
    ] = await Promise.all([
      readFromSupabase("TURNOSV2").then(r => r || []).catch(() => []),
      readFromSupabase("PALETIZADORAV2").then(r => r || []).catch(() => []),
      readFromSupabase("ENSACADORAV2").then(r => r || []).catch(() => []),
      readFromSupabase("HACSV2").then(r => r || []).catch(() => []),
      readFromSupabase("CAUSASV2").then(r => r || []).catch(() => []),
      readFromSupabase("MATERIALESV2").then(r => r || []).catch(() => []),
      readFromSupabase("CAPACIDADESV2").then(r => r || []).catch(() => []),
      readFromSupabase("USUARIOSV2").then(r => r || []).catch(() => []),
      readFromSupabase("EMPRESASV2").then(r => r || []).catch(() => []),
      readFromSupabase("PUNTOS_CARGAV2").then(r => r || []).catch(() => []),
      readFromSupabase("PROVEEDORES_BOLSAV2").then(r => r || []).catch(() => []),
      readFromSupabase("VEHICULOSV2").then(r => r || []).catch(() => []),
      readFromSupabase("PARAMETROS_BALANZAV2").then(r => r || []).catch(() => [])
    ]);

    maestrosMemoryCache = {
      turnos,
      paletizadoras,
      ensacadoras,
      hacs,
      causas,
      materiales,
      capacidades,
      usuarios,
      empresas,
      puntoscarga,
      proveedoresbolsa,
      vehiculos,
      parametrosbalanza
    };
    maestrosMemoryCacheTimestamp = Date.now();

    return res.json({
      success: true,
      data: maestrosMemoryCache
    });
  } catch (error: any) {
    console.error("Error in /api/sync/maestros:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error"
    });
  }
});

const APP_VERSION = process.env.APP_VERSION || "v2.0.1-stable";

router.get("/api/version", (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400");
  return res.json({
    success: true,
    version: APP_VERSION
  });
});

export default router;
