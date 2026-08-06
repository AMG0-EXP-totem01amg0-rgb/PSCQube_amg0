import { Router } from "express";
import { MaestrosService } from "../services/maestros.service.js";
import { readFromSupabase } from "../services/supabase.service.js";

const router = Router();

// Specialized endpoints for secondary master data entities
router.get("/api/maestros/health", (req, res) => {
  return res.json({ success: true, message: "Master routes system is online." });
});

// Endpoint for causes catalog with machine filtering support and CDN caching
router.get(["/api/catalogos/causas", "/api/maestros/causas"], async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
  try {
    const { maquinaId, palletizerId, hac } = req.query;
    const allCauses = (await readFromSupabase("CAUSASV2")) || [];

    const filterVal = String(maquinaId || palletizerId || hac || "").trim().toUpperCase();

    let filtered = allCauses;
    if (filterVal) {
      filtered = allCauses.filter((c: any) => {
        const cHac = String(c.hac || "").trim().toUpperCase();
        const cId = String(c.id || "").trim().toUpperCase();
        return cHac === filterVal || cId === filterVal || cHac.includes(filterVal);
      });
    }

    // Return only required fields for dropdowns to minimize payload size
    const compactCauses = filtered.map((c: any) => ({
      id: c.id,
      hac: c.hac,
      text: c.text || c.descripcion,
      stopType: c.stopType || c.tipo_paro,
      symptomGroup: c.symptomGroup,
      symptomCode: c.symptomCode,
      causeGroup: c.causeGroup,
      causeCode: c.causeCode
    }));

    return res.json({
      success: true,
      count: compactCauses.length,
      data: compactCauses
    });
  } catch (error: any) {
    console.error("Error in /api/catalogos/causas:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Error al obtener causas"
    });
  }
});

export default router;
